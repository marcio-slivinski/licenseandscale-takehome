import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function ProposalSentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: proposal, error } = await supabaseAdmin
    .from("proposals")
    .select("*, leads(name, project_address)")
    .eq("id", id)
    .single();
  if (error || !proposal) notFound();

  const lead = (proposal as any).leads;

  return (
    <div className="space-y-8">
      <Link href="/" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-brand)]">
        ← Dashboard
      </Link>

      <div className="rounded-2xl border border-[var(--color-brand-soft)] bg-[var(--color-brand-soft)] p-8">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--color-brand-dark)]">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-brand)]" />
          {proposal.status === "sent" ? "Sent" : "Approved"}
        </div>
        <div className="mt-3 text-4xl font-semibold tracking-tight tabular-nums text-[var(--color-brand-dark)]">
          ${Number(proposal.total ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </div>
        <div className="mt-2 text-[var(--color-ink-soft)]">
          For <span className="font-medium text-[var(--color-ink)]">{lead?.name}</span>
          {lead?.project_address && <span> · {lead.project_address}</span>}
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        {proposal.pdf_url ? (
          <a
            href={proposal.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 hover:border-[var(--color-brand)] hover:shadow-sm"
          >
            <div className="text-sm font-semibold">Open the proposal PDF</div>
            <div className="mt-1 text-xs text-[var(--color-ink-muted)]">Opens in a new tab</div>
          </a>
        ) : (
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas)] p-5">
            <div className="text-sm font-semibold text-[var(--color-ink-muted)]">PDF not available</div>
            <div className="mt-1 text-xs text-[var(--color-ink-muted)]">Try re-approving the proposal.</div>
          </div>
        )}
        <Link
          href={`/leads/${proposal.lead_id}`}
          className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 hover:border-[var(--color-brand)] hover:shadow-sm"
        >
          <div className="text-sm font-semibold">Back to {lead?.name ?? "lead"}</div>
          <div className="mt-1 text-xs text-[var(--color-ink-muted)]">Draft another proposal or check history.</div>
        </Link>
      </section>

      <section className="text-xs text-[var(--color-ink-muted)]">
        Sent {proposal.approved_at ? new Date(proposal.approved_at).toLocaleString() : "just now"} · Slack notified · Your edits saved as voice training.
      </section>
    </div>
  );
}
