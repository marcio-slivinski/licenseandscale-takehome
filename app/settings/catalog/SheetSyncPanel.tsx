"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSheetUrl, syncFromSheet, type SheetSyncConfig } from "@/actions/catalog";
import type { ImportResult } from "@/actions/catalog";

export function SheetSyncPanel({ initialConfig }: { initialConfig: SheetSyncConfig }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialConfig.sheet_csv_url ?? "");
  const [savedUrl, setSavedUrl] = useState(initialConfig.sheet_csv_url ?? "");
  const [lastSyncedAt, setLastSyncedAt] = useState(initialConfig.last_synced_at);
  const [lastResult, setLastResult] = useState<ImportResult | null>(initialConfig.last_result);
  const [error, setError] = useState<string | null>(null);
  const [savingUrl, startSaveTransition] = useTransition();
  const [syncing, startSyncTransition] = useTransition();
  const [helperOpen, setHelperOpen] = useState(false);
  const [mirrorMode, setMirrorMode] = useState(false);

  const urlChanged = url.trim() !== savedUrl.trim();

  function onSaveUrl() {
    setError(null);
    startSaveTransition(async () => {
      const result = await setSheetUrl(url);
      if (!result.ok) {
        setError(result.error ?? "Save failed.");
        return;
      }
      setSavedUrl(url.trim());
    });
  }

  function onSyncNow() {
    if (mirrorMode) {
      if (!confirm(
        "Mirror mode will DELETE items from your catalog that are not in the sheet. Any item not in the sheet right now will be permanently removed. Continue?",
      )) return;
    }
    setError(null);
    startSyncTransition(async () => {
      const result = await syncFromSheet({ mirror: mirrorMode });
      setLastResult(result);
      setLastSyncedAt(new Date().toISOString());
      if (!result.ok) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Sync from your Google Sheet</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)] max-w-xl">
            Keep your existing pricing sheet as the source of truth. Update items there, click sync here.
            Sheet stays in your Drive, we pull the latest CSV on demand.
          </p>
        </div>
        <SyncStatus lastSyncedAt={lastSyncedAt} lastResult={lastResult} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
          className="rounded-md border border-[var(--color-line-strong)] px-3 py-2 text-sm placeholder:text-[var(--color-ink-muted)]"
          disabled={savingUrl || syncing}
        />
        <button
          onClick={onSaveUrl}
          disabled={savingUrl || syncing || !urlChanged}
          className="rounded-md border border-[var(--color-line-strong)] bg-[var(--color-card)] px-4 py-2 text-sm font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand-dark)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {savingUrl ? "Saving…" : urlChanged ? "Save URL" : "Saved"}
        </button>
        <button
          onClick={onSyncNow}
          disabled={savingUrl || syncing || !savedUrl}
          className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs">
        <input
          id="mirror-mode"
          type="checkbox"
          checked={mirrorMode}
          onChange={(e) => setMirrorMode(e.target.checked)}
          disabled={syncing}
          className="h-3.5 w-3.5 rounded border-[var(--color-line-strong)] accent-[var(--color-brand)]"
        />
        <label htmlFor="mirror-mode" className="cursor-pointer text-[var(--color-ink-soft)]">
          Mirror mode — delete items from the catalog if they&apos;re not in the sheet
        </label>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {lastResult?.ok && (lastResult.priceChanges?.length > 0 || lastResult.skipped.length > 0) && (
        <div className="mt-4 space-y-3 rounded-md bg-[var(--color-canvas)] p-4 text-xs">
          {lastResult.priceChanges?.length > 0 && (
            <details open>
              <summary className="cursor-pointer font-medium text-[var(--color-ink)]">
                Price changes ({lastResult.priceChanges.length})
              </summary>
              <ul className="mt-2 space-y-1 text-[var(--color-ink-soft)]">
                {lastResult.priceChanges.slice(0, 30).map((c, i) => (
                  <li key={i} className="flex items-baseline gap-2">
                    <span className="font-medium text-[var(--color-ink)]">{c.name}</span>
                    <span className="text-[var(--color-ink-muted)] line-through">${c.oldPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                    <span>→</span>
                    <span className="font-semibold text-[var(--color-brand-dark)]">${c.newPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                  </li>
                ))}
                {lastResult.priceChanges.length > 30 && (
                  <li className="text-[var(--color-ink-muted)]">…and {lastResult.priceChanges.length - 30} more.</li>
                )}
              </ul>
            </details>
          )}
          {lastResult.skipped.length > 0 && (
            <details>
              <summary className="cursor-pointer font-medium text-[var(--color-warn)]">
                Skipped rows ({lastResult.skipped.length})
              </summary>
              <ul className="mt-2 space-y-1 text-[var(--color-ink-soft)]">
                {lastResult.skipped.slice(0, 20).map((s) => (
                  <li key={s.row}>Row {s.row}: {s.reason}</li>
                ))}
                {lastResult.skipped.length > 20 && (
                  <li className="text-[var(--color-ink-muted)]">…and {lastResult.skipped.length - 20} more.</li>
                )}
              </ul>
            </details>
          )}
        </div>
      )}

      <button
        onClick={() => setHelperOpen(!helperOpen)}
        className="mt-4 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
      >
        {helperOpen ? "Hide" : "How to get the CSV URL from Google Sheets →"}
      </button>

      {helperOpen && (
        <div className="mt-3 space-y-2 rounded-md bg-[var(--color-canvas)] p-4 text-xs text-[var(--color-ink-soft)] leading-relaxed">
          <ol className="list-decimal list-inside space-y-1.5">
            <li>Open your pricing sheet in Google Sheets.</li>
            <li>File → Share → <strong className="font-semibold">Publish to web</strong>.</li>
            <li>In the dialog: pick the specific tab if you have multiple. Format: <strong className="font-semibold">Comma-separated values (.csv)</strong>.</li>
            <li>Click <strong className="font-semibold">Publish</strong>. Confirm the warning.</li>
            <li>Copy the URL Google gives you (ends in <code className="rounded bg-white px-1">/pub?output=csv</code>).</li>
            <li>Paste it above, click Save URL, then Sync now.</li>
          </ol>
          <div className="pt-2 border-t border-[var(--color-line)] text-[var(--color-ink-muted)]">
            <strong className="font-semibold text-[var(--color-warn)]">Heads up:</strong> the URL is publicly readable — anyone with it can see the CSV. Treat it like a semi-public link.
            For a private setup, switch to Google Sheets API + service account (in our roadmap).
          </div>
          <div className="pt-2 text-[var(--color-ink-muted)]">
            <strong className="font-semibold">Required columns</strong> (header row, case-insensitive): <code className="rounded bg-white px-1">category, item_name, description, unit, unit_price, tags</code>.
            <br />
            Existing items match by name (case-insensitive) and update. New names insert. Bad rows skip with a reason.
          </div>
        </div>
      )}
    </section>
  );
}

function SyncStatus({ lastSyncedAt, lastResult }: { lastSyncedAt: string | null; lastResult: ImportResult | null }) {
  if (!lastSyncedAt) {
    return (
      <div className="shrink-0 text-right">
        <div className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">Last sync</div>
        <div className="mt-1 text-sm text-[var(--color-ink-muted)]">Never</div>
      </div>
    );
  }

  const ok = lastResult?.ok ?? false;
  const summary = lastResult?.ok
    ? [
        lastResult.inserted > 0 ? `${lastResult.inserted} new` : null,
        lastResult.updated > 0 ? `${lastResult.updated} updated` : null,
        lastResult.priceChanges?.length > 0 ? `${lastResult.priceChanges.length} price changes` : null,
        lastResult.purged > 0 ? `${lastResult.purged} deleted` : null,
        lastResult.skipped.length > 0 ? `${lastResult.skipped.length} skipped` : null,
      ].filter(Boolean).join(" · ") || "no changes"
    : lastResult?.error
    ? `Error: ${lastResult.error.slice(0, 60)}${lastResult.error.length > 60 ? "…" : ""}`
    : "Status unknown";

  return (
    <div className="shrink-0 text-right">
      <div className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">Last sync</div>
      <div className="mt-1 text-sm text-[var(--color-ink)]">
        {timeAgo(lastSyncedAt)}
      </div>
      <div className={`mt-0.5 text-xs ${ok ? "text-[var(--color-brand-dark)]" : "text-[var(--color-danger)]"}`}>
        {summary}
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const seconds = Math.floor((Date.now() - t) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}
