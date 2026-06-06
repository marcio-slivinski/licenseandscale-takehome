"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteVoiceExemplars } from "@/actions/voice";

type Exemplar = {
  id: string;
  source_filename: string | null;
  content_length: number;
  uploaded_at: string;
};

export function ExemplarsList({ items, kind, searchable = false }: { items: Exemplar[]; kind: "proposal" | "voice_doc"; searchable?: boolean }) {
  const router = useRouter();
  const [list, setList] = useState<Exemplar[]>(items);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((i) => (i.source_filename ?? "").toLowerCase().includes(q));
  }, [list, query]);

  const allSelected = useMemo(
    () => filteredList.length > 0 && filteredList.every((c) => selected.has(c.id)),
    [filteredList, selected],
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
      // Deselect everything currently filtered
      setSelected((prev) => {
        const next = new Set(prev);
        filteredList.forEach((i) => next.delete(i.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredList.forEach((i) => next.add(i.id));
        return next;
      });
    }
  }

  function onDeleteSelected() {
    if (selected.size === 0) return;
    const label = kind === "proposal" ? "past proposal" : "writing sample";
    const msg = selected.size === list.length
      ? `Delete ALL ${list.length} ${label}s? The agent loses every example from this section.`
      : `Delete ${selected.size} ${label}${selected.size === 1 ? "" : "s"}? Cannot be undone.`;
    if (!confirm(msg)) return;

    const ids = Array.from(selected);
    setError(null);
    startTransition(async () => {
      const result = await deleteVoiceExemplars(ids);
      if (!result.ok) {
        setError(result.error ?? "Delete failed.");
        return;
      }
      setList((prev) => prev.filter((c) => !selected.has(c.id)));
      setSelected(new Set());
      router.refresh();
    });
  }

  if (list.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      {searchable && list.length > 5 && (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${kind === "proposal" ? "proposals" : "samples"} by filename…`}
          className="w-full rounded-md border border-[var(--color-line-strong)] bg-[var(--color-card)] px-3 py-2 text-sm placeholder:text-[var(--color-ink-muted)]"
        />
      )}
      <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-line)] bg-[var(--color-canvas)] px-3 py-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-3.5 w-3.5 rounded border-[var(--color-line-strong)] accent-[var(--color-brand)]"
          />
          <span className="text-[var(--color-ink-soft)]">
            {selected.size === 0
              ? query ? `Select ${filteredList.length} shown` : "Select all"
              : selected.size === list.length
              ? `All ${list.length} selected`
              : `${selected.size} of ${list.length} selected`}
          </span>
        </label>
        <button
          type="button"
          onClick={onDeleteSelected}
          disabled={isPending || selected.size === 0}
          className="rounded-md bg-[var(--color-danger)] px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? "Deleting…" : `Delete ${selected.size > 0 ? selected.size : "selected"}`}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-2 text-xs text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <ul className="max-h-[60vh] space-y-1.5 overflow-auto text-sm">
        {filteredList.map((item) => {
          const isSelected = selected.has(item.id);
          return (
            <li
              key={item.id}
              className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 transition ${
                isSelected ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]/40" : "border-[var(--color-line)]"
              }`}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(item.id)}
                  className="h-4 w-4 shrink-0 rounded border-[var(--color-line-strong)] accent-[var(--color-brand)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-[var(--color-ink)]" title={item.source_filename ?? undefined}>
                    {item.source_filename ?? "(unnamed)"}
                  </div>
                  <div className="text-xs text-[var(--color-ink-muted)]">
                    {item.content_length.toLocaleString()} characters · {new Date(item.uploaded_at).toLocaleDateString()}
                  </div>
                </div>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
