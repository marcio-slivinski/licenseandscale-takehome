"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteVoiceExemplars } from "@/actions/voice";

type Correction = {
  id: string;
  uploaded_at: string;
  metadata: { original?: string; edited?: string } | null;
};

export function CorrectionsManager({ initialCorrections, searchable = false }: { initialCorrections: Correction[]; searchable?: boolean }) {
  const router = useRouter();
  const [corrections, setCorrections] = useState<Correction[]>(initialCorrections);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return corrections;
    return corrections.filter((c) => {
      const meta = c.metadata ?? {};
      const hay = `${meta.original ?? ""} ${meta.edited ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [corrections, query]);

  const allSelected = useMemo(
    () => filtered.length > 0 && filtered.every((c) => selected.has(c.id)),
    [filtered, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((c) => next.delete(c.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((c) => next.add(c.id));
        return next;
      });
    }
  }

  function onDeleteSelected() {
    if (selected.size === 0) return;
    const msg = selected.size === corrections.length
      ? `Delete ALL ${corrections.length} edit corrections? The agent forgets everything it has learned from your edits.`
      : `Delete ${selected.size} edit correction${selected.size === 1 ? "" : "s"}? Cannot be undone.`;
    if (!confirm(msg)) return;

    const ids = Array.from(selected);
    setError(null);
    startTransition(async () => {
      const result = await deleteVoiceExemplars(ids);
      if (!result.ok) {
        setError(result.error ?? "Delete failed.");
        return;
      }
      setCorrections((prev) => prev.filter((c) => !selected.has(c.id)));
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Edits we&apos;ve learned from</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Every time you change a draft and approve it, we save the before-and-after here. The next draft sees these examples.
          </p>
        </div>
        <span className="text-sm text-[var(--color-ink-muted)]">{corrections.length} captured</span>
      </div>

      {corrections.length > 0 && (
        <>
          {searchable && corrections.length > 5 && (
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search corrections by text…"
              className="mt-3 w-full rounded-md border border-[var(--color-line-strong)] bg-[var(--color-card)] px-3 py-2 text-sm placeholder:text-[var(--color-ink-muted)]"
            />
          )}
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] px-4 py-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-[var(--color-line-strong)] accent-[var(--color-brand)]"
              />
              <span className="text-[var(--color-ink-soft)]">
                {selected.size === 0 ? (query ? `Select ${filtered.length} shown` : "Select all") : selected.size === corrections.length ? `All ${corrections.length} selected` : `${selected.size} of ${corrections.length} selected`}
              </span>
            </label>
            <button
              type="button"
              onClick={onDeleteSelected}
              disabled={isPending || selected.size === 0}
              className="rounded-md bg-[var(--color-danger)] px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? "Deleting…" : `Delete ${selected.size > 0 ? selected.size : "selected"}`}
            </button>
          </div>
        </>
      )}

      {error && (
        <div className="mt-3 rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <ul className="mt-3 max-h-[60vh] space-y-3 overflow-auto">
        {corrections.length === 0 ? (
          <li className="rounded-xl border border-dashed border-[var(--color-line-strong)] bg-[var(--color-canvas)] p-8 text-center text-sm text-[var(--color-ink-muted)]">
            No edits saved yet. Approve a draft with some changes and it&apos;ll show up here.
          </li>
        ) : (
          filtered.map((c) => {
            const meta = c.metadata ?? {};
            const isSelected = selected.has(c.id);
            return (
              <li
                key={c.id}
                className={`rounded-xl border bg-[var(--color-card)] p-5 text-sm transition ${
                  isSelected ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]/30" : "border-[var(--color-line)]"
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--color-ink-muted)]">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(c.id)}
                      className="h-4 w-4 rounded border-[var(--color-line-strong)] accent-[var(--color-brand)]"
                    />
                    <span>{new Date(c.uploaded_at).toLocaleString()}</span>
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-danger)]">Draft</div>
                    <p className="mt-1 text-[var(--color-ink-soft)] line-clamp-4">{meta.original ?? "—"}</p>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-brand-dark)]">Your version</div>
                    <p className="mt-1 text-[var(--color-ink)] line-clamp-4">{meta.edited ?? "—"}</p>
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
