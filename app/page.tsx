import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { NewLeadDialog } from "./NewLeadDialog";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [{ data: leadsRaw }, { data: proposalsRaw }] = await Promise.all([
    supabaseAdmin
      .from("leads")
      .select("id, name, project_address, source, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("proposals")
      .select("id, lead_id, status, total, created_at, leads(name, project_address)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const allLeads = leadsRaw ?? [];
  const allProposals = (proposalsRaw ?? []) as any[];

  const doneLeadIds = new Set(
    allProposals.filter((p) => p.status === "approved" || p.status === "sent").map((p) => p.lead_id),
  );

  const draftByLead = new Map<string, any>();
  for (const p of allProposals) {
    if (p.status === "draft" && !draftByLead.has(p.lead_id)) draftByLead.set(p.lead_id, p);
  }

  // Qualification scoring: source intent + notes richness + budget/HOA signals.
  // Sort highest score first, then oldest (FIFO for ties) so nothing waits too long.
  const pendingLeads = allLeads
    .filter((l) => !doneLeadIds.has(l.id))
    .map((l) => ({ ...l, _score: scoreLead(l) }))
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  const sentProposals = allProposals.filter((p) => p.status === "approved" || p.status === "sent");

  return (
    <div className="space-y-12">
      {/* Page header w/ stats + new-lead button */}
      <div className="flex items-end justify-between border-b border-[var(--color-line)] pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Waiting Proposal</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Leads from your ads, calls, and referrals that still need a proposal. Sorted by qualification, oldest first when tied.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatBadge label="Pending" value={pendingLeads.length} />
          <StatBadge label="Sent" value={sentProposals.length} accent />
          <NewLeadDialog />
        </div>
      </div>

      {/* Leads waiting on proposal */}
      <section>
        <div className="mb-4">
          <p className="text-sm text-[var(--color-ink-soft)]">
            Click a lead, paste your site walk notes, draft a proposal in your voice.
          </p>
        </div>

        <div className="space-y-3">
          {pendingLeads.length === 0 ? (
            <EmptyCard>
              Nothing waiting. All leads have proposals sent.
            </EmptyCard>
          ) : (
            pendingLeads.map((l) => {
              const draft = draftByLead.get(l.id);
              const quality = qualityLabel(l._score);
              return (
                <Link
                  key={l.id}
                  href={draft ? `/proposals/${draft.id}/review` : `/leads/${l.id}`}
                  className="block rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 hover:border-[var(--color-brand)] hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-base font-semibold text-[var(--color-ink)]">{l.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${quality.cls}`} title={`Qualification score ${l._score}`}>
                          {quality.label}
                        </span>
                        {l.source && <SourceTag source={l.source} />}
                        <span className="text-xs text-[var(--color-ink-muted)]" title={new Date(l.created_at).toLocaleString()}>
                          {relativeTime(l.created_at)}
                        </span>
                      </div>
                      {l.project_address && (
                        <div className="mt-1 text-sm text-[var(--color-ink-muted)]">{l.project_address}</div>
                      )}
                      {l.notes && (
                        <p className="mt-2 text-sm text-[var(--color-ink-soft)] line-clamp-2">
                          {l.notes}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {draft ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-warn-soft)] px-3 py-1 text-xs font-medium text-[var(--color-warn)]">
                          Draft ready · Review →
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-[var(--color-brand)]">Open →</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>

      {sentProposals.length > 0 && (
        <div className="text-center">
          <Link href="/sent" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-brand)]">
            See {sentProposals.length} sent proposal{sentProposals.length === 1 ? "" : "s"} →
          </Link>
        </div>
      )}
    </div>
  );
}

function scoreLead(lead: { source: string | null; notes: string | null }): number {
  let score = 0;
  const source = lead.source ?? "";
  if (source === "referral") score += 100;
  else if (source === "google_lsa") score += 80;
  else if (source === "meta_ads") score += 60;
  else if (source === "manual") score += 40;
  else score += 20;

  const notes = lead.notes ?? "";
  if (notes.length > 200) score += 30;
  else if (notes.length > 100) score += 20;
  else if (notes.length > 50) score += 10;

  // Budget signal
  if (/\$|budget|\bk\b|premium/i.test(notes)) score += 15;
  // Detail signals
  if (/hoa|permit|architect/i.test(notes)) score += 10;
  // Timeline signals
  if (/asap|urgent|before|by\s+\w+/i.test(notes)) score += 10;

  return score;
}

function qualityLabel(score: number): { label: string; cls: string } {
  if (score >= 130) return { label: "Hot", cls: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]" };
  if (score >= 90) return { label: "Strong", cls: "bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]" };
  if (score >= 60) return { label: "Warm", cls: "bg-[var(--color-warn-soft)] text-[var(--color-warn)]" };
  return { label: "Cold", cls: "bg-[var(--color-canvas)] text-[var(--color-ink-soft)]" };
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const seconds = Math.floor((Date.now() - t) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  const days = Math.floor(seconds / 86400);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatBadge({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-lg border px-4 py-2 ${accent ? "border-[var(--color-brand-soft)] bg-[var(--color-brand-soft)]" : "border-[var(--color-line)] bg-[var(--color-card)]"}`}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${accent ? "text-[var(--color-brand-dark)]" : "text-[var(--color-ink)]"}`}>{value}</div>
    </div>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-line-strong)] bg-[var(--color-canvas)] p-8 text-center text-sm text-[var(--color-ink-muted)]">
      {children}
    </div>
  );
}

function SourceTag({ source }: { source: string }) {
  const label = source === "meta_ads" ? "Meta Ads" : source === "google_lsa" ? "Google LSA" : source === "manual" ? "Manual" : source === "referral" ? "Referral" : source;
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--color-canvas)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-ink-soft)]">
      {label}
    </span>
  );
}
