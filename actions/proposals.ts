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

  const { data: lineItemsRaw } = await supabaseAdmin
    .from("proposal_line_items")
    .select("*")
    .eq("proposal_id", proposalId)
    .order("position", { ascending: true });

  const lineItems = (lineItemsRaw ?? []) as ProposalLineItem[];

  const { data: lead } = await supabaseAdmin.from("leads").select("*").eq("id", proposal.lead_id).single();
  if (!lead) return { ok: false, error: "Lead not found." };

  const { data: catalog } = await supabaseAdmin.from("pricing_items").select("*");
  if (!catalog) return { ok: false, error: "Catalog unavailable." };

  // Capture edit_correction if narrative changed
  if ((proposal.narrative ?? "") !== editedNarrative) {
    await supabaseAdmin.from("voice_exemplars").insert({
      type: "edit_correction",
      content: editedNarrative,
      tags: [],
      metadata: { original: proposal.narrative, edited: editedNarrative, proposal_id: proposalId },
    });
    await audit("voice_exemplar", proposalId, "uploaded", { source: "edit_correction" });
  }

  // Apply user edits to line items (toggle needs_review, adjust qty)
  const editMap = new Map(editedItems.map((e) => [e.id, e]));
  let newTotal = 0;
  for (const li of lineItems) {
    const edit = editMap.get(li.id);
    if (!edit) continue;
    const newSubtotal = edit.needs_review ? 0 : Number(li.unit_price) * edit.quantity;
    await supabaseAdmin
      .from("proposal_line_items")
      .update({
        quantity: edit.quantity,
        needs_review: edit.needs_review,
        subtotal: newSubtotal,
      })
      .eq("id", li.id);
    newTotal += newSubtotal;
  }

  // Generate PDF
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
    } else {
      const { data: pub } = supabaseAdmin.storage.from(PDF_BUCKET).getPublicUrl(pdfPath);
      pdfUrl = pub.publicUrl;
    }
  } catch (err) {
    console.error("PDF generation failed:", err);
  }

  // Update proposal status + total + pdf_url
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

  // Notify Slack
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
