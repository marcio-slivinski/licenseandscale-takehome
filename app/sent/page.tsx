import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function SentProposalsPage() {
  const { data: proposalsRaw } = await supabaseAdmin
    .from("proposals")
    .select("id, lead_id, status, total, created_at, approved_at, leads(name, project_address)")
    .in("status", ["approved", "sent"])
    .order("approved_at", { ascending: false, nullsFirst: false })
    .limit(200);

  const proposals = (proposalsRaw ?? []) as any[];

  const totalValue = proposals.reduce((sum, p) => sum + Number(p.total ?? 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between border-b border-[var(--color-line)] pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Sent proposals</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Approved and sent to the client. PDF saved, Slack notified. Prices frozen at the moment of send.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatBadge label="Count" value={proposals.length.toString()} />
          <StatBadge label="Total" value={`$${totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`} accent />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-card)]">
        {proposals.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--color-ink-muted)]">
            Nothing sent yet. Approve a draft and it lands here.
          </div>
        ) : (
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
              {proposals.map((p) => (
                <tr key={p.id} className="border-t border-[var(--color-line)] hover:bg-[var(--color-canvas)]/50">
                  <td className="px-5 py-3 font-medium">{p.leads?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-[var(--color-ink-soft)]">{p.leads?.project_address ?? "—"}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium">
                    ${(p.total ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-5 py-3 text-right text-[var(--color-ink-muted)]" title={p.approved_at ? new Date(p.approved_at).toLocaleString() : ""}>
                    {p.approved_at ? new Date(p.approved_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
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
        )}
      </div>
    </div>
  );
}

function StatBadge({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border px-4 py-2 ${accent ? "border-[var(--color-brand-soft)] bg-[var(--color-brand-soft)]" : "border-[var(--color-line)] bg-[var(--color-card)]"}`}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${accent ? "text-[var(--color-brand-dark)]" : "text-[var(--color-ink)]"}`}>{value}</div>
    </div>
  );
}
