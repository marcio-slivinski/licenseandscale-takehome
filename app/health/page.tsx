import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Check = { ok: boolean; ms?: number; error?: string };

async function runChecks(): Promise<{ db: Check; anthropic: Check; slack: Check; storage: Check }> {
  const checks: { db: Check; anthropic: Check; slack: Check; storage: Check } = {
    db: { ok: false },
    anthropic: { ok: false },
    slack: { ok: false },
    storage: { ok: false },
  };

  // DB
  try {
    const t0 = Date.now();
    const { error } = await supabaseAdmin.from("pricing_items").select("id").limit(1);
    checks.db = error ? { ok: false, error: error.message } : { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    checks.db = { ok: false, error: (e as Error).message };
  }

  // Anthropic key shape
  const hasKey = !!process.env.ANTHROPIC_API_KEY?.startsWith("sk-ant-");
  checks.anthropic = hasKey ? { ok: true } : { ok: false, error: "Key missing or malformed" };

  // Slack webhook configured
  checks.slack = process.env.SLACK_WEBHOOK_URL ? { ok: true } : { ok: false, error: "Webhook URL not set" };

  // Storage bucket
  try {
    const t0 = Date.now();
    const { error } = await supabaseAdmin.storage.from("proposal-pdfs").list("", { limit: 1 });
    checks.storage = error ? { ok: false, error: error.message } : { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    checks.storage = { ok: false, error: (e as Error).message };
  }

  return checks;
}

export default async function HealthPage() {
  const checks = await runChecks();
  const allOk = Object.values(checks).every((c) => c.ok);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-brand)]">← Dashboard</Link>
        <div className="mt-2 flex items-baseline gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">System</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${
            allOk
              ? "bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]"
              : "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
          }`}>
            {allOk ? "All systems good" : "Something needs attention"}
          </span>
        </div>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
          Live check on the pieces that have to work for the agent to draft a proposal.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-card)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-canvas)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Service</th>
              <th className="px-5 py-3 text-left font-medium">What it does</th>
              <th className="px-5 py-3 text-center font-medium">Status</th>
              <th className="px-5 py-3 text-right font-medium">Latency</th>
            </tr>
          </thead>
          <tbody>
            <Row name="Database" purpose="Stores leads, proposals, pricing catalog, audit log." check={checks.db} />
            <Row name="AI provider" purpose="Reads your notes and drafts the proposal text." check={checks.anthropic} />
            <Row name="PDF storage" purpose="Hosts the generated proposal PDFs." check={checks.storage} />
            <Row name="Slack" purpose="Pings you when a proposal is approved." check={checks.slack} />
          </tbody>
        </table>
      </div>

      <details className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)]">
        <summary className="cursor-pointer list-none border-b border-[var(--color-line)] px-5 py-3 text-sm font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]/50">
          Need the raw JSON? (for monitoring)
        </summary>
        <div className="p-5 text-xs text-[var(--color-ink-muted)]">
          Hit <code className="rounded bg-[var(--color-canvas)] px-1.5 py-0.5 font-mono">/api/health</code> for a machine-readable response. Returns 200 if all checks pass, 503 if anything is down.
        </div>
      </details>
    </div>
  );
}

function Row({ name, purpose, check }: { name: string; purpose: string; check: Check }) {
  return (
    <tr className="border-t border-[var(--color-line)]">
      <td className="px-5 py-3 font-medium">{name}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{purpose}</td>
      <td className="px-5 py-3 text-center">
        {check.ok ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-brand-dark)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" />
            Good
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-danger-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-danger)]" title={check.error}>
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-danger)]" />
            Down
          </span>
        )}
      </td>
      <td className="px-5 py-3 text-right tabular-nums text-[var(--color-ink-muted)]">
        {check.ms != null ? `${check.ms} ms` : "—"}
      </td>
    </tr>
  );
}
