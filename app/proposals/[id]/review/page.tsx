import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { ReviewClient } from "./ReviewClient";

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

  const { data: lineItemsRaw } = await supabaseAdmin
    .from("proposal_line_items")
    .select("*, pricing_items(item_name, unit, category)")
    .eq("proposal_id", id)
    .order("position", { ascending: true });

  const lineItems = (lineItemsRaw ?? []).map((li: any) => ({
    id: li.id,
    scope_description: li.scope_description,
    item_name: li.pricing_items?.item_name ?? "(no match)",
    category: li.pricing_items?.category ?? "—",
    unit: li.pricing_items?.unit ?? li.unit ?? "—",
    quantity: Number(li.quantity),
    unit_price: Number(li.unit_price),
    subtotal: Number(li.subtotal),
    confidence: li.confidence == null ? 0 : Number(li.confidence),
    needs_review: li.needs_review,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/leads/${lead.id}`} className="text-sm text-stone-500 hover:text-stone-800">
          ← {lead.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Review draft proposal</h1>
        <p className="mt-1 text-sm text-stone-600">
          Side-by-side: raw notes / parsed scope / matched line items + narrative. Edit any narrative line. Toggle items to include or exclude.
        </p>
      </div>

      <ReviewClient
        proposalId={proposal.id}
        leadName={lead.name}
        rawNotes={siteWalk?.raw_notes ?? ""}
        parsedScope={siteWalk?.parsed_scope ?? null}
        narrative={proposal.narrative ?? ""}
        lineItems={lineItems}
        total={Number(proposal.total ?? 0)}
        flags={proposal.flags ?? []}
      />
    </div>
  );
}
