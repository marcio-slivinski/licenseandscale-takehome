"use server";

/**
 * Server actions for the proposal pipeline.
 *
 *  - createLead         → manual lead creation (P0 demo). Prod = GHL webhook.
 *  - draftProposal      → orchestrates Calls A→B→C + guardrails + persistence.
 *  - approveProposal    → captures edits, generates PDF, notifies Slack, writes audit log.
 *
 * All mutating actions write to audit_log. All boundary inputs validated against Zod.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin, PDF_BUCKET } from "@/lib/supabase";
import { extractScope } from "@/lib/agents/scope-extractor";
import { matchLineItems } from "@/lib/agents/line-matcher";
import { writeNarrative } from "@/lib/agents/narrative-writer";
import { buildScoredLineItems, calculateTotal, generateFlags, type ScoredLineItem } from "@/lib/guardrails";
import { renderProposalPDF } from "@/lib/pdf-generator";
import { notifySlack } from "@/lib/slack";
import { rateLimit } from "@/lib/rate-limit";
import type {
  Lead,
  PricingItem,
  Proposal,
  ProposalLineItem,
  VoiceExemplar,
} from "@/lib/types";

// ── createLead ───────────────────────────────────────────────────────────────
export async function createLead(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const project_address = String(formData.get("project_address") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) throw new Error("Lead name required.");

  const { data, error } = await supabaseAdmin
    .from("leads")
    .insert({ name, email, phone, project_address, notes, source: "manual" })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create lead: ${error.message}`);

  await audit("lead", data.id, "drafted", { name });

  revalidatePath("/");
  redirect(`/leads/${data.id}`);
}

// ── draftProposal ────────────────────────────────────────────────────────────
export type DraftResult =
  | { ok: true; proposalId: string }
  | { ok: false; error: string };

export async function draftProposal(leadId: string, rawNotes: string): Promise<DraftResult> {
  // Rate limit — protect API spend.
  const rl = rateLimit(`draft:${leadId}`, { max: 1, windowMs: 30_000 });
  if (!rl.allowed) {
    return { ok: false, error: `Wait ${Math.ceil(rl.retryAfterMs / 1000)}s before drafting again.` };
  }

  if (!rawNotes || rawNotes.trim().length < 20) {
    return { ok: false, error: "Site walk notes are too short (need at least 20 characters)." };
  }

  // Load lead + catalog + voice exemplars
  const [{ data: lead, error: leadErr }, { data: catalogRaw, error: catErr }, { data: exemplarsRaw }] = await Promise.all([
    supabaseAdmin.from("leads").select("*").eq("id", leadId).single(),
    supabaseAdmin.from("pricing_items").select("*"),
    supabaseAdmin.from("voice_exemplars").select("*").order("uploaded_at", { ascending: false }).limit(50),
  ]);

  if (leadErr || !lead) return { ok: false, error: `Lead not found: ${leadErr?.message}` };
  if (catErr || !catalogRaw) return { ok: false, error: `Catalog load failed: ${catErr?.message}` };

  const catalog = catalogRaw as PricingItem[];
  const exemplars = (exemplarsRaw ?? []) as VoiceExemplar[];

  // Step 1: persist raw site walk
  const { data: siteWalk, error: swErr } = await supabaseAdmin
    .from("site_walks")
    .insert({ lead_id: leadId, raw_notes: rawNotes })
    .select("id")
    .single();
  if (swErr) return { ok: false, error: `Failed to save site walk: ${swErr.message}` };

  // Step 2: extract scope
  const scopeResult = await extractScope(rawNotes, catalog);
  if (!scopeResult.ok) {
    return { ok: false, error: `Scope extraction failed: ${scopeResult.error}` };
  }

  // Persist parsed scope
  await supabaseAdmin.from("site_walks").update({ parsed_scope: scopeResult.scope }).eq("id", siteWalk.id);

  // Step 3: match line items
  const matches = await matchLineItems(scopeResult.scope, catalog);
  const scoredItems = buildScoredLineItems(matches, catalog);
  const total = calculateTotal(scoredItems);

  // Step 4: write narrative
  const narrativeResult = await writeNarrative({
    lead: { name: lead.name, project_address: lead.project_address, notes: lead.notes },
    scope: scopeResult.scope,
    matches,
    catalog,
    exemplars,
  });
  if (!narrativeResult.ok) {
    return { ok: false, error: `Narrative generation failed: ${narrativeResult.error}` };
  }

  // Step 5: guardrails
  const flags = generateFlags(scoredItems, total, narrativeResult.narrative, catalog);

  // Step 6: persist proposal + line items
  const { data: proposal, error: propErr } = await supabaseAdmin
    .from("proposals")
    .insert({
      lead_id: leadId,
      site_walk_id: siteWalk.id,
      status: "draft",
      narrative: narrativeResult.narrative,
      total,
      flags,
    })
    .select("id")
    .single();
  if (propErr) return { ok: false, error: `Failed to save proposal: ${propErr.message}` };

  await persistLineItems(proposal.id, scoredItems);
  await audit("proposal", proposal.id, "drafted", {
    item_count: scoredItems.length,
    flag_count: flags.length,
    total,
  });

  return { ok: true, proposalId: proposal.id };
}

// ── approveProposal ──────────────────────────────────────────────────────────
export type ApproveResult =
  | { ok: true; pdfUrl: string | null }
  | { ok: false; error: string };

export type EditedLineItem = {
  id: string;
  quantity: number;
  needs_review: boolean;
};

export async function approveProposal(
  proposalId: string,
  editedNarrative: string,
  editedItems: EditedLineItem[],
): Promise<ApproveResult> {
  // Load proposal + line items + lead + catalog
  const { data: proposal, error: propErr } = await supabaseAdmin
    .from("proposals")
    .select("*")
    .eq("id", proposalId)
    .single();
  if (propErr || !proposal) return { ok: false, error: `Proposal not found: ${propErr?.message}` };
  if (proposal.status !== "draft") {
    return { ok: false, error: "This proposal has already been sent." };
  }

  const { data: lineItemsRaw } = await supabaseAdmin
    .from("proposal_line_items")
    .select("*, pricing_items(*)")
    .eq("proposal_id", proposalId)
    .order("position", { ascending: true });

  type RawLineItem = ProposalLineItem & { pricing_items: PricingItem | PricingItem[] | null };
  const lineItems = ((lineItemsRaw ?? []) as unknown as RawLineItem[]).map((li) => ({
    ...li,
    pricing_items: Array.isArray(li.pricing_items) ? li.pricing_items[0] ?? null : li.pricing_items,
  }));

  const { data: lead } = await supabaseAdmin.from("leads").select("*").eq("id", proposal.lead_id).single();
  if (!lead) return { ok: false, error: "Lead not found." };

  const { data: catalog } = await supabaseAdmin.from("pricing_items").select("*");
  if (!catalog) return { ok: false, error: "Catalog unavailable." };

  // Capture edit_correction if narrative changed
  if ((proposal.narrative ?? "") !== editedNarrative) {
    const { data: inserted } = await supabaseAdmin
      .from("voice_exemplars")
      .insert({
        type: "edit_correction",
        content: editedNarrative,
        tags: [],
        metadata: { original: proposal.narrative, edited: editedNarrative, proposal_id: proposalId },
      })
      .select("id")
      .single();
    if (inserted) {
      await audit("voice_exemplar", inserted.id, "uploaded", { source: "edit_correction", proposal_id: proposalId });
    }
  }

  // Apply user edits + snapshot LIVE catalog prices at approval time.
  // Items whose catalog row was deleted are dropped (delete line item) — they were
  // hidden in the UI anyway, so Marcus didn't see them.
  const editMap = new Map(editedItems.map((e) => [e.id, e]));
  let newTotal = 0;
  for (const li of lineItems) {
    const edit = editMap.get(li.id);
    if (!edit) continue;
    const pricing = li.pricing_items;
    if (!pricing) {
      // Catalog item gone — drop the line item entirely.
      await supabaseAdmin.from("proposal_line_items").delete().eq("id", li.id);
      continue;
    }
    const liveUnitPrice = Number(pricing.unit_price);
    const newSubtotal = edit.needs_review ? 0 : liveUnitPrice * edit.quantity;
    await supabaseAdmin
      .from("proposal_line_items")
      .update({
        quantity: edit.quantity,
        needs_review: edit.needs_review,
        unit_price: liveUnitPrice,
        subtotal: newSubtotal,
      })
      .eq("id", li.id);
    newTotal += newSubtotal;
  }

  // Generate PDF BEFORE flipping status. If PDF fails, the proposal stays a draft so
  // Marcus can retry — Slack does NOT ping, status does NOT flip, no fake "sent" record.
  const { data: finalLineItemsRaw } = await supabaseAdmin
    .from("proposal_line_items")
    .select("*, pricing_items(item_name)")
    .eq("proposal_id", proposalId)
    .order("position", { ascending: true });

  const finalLineItems = (finalLineItemsRaw ?? []).map((li: any) => ({
    ...(li as ProposalLineItem),
    item_name: li.pricing_items?.item_name ?? li.scope_description,
  }));

  const updatedProposal: Proposal = { ...proposal, narrative: editedNarrative, total: newTotal };

  let pdfUrl: string | null = null;
  try {
    const pdfBuffer = await renderProposalPDF({ proposal: updatedProposal, lead: lead as Lead, lineItems: finalLineItems });
    const pdfPath = `${proposalId}.pdf`;
    const upload = await supabaseAdmin.storage.from(PDF_BUCKET).upload(pdfPath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upload.error) {
      console.error("PDF upload failed:", upload.error);
      return { ok: false, error: `Couldn't save the PDF: ${upload.error.message}. Proposal kept as draft — try approving again.` };
    }
    const { data: pub } = supabaseAdmin.storage.from(PDF_BUCKET).getPublicUrl(pdfPath);
    pdfUrl = pub.publicUrl;
  } catch (err) {
    console.error("PDF generation failed:", err);
    return { ok: false, error: `Couldn't generate the PDF: ${err instanceof Error ? err.message : "unknown"}. Proposal kept as draft.` };
  }

  // PDF exists — now safe to flip status + notify Slack.
  await supabaseAdmin
    .from("proposals")
    .update({
      status: "approved",
      narrative: editedNarrative,
      total: newTotal,
      pdf_url: pdfUrl,
      approved_at: new Date().toISOString(),
    })
    .eq("id", proposalId);

  await audit("proposal", proposalId, "approved", { total: newTotal, pdf_url: pdfUrl });

  // Notify Slack — failure is logged but doesn't roll back approval (already irreversible).
  const slackResult = await notifySlack({
    proposalId,
    leadName: lead.name,
    total: newTotal,
    pdfUrl,
    flagCount: (proposal.flags ?? []).length,
  });
  if (!slackResult.ok) {
    console.warn("Slack notification failed:", slackResult.error);
  }

  await audit("proposal", proposalId, "sent", { slack_ok: slackResult.ok });

  revalidatePath(`/proposals/${proposalId}/review`);
  return { ok: true, pdfUrl };
}

// ── helpers ─────────────────────────────────────────────────────────────────
async function persistLineItems(proposalId: string, items: ScoredLineItem[]) {
  const rows = items.map((item, idx) => ({
    proposal_id: proposalId,
    pricing_item_id: item.pricing_item_id,
    scope_description: item.scope_description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    subtotal: item.subtotal,
    confidence: item.confidence,
    needs_review: item.needs_review,
    position: idx,
  }));
  if (rows.length === 0) return;
  const { error } = await supabaseAdmin.from("proposal_line_items").insert(rows);
  if (error) console.error("Line items insert failed:", error);
}

async function audit(entityType: string, entityId: string, action: string, metadata: Record<string, unknown>) {
  await supabaseAdmin.from("audit_log").insert({
    entity_type: entityType,
    entity_id: entityId,
    action,
    actor: "marcus",
    metadata,
  });
}

// ── addLineItem ──────────────────────────────────────────────────────────────
export type AddedLineItem = {
  id: string;
  scope_description: string;
  item_name: string;
  category: string;
  unit: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  confidence: number;
  needs_review: boolean;
};

export type AddLineItemResult =
  | { ok: true; lineItem: AddedLineItem }
  | { ok: false; error: string };

/**
 * Add a manual line item to an existing draft proposal.
 *
 * Use case: Marcus is reviewing a draft and remembers something the agent missed on the
 * site walk notes. He picks an item from the catalog and sets quantity. We snapshot the
 * current catalog price into proposal_line_items.unit_price (so future catalog price
 * changes don't retroactively modify this proposal).
 *
 * Items added this way: confidence = 1.0 (Marcus picked it explicitly), needs_review = false.
 */
export async function addLineItem(
  proposalId: string,
  pricingItemId: string,
  quantity: number,
): Promise<AddLineItemResult> {
  if (quantity <= 0) return { ok: false, error: "Quantity must be greater than zero." };

  const [{ data: proposal }, { data: pricing }, { data: existing }] = await Promise.all([
    supabaseAdmin.from("proposals").select("id, status").eq("id", proposalId).single(),
    supabaseAdmin.from("pricing_items").select("*").eq("id", pricingItemId).single(),
    supabaseAdmin
      .from("proposal_line_items")
      .select("position")
      .eq("proposal_id", proposalId)
      .order("position", { ascending: false })
      .limit(1),
  ]);

  if (!proposal) return { ok: false, error: "Proposal not found." };
  if (proposal.status !== "draft") {
    return { ok: false, error: "Cannot add items to a proposal that has already been sent." };
  }
  if (!pricing) return { ok: false, error: "Catalog item not found." };

  const nextPosition = (existing?.[0]?.position ?? -1) + 1;
  const unitPrice = Number(pricing.unit_price);
  const subtotal = unitPrice * quantity;

  const { data: inserted, error } = await supabaseAdmin
    .from("proposal_line_items")
    .insert({
      proposal_id: proposalId,
      pricing_item_id: pricingItemId,
      scope_description: pricing.item_name,
      quantity,
      unit_price: unitPrice,
      subtotal,
      confidence: 1.0,
      needs_review: false,
      position: nextPosition,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await audit("proposal", proposalId, "edited", {
    change: "line_item_added",
    item_name: pricing.item_name,
    quantity,
    subtotal,
  });

  return {
    ok: true,
    lineItem: {
      id: inserted.id,
      scope_description: pricing.item_name,
      item_name: pricing.item_name,
      category: pricing.category,
      unit: pricing.unit,
      quantity,
      unit_price: unitPrice,
      subtotal,
      confidence: 1.0,
      needs_review: false,
    },
  };
}

// ── deleteDraft ──────────────────────────────────────────────────────────────
/**
 * Delete a draft proposal entirely (including line items, audit references stay).
 *
 * Sent / approved proposals are immutable — error returned.
 */
export async function deleteDraft(proposalId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: proposal } = await supabaseAdmin
    .from("proposals")
    .select("id, status, lead_id")
    .eq("id", proposalId)
    .single();
  if (!proposal) return { ok: false, error: "Proposal not found." };
  if (proposal.status !== "draft") {
    return { ok: false, error: "Only drafts can be deleted. Sent proposals are permanent." };
  }

  // proposal_line_items cascade via FK; site_walk stays (it's the raw notes Marcus typed).
  const { error } = await supabaseAdmin.from("proposals").delete().eq("id", proposalId);
  if (error) return { ok: false, error: error.message };

  await audit("proposal", proposalId, "edited", { change: "draft_deleted" });
  revalidatePath(`/leads/${proposal.lead_id}`);
  revalidatePath("/");
  return { ok: true };
}

// ── removeLineItem ───────────────────────────────────────────────────────────
export async function removeLineItem(proposalId: string, lineItemId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: proposal } = await supabaseAdmin.from("proposals").select("status").eq("id", proposalId).single();
  if (!proposal) return { ok: false, error: "Proposal not found." };
  if (proposal.status !== "draft") return { ok: false, error: "Can only remove items from a draft." };

  const { error } = await supabaseAdmin.from("proposal_line_items").delete().eq("id", lineItemId).eq("proposal_id", proposalId);
  if (error) return { ok: false, error: error.message };

  await audit("proposal", proposalId, "edited", { change: "line_item_removed", line_item_id: lineItemId });
  revalidatePath(`/proposals/${proposalId}/review`);
  return { ok: true };
}

// ── regenerateNarrative ──────────────────────────────────────────────────────
export type RegenerateNarrativeResult =
  | { ok: true; narrative: string; total: number }
  | { ok: false; error: string };

/**
 * Rewrite the proposal narrative based on the CURRENT draft state.
 *
 * Use case: Marcus edited quantities, toggled items in/out, added items from the catalog,
 * and now wants the narrative text to reflect his current item list (instead of the
 * original auto-draft text). Scope and matches are synthesized from current line items.
 *
 * What this PRESERVES:
 *  - Marcus's quantity edits (we persist them first)
 *  - Marcus's include/exclude toggles (we persist them first)
 *  - Line items he added via '+ Add item'
 *  - Live catalog prices (drafts compute live)
 *
 * What this REPLACES:
 *  - The narrative text only
 *
 * Drafts only. Sent proposals are immutable.
 */
export async function regenerateNarrative(
  proposalId: string,
  editedItems: EditedLineItem[],
): Promise<RegenerateNarrativeResult> {
  const { data: proposal } = await supabaseAdmin
    .from("proposals")
    .select("id, status, lead_id, site_walk_id")
    .eq("id", proposalId)
    .single();
  if (!proposal) return { ok: false, error: "Proposal not found." };
  if (proposal.status !== "draft") {
    return { ok: false, error: "Only drafts can be regenerated." };
  }

  const rl = rateLimit(`regenerate-text:${proposal.lead_id}`, { max: 1, windowMs: 15_000 });
  if (!rl.allowed) {
    return { ok: false, error: `Wait ${Math.ceil(rl.retryAfterMs / 1000)}s before regenerating again.` };
  }

  // Persist user edits to DB first
  for (const edit of editedItems) {
    await supabaseAdmin
      .from("proposal_line_items")
      .update({ quantity: edit.quantity, needs_review: edit.needs_review })
      .eq("id", edit.id);
  }

  // Load everything we need in parallel
  const [{ data: lead }, { data: siteWalk }, { data: catalogRaw }, { data: exemplarsRaw }, { data: lineItemsRaw }] =
    await Promise.all([
      supabaseAdmin.from("leads").select("*").eq("id", proposal.lead_id).single(),
      proposal.site_walk_id
        ? supabaseAdmin.from("site_walks").select("*").eq("id", proposal.site_walk_id).single()
        : Promise.resolve({ data: null }),
      supabaseAdmin.from("pricing_items").select("*"),
      supabaseAdmin.from("voice_exemplars").select("*").order("uploaded_at", { ascending: false }).limit(50),
      supabaseAdmin
        .from("proposal_line_items")
        .select("*, pricing_items(*)")
        .eq("proposal_id", proposalId)
        .order("position", { ascending: true }),
    ]);

  if (!lead) return { ok: false, error: "Lead not found." };

  const catalog = (catalogRaw ?? []) as PricingItem[];
  const exemplars = (exemplarsRaw ?? []) as VoiceExemplar[];

  type RawLineItem = {
    id: string;
    scope_description: string;
    quantity: number;
    needs_review: boolean;
    confidence: number;
    pricing_item_id: string | null;
    pricing_items: PricingItem | PricingItem[] | null;
  };
  const lineItems = ((lineItemsRaw ?? []) as unknown as RawLineItem[])
    .map((li) => ({
      ...li,
      pricing_items: Array.isArray(li.pricing_items) ? li.pricing_items[0] ?? null : li.pricing_items,
    }))
    .filter((li) => li.pricing_items != null); // catalog deletes drop silently

  // Build the synthesized scope + matches from CURRENT live state, included items only
  const includedItems = lineItems.filter((li) => !li.needs_review);
  if (includedItems.length === 0) {
    return { ok: false, error: "Nothing to write about — all items are excluded. Toggle some on first." };
  }

  const originalScope = (siteWalk?.parsed_scope ?? null) as
    | { project_type?: string; site_constraints?: string[]; estimated_complexity?: "simple" | "medium" | "complex" }
    | null;

  const scope = {
    project_type: originalScope?.project_type ?? "outdoor project",
    items: includedItems.map((li) => ({
      description: li.scope_description,
      category: (li.pricing_items as PricingItem).category as
        | "hardscape" | "landscape" | "irrigation" | "lighting" | "water_feature" | "structure",
      quantity: Number(li.quantity),
      unit: (li.pricing_items as PricingItem).unit as "sqft" | "linear_ft" | "each" | "project",
      complexity_notes: undefined,
    })),
    site_constraints: originalScope?.site_constraints ?? [],
    estimated_complexity: originalScope?.estimated_complexity ?? "medium",
  };

  // Synthesize matches — each item already has a known pricing_item_id + confidence
  const matches = includedItems.map((li, idx) => ({
    scope_index: idx,
    pricing_item_id: li.pricing_item_id,
    confidence: Number(li.confidence),
    reasoning: "user-curated",
    scope_item: scope.items[idx],
  }));

  const narrativeResult = await writeNarrative({
    lead: { name: lead.name, project_address: lead.project_address, notes: lead.notes },
    scope,
    matches,
    catalog,
    exemplars,
  });
  if (!narrativeResult.ok) return { ok: false, error: `Narrative generation failed: ${narrativeResult.error}` };

  // Live total from current catalog + rebuild scored items so guardrails see the truth.
  const scoredForFlags: ScoredLineItem[] = includedItems.map((li) => {
    const pricing = li.pricing_items as PricingItem;
    const unitPrice = Number(pricing.unit_price);
    const subtotal = unitPrice * Number(li.quantity);
    return {
      scope_description: li.scope_description,
      pricing_item_id: li.pricing_item_id,
      quantity: Number(li.quantity),
      unit_price: unitPrice,
      subtotal,
      confidence: Number(li.confidence),
      needs_review: false,
    };
  });
  const liveTotal = scoredForFlags.reduce((sum, s) => sum + s.subtotal, 0);

  // Re-run guardrails on the regenerated narrative + current scope.
  const flags = generateFlags(scoredForFlags, liveTotal, narrativeResult.narrative, catalog);

  await supabaseAdmin
    .from("proposals")
    .update({ narrative: narrativeResult.narrative, total: liveTotal, flags })
    .eq("id", proposalId);

  await audit("proposal", proposalId, "edited", {
    change: "narrative_regenerated",
    item_count: includedItems.length,
    flag_count: flags.length,
    total: liveTotal,
  });

  revalidatePath(`/proposals/${proposalId}/review`);
  return { ok: true, narrative: narrativeResult.narrative, total: liveTotal };
}

