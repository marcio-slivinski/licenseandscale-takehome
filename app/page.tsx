import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { createLead } from "@/actions/proposals";

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

  // A lead is "done" once it has at least one approved or sent proposal.
  const doneLeadIds = new Set(
    allProposals.filter((p) => p.status === "approved" || p.status === "sent").map((p) => p.lead_id),
  );

  // Pending leads: no approved/sent proposal yet — these need a proposal drafted.
  // Each pending lead may have a draft in progress; surface that.
  const draftByLead = new Map<string, any>();
  for (const p of allProposals) {
    if (p.status === "draft" && !draftByLead.has(p.lead_id)) draftByLead.set(p.lead_id, p);
  }
  const pendingLeads = allLeads.filter((l) => !doneLeadIds.has(l.id));
  const sentProposals = allProposals.filter((p) => p.status === "approved" || p.status === "sent");

  return (
    <div className="space-y-12">
      {/* Page header */}
      <div className="flex items-end justify-between border-b border-[var(--color-line)] pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            New leads come in from your ads, calls, and referrals. Draft a proposal in 30 seconds, review, send.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatBadge label="Pending" value={pendingLeads.length} />
          <StatBadge label="Sent" value={sentProposals.length} accent />
        </div>
      </div>

      {/* Leads that need a proposal */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Leads waiting on a proposal</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Click a lead, paste your site walk notes, and the agent drafts your proposal in Marcus&apos;s voice.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            {pendingLeads.length === 0 ? (
              <EmptyCard>
                Nothing waiting. All leads have proposals sent.
              </EmptyCard>
            ) : (
              pendingLeads.map((l) => {
                const draft = draftByLead.get(l.id);
                return (
                  <Link
                    key={l.id}
                    href={draft ? `/proposals/${draft.id}/review` : `/leads/${l.id}`}
                    className="block rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 hover:border-[var(--color-brand)] hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="text-base font-semibold text-[var(--color-ink)]">{l.name}</span>
                          {l.source && <SourceTag source={l.source} />}
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
                          <span className="text-sm text-[var(--color-brand)]">Open →</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* New lead — manual entry */}
          <form action={createLead} className="h-fit rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">Add lead manually</h3>
              <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                Use this for walk-ins, referrals, or anything outside your normal ad funnel.
              </p>
            </div>
            <FormInput name="name" label="Full name" required />
            <FormInput name="email" label="Email" type="email" />
            <FormInput name="phone" label="Phone" />
            <FormInput name="project_address" label="Project address" placeholder="e.g., 8420 E Camelback Rd, Scottsdale" />
            <div>
              <label htmlFor="notes" className="block text-xs font-medium text-[var(--color-ink-soft)]">
                Quick notes
              </label>
              <textarea
                id="notes" name="notes" rows={3}
                placeholder="Budget hints, HOA, timeline, how they found you…"
                className="mt-1 w-full rounded-md border border-[var(--color-line-strong)] px-3 py-2 text-sm placeholder:text-[var(--color-ink-muted)]"
              />
            </div>
            <button type="submit" className="w-full rounded-md bg-[var(--color-brand)] px-3 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]">
              Add Lead
            </button>
          </form>
        </div>
      </section>

      {/* Sent proposals */}
      {sentProposals.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-tight">Sent proposals</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Approved and sent to the client. PDF stored, Slack notified.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-card)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-canvas)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Client</th>
                  <th className="px-5 py-3 text-left font-medium">Project</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                  <th className="px-5 py-3 text-right font-medium">Sent</th>
                  <th className="px-5 py-3 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {sentProposals.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--color-line)] hover:bg-[var(--color-canvas)]/50">
                    <td className="px-5 py-3 font-medium">{p.leads?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-[var(--color-ink-soft)]">{p.leads?.project_address ?? "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium">
                      ${(p.total ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-5 py-3 text-right text-[var(--color-ink-muted)]">
                      {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/proposals/${p.id}/sent`} className="text-[var(--color-brand)] hover:underline">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function StatBadge({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-lg border px-4 py-2 ${accent ? "border-[var(--color-brand-soft)] bg-[var(--color-brand-soft)]" : "border-[var(--color-line)] bg-[var(--color-card)]"}`}>
      <div className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${accent ? "text-[var(--color-brand-dark)]" : "text-[var(--color-ink)]"}`}>{value}</div>
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

function FormInput({ name, label, type = "text", required, placeholder }: { name: string; label: string; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-medium text-[var(--color-ink-soft)]">
        {label}{required && <span className="text-[var(--color-danger)]"> *</span>}
      </label>
      <input
        id={name} name={name} type={type} required={required} placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-[var(--color-line-strong)] px-3 py-2 text-sm placeholder:text-[var(--color-ink-muted)]"
      />
    </div>
  );
}
