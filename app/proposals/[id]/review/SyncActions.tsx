"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshDraftPrices, regenerateDraft } from "@/actions/proposals";

type Props = { proposalId: string };

export function SyncActions({ proposalId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onRefreshPrices() {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      const result = await refreshDraftPrices(proposalId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatus(
        result.missing > 0
          ? `${result.updated} prices refreshed · ${result.missing} items have no catalog link (skipped)`
          : `${result.updated} prices refreshed from current catalog`,
      );
      router.refresh();
    });
  }

  function onRegenerate() {
    setError(null);
    setStatus(null);
    setConfirmRegenerate(false);
    startTransition(async () => {
      const result = await regenerateDraft(proposalId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatus("Draft regenerated from your original notes.");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Catalog changed?</h3>
          <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
            If you updated prices or added items since this draft was created, refresh or regenerate.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onRefreshPrices}
            disabled={isPending}
            className="rounded-md border border-[var(--color-line-strong)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand-dark)] disabled:opacity-50"
            title="Update unit prices on existing items from current catalog. Your edits (qty, narrative) are preserved."
          >
            {isPending ? "…" : "Refresh prices"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmRegenerate(true)}
            disabled={isPending}
            className="rounded-md border border-[var(--color-line-strong)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand-dark)] disabled:opacity-50"
            title="Re-run the agent from your original site walk notes with the latest catalog. Your edits get wiped."
          >
            {isPending ? "…" : "Regenerate from notes"}
          </button>
        </div>
      </div>

      {status && (
        <div className="mt-3 rounded-md bg-[var(--color-brand-soft)] px-3 py-2 text-xs text-[var(--color-brand-dark)]">
          {status}
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-3 py-2 text-xs text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {confirmRegenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold tracking-tight">Regenerate from notes?</h3>
            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
              We&apos;ll re-run the full draft from your original site walk notes against the latest catalog.
              This will <strong className="font-semibold text-[var(--color-warn)]">wipe any edits</strong> you&apos;ve made
              to quantities, the narrative, or include/exclude toggles. Takes about 30 seconds.
            </p>
            <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
              If you only want to update prices and keep your edits, use <em>Refresh prices</em> instead.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmRegenerate(false)}
                className="rounded-md px-4 py-2 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]"
              >
                Cancel
              </button>
              <button
                onClick={onRegenerate}
                disabled={isPending}
                className="rounded-md bg-[var(--color-warn)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Yes, regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
