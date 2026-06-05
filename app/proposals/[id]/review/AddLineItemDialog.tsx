"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { addLineItem, type AddedLineItem } from "@/actions/proposals";
import type { PricingItem } from "@/lib/types";

type Props = {
  proposalId: string;
  catalog: PricingItem[];
  onAdded: (item: AddedLineItem) => void;
};

export function AddLineItemDialog({ proposalId, catalog, onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((item) => {
      const haystack = `${item.category} ${item.item_name} ${item.description ?? ""} ${(item.tags ?? []).join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, catalog]);

  const selected = selectedId ? catalog.find((c) => c.id === selectedId) : null;

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setQuery("");
      setQuantity(1);
      setError(null);
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  function onAdd() {
    if (!selectedId || quantity <= 0) return;
    setError(null);
    startTransition(async () => {
      const result = await addLineItem(proposalId, selectedId, quantity);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onAdded(result.lineItem);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand-dark)]"
      >
        + Add item
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div
            ref={dialogRef}
            className="flex w-full max-w-2xl flex-col rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] shadow-2xl"
            style={{ maxHeight: "85vh" }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--color-line)] p-5">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Add an item</h3>
                <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                  Pick from your catalog. Prices come from there, can&apos;t edit them here.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-xl leading-none text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="px-5 pt-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, category, or tag…"
                className="w-full rounded-md border border-[var(--color-line-strong)] px-3 py-2 text-sm placeholder:text-[var(--color-ink-muted)]"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-auto px-5 py-3">
              {filtered.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--color-line-strong)] bg-[var(--color-canvas)] p-6 text-center text-sm text-[var(--color-ink-muted)]">
                  No items match. Try a different word.
                </div>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((item) => {
                    const isSelected = item.id === selectedId;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(item.id)}
                          className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition ${
                            isSelected
                              ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]"
                              : "border-transparent bg-[var(--color-canvas)] hover:border-[var(--color-line-strong)] hover:bg-[var(--color-card)]"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[var(--color-ink)]">{item.item_name}</span>
                              <span className="rounded-full bg-[var(--color-line)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-ink-soft)]">
                                {item.category.replace("_", " ")}
                              </span>
                            </div>
                            {item.description && (
                              <p className="mt-0.5 text-xs text-[var(--color-ink-muted)] line-clamp-1">{item.description}</p>
                            )}
                          </div>
                          <div className="shrink-0 text-right text-sm tabular-nums">
                            <div className="font-medium">${Number(item.unit_price).toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
                            <div className="text-xs text-[var(--color-ink-muted)]">per {item.unit.replace("_", " ")}</div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-[var(--color-line)] p-5">
              {selected ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{selected.item_name}</div>
                      <div className="text-xs text-[var(--color-ink-muted)]">
                        ${Number(selected.unit_price).toLocaleString("en-US", { maximumFractionDigits: 2 })} per {selected.unit.replace("_", " ")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="qty" className="text-xs text-[var(--color-ink-soft)]">Qty</label>
                      <input
                        id="qty"
                        type="number"
                        min={0.01}
                        step="any"
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                        className="w-20 rounded-md border border-[var(--color-line-strong)] px-2 py-1 text-right text-sm tabular-nums"
                      />
                      <span className="text-xs text-[var(--color-ink-muted)]">{selected.unit.replace("_", " ")}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-[var(--color-canvas)] px-3 py-2 text-sm">
                    <span className="text-[var(--color-ink-soft)]">Subtotal</span>
                    <span className="font-semibold tabular-nums">
                      ${(Number(selected.unit_price) * (Number.isFinite(quantity) ? quantity : 0)).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  {error && (
                    <div className="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-2 text-xs text-[var(--color-danger)]">
                      {error}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-md px-3 py-1.5 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={onAdd}
                      disabled={isPending || quantity <= 0}
                      className="rounded-md bg-[var(--color-brand)] px-4 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-50"
                    >
                      {isPending ? "Adding…" : "Add to proposal"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-sm text-[var(--color-ink-muted)]">
                  Pick an item above.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
