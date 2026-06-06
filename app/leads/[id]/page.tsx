import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { DraftForm } from "./DraftForm";
import { DeleteDraftForm } from "./DeleteDraftForm";

export const dynamic = "force-dynamic";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: lead, error } = await supabaseAdmin.from("leads").select("*").eq("id", id).single();
  if (error || !lead) notFound();

  const { data: proposals } = await supabaseAdmin
    .from("proposals")
    .select("id, status, total, created_at, flags")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  const proposalList = proposals ?? [];

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="inline-flex items-center text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-brand)]">
          ← Dashboard
        </Link>
        <div className="mt-3 flex items-baseline justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">{lead.name}</h1>
          {lead.source && (
            <span className="rounded-full bg-[var(--color-canvas)] px-3 py-1 text-xs uppercase tracking-wider text-[var(--color-ink-soft)]">
              {lead.source === "meta_ads" ? "Meta Ads" : lead.source === "google_lsa" ? "Google LSA" : lead.source === "manual" ? "Manual entry" : "Referral"}
            </span>
          )}
        </div>
        {lead.project_address && (
          <div className="mt-1 text-sm text-[var(--color-ink-soft)]">{lead.project_address}</div>
        )}
        {lead.notes && (
          <div className="mt-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
              Intake notes
            </div>
            <p className="whitespace-pre-wrap text-sm text-[var(--color-ink)]">{lead.notes}</p>
          </div>
        )}
      </div>

      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-6">
        <div className="mb-2">
          <h2 className="text-lg font-semibold tracking-tight">Draft the proposal</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Paste your site walk notes below. We&apos;ll write the proposal for you in about 30 seconds. You review and approve before anything goes out.
          </p>
        </div>
        <DraftForm
          leadId={lead.id}
          leadName={lead.name}
          intakeNotes={lead.notes ?? ""}
          source={lead.source ?? null}
        />
      </section>

      {proposalList.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold tracking-tight">Proposals for this lead</h2>
          <ul className="mt-3 space-y-2">
            {proposalList.map((p: any) => (
              <li key={p.id} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      <ProposalStatusBadge status={p.status} />
                      <span className="ml-3 tabular-nums">${(p.total ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="mt-1 text-xs text-[var(--color-ink-muted)]">
                      {new Date(p.created_at).toLocaleString()}
                      {(p.flags ?? []).length > 0 && (
                        <span className="ml-2 text-[var(--color-warn)]">{(p.flags ?? []).length} item{(p.flags ?? []).length === 1 ? "" : "s"} flagged</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {p.status === "draft" && (
                      <DeleteDraftForm proposalId={p.id} />
                    )}
                    <Link
                      href={p.status === "draft" ? `/proposals/${p.id}/review` : `/proposals/${p.id}/sent`}
                      className="text-sm font-medium text-[var(--color-brand)] hover:underline"
                    >
                      {p.status === "draft" ? "Review draft →" : "View →"}
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ProposalStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-[var(--color-warn-soft)] text-[var(--color-warn)]",
    approved: "bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]",
    sent: "bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]",
  };
  const label = status === "draft" ? "Draft" : status === "approved" ? "Approved" : "Sent";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? ""}`}>
      {label}
    </span>
  );
}
