import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { ReviewClient } from "./ReviewClient";
import type { PricingItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProposalReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: proposal, error } = await supabaseAdmin.from("proposals").select("*").eq("id", id).single();
  if (error || !proposal) notFound();

  if (proposal.status === "approved" || proposal.status === "sent") {
    redirect(`/proposals/${id}/sent`);
  }

  const { data: lead } = await supabaseAdmin.from("leads").select("*").eq("id", proposal.lead_id).single();
  if (!lead) notFound();

  const { data: siteWalk } = await supabaseAdmin
    .from("site_walks")
    .select("*")
    .eq("id", proposal.site_walk_id)
    .single();

  const [{ data: lineItemsRaw }, { data: catalogRaw }] = await Promise.all([
    supabaseAdmin
      .from("proposal_line_items")
      .select("*, pricing_items(*)")
      .eq("proposal_id", id)
      .order("position", { ascending: true }),
    supabaseAdmin
      .from("pricing_items")
      .select("*")
      .order("category", { ascending: true })
      .order("item_name", { ascending: true }),
  ]);

  const catalog = (catalogRaw ?? []) as PricingItem[];

  // Live binding: drafts show current catalog prices/names.
  // Items whose catalog row was deleted stay visible with an 'orphan' flag — Marcus must
  // explicitly resolve them (remove from proposal or restore in catalog). Silent removal
  // would be wrong: drafts must be correct OR clearly flagged.
  const lineItems = (lineItemsRaw ?? []).map((li: any) => {
    const pricing = Array.isArray(li.pricing_items) ? li.pricing_items[0] : li.pricing_items;
    const orphan = !pricing;
    const quantity = Number(li.quantity);
    // For orphans we fall back to the snapshot we wrote at draft time, so the row still renders.
    const unitPrice = orphan ? Number(li.unit_price ?? 0) : Number(pricing.unit_price);
    const subtotal = orphan || li.needs_review ? 0 : unitPrice * quantity;
    return {
      id: li.id,
      scope_description: li.scope_description,
      item_name: orphan ? li.scope_description : pricing.item_name,
      category: orphan ? "—" : pricing.category,
      unit: orphan ? (li.unit ?? "—") : pricing.unit,
      quantity,
      unit_price: unitPrice,
      subtotal,
      confidence: li.confidence == null ? 0 : Number(li.confidence),
      needs_review: li.needs_review,
      orphan,
    };
  });

  const liveTotal = lineItems.reduce((sum, li) => sum + (li.orphan || li.needs_review ? 0 : li.subtotal), 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/leads/${lead.id}`} className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-brand)]">
          ← {lead.name}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Review the draft</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Look it over. Edit anything that&apos;s off. Prices and items update live from your catalog while it&apos;s a draft. Approve when it&apos;s good — we&apos;ll send it.
        </p>
      </div>

      <ReviewClient
        proposalId={proposal.id}
        leadName={lead.name}
        rawNotes={siteWalk?.raw_notes ?? ""}
        parsedScope={siteWalk?.parsed_scope ?? null}
        narrative={proposal.narrative ?? ""}
        lineItems={lineItems}
        total={liveTotal}
        flags={proposal.flags ?? []}
        catalog={catalog}
      />
    </div>
  );
}
