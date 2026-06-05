import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function ProposalSentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: proposal, error } = await supabaseAdmin.from("proposals").select("*, leads(name, project_address)").eq("id", id).single();
  if (error || !proposal) notFound();

  const lead = (proposal as any).leads;

  return (
    <div className="space-y-8">
      <Link href="/" className="text-sm text-stone-500 hover:text-stone-800">← Dashboard</Link>

      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
        <div className="text-sm font-semibold uppercase tracking-wider text-emerald-800">
          {proposal.status === "sent" ? "Proposal sent" : "Proposal approved"}
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-emerald-950">
          ${Number(proposal.total ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </h1>
        <p className="mt-2 text-stone-700">
          For <span className="font-medium">{lead?.name}</span>
          {lead?.project_address && <span> · {lead.project_address}</span>}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        {proposal.pdf_url ? (
          <a
            href={proposal.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-stone-200 bg-white p-5 hover:border-emerald-500 hover:shadow-sm"
          >
            <div className="text-sm font-semibold">Open PDF</div>
            <div className="mt-1 text-xs text-stone-500">Hosted in Supabase Storage</div>
          </a>
        ) : (
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-5">
            <div className="text-sm font-semibold text-stone-500">PDF unavailable</div>
            <div className="mt-1 text-xs text-stone-400">Check approval logs.</div>
          </div>
        )}
        <Link
          href={`/leads/${proposal.lead_id}`}
          className="rounded-lg border border-stone-200 bg-white p-5 hover:border-emerald-500 hover:shadow-sm"
        >
          <div className="text-sm font-semibold">Back to lead</div>
          <div className="mt-1 text-xs text-stone-500">Draft another proposal or view history.</div>
        </Link>
      </section>

      <section className="text-xs text-stone-500">
        Approved at {proposal.approved_at ? new Date(proposal.approved_at).toLocaleString() : "—"} · Slack notification fired · Edit corrections captured as voice training.
      </section>
    </div>
  );
}
