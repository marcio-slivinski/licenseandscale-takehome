"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importSentProposalsAsExemplars } from "@/actions/voice";

export function ImportSentButton() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onClick() {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      const result = await importSentProposalsAsExemplars();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.imported === 0 && result.skipped === 0) {
        setStatus("No sent proposals yet.");
      } else if (result.imported === 0) {
        setStatus(`Already up to date — ${result.skipped} sent proposal${result.skipped === 1 ? "" : "s"} already imported.`);
      } else {
        setStatus(
          `Imported ${result.imported} sent proposal${result.imported === 1 ? "" : "s"}${
            result.skipped > 0 ? ` · ${result.skipped} already in training` : ""
          }`,
        );
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="rounded-md border border-[var(--color-line-strong)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand-dark)] disabled:opacity-50"
        title="Pull every sent proposal from the dashboard and add it as a training example. Skips proposals already imported."
      >
        {isPending ? "Importing…" : "Import sent proposals as training"}
      </button>
      {status && <p className="mt-2 text-xs text-[var(--color-brand-dark)]">{status}</p>}
      {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
