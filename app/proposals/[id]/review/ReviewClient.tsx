"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveProposal, type EditedLineItem } from "@/actions/proposals";
import type { ProposalFlag, PricingItem } from "@/lib/types";
import { AddLineItemDialog } from "./AddLineItemDialog";
import { SyncActions } from "./SyncActions";

type LineItem = {
  id: string;
  scope_description: string;
  item_name: string;
  category: string;
  unit: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  confidence: number;
  needs_review: boolean;
};

type Props = {
  proposalId: string;
  leadName: string;
  rawNotes: string;
  parsedScope: unknown;
  narrative: string;
  lineItems: LineItem[];
  total: number;
  flags: ProposalFlag[];
  catalog: PricingItem[];
};

export function ReviewClient({ proposalId, leadName, rawNotes, parsedScope: _parsedScope, narrative: initialNarrative, lineItems: initialItems, total: initialTotal, flags, catalog }: Props) {
  const router = useRouter();
  const [narrative, setNarrative] = useState(initialNarrative);
  const [items, setItems] = useState<LineItem[]>(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentTotal = useMemo(
    () => items.reduce((sum, i) => sum + (i.needs_review ? 0 : i.unit_price * i.quantity), 0),
    [items],
  );

  const totalChanged = Math.abs(currentTotal - initialTotal) > 0.01;
  const includedCount = items.filter((i) => !i.needs_review).length;

  function updateItem(id: string, patch: Partial<LineItem>) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, ...patch };
        next.subtotal = next.needs_review ? 0 : next.unit_price * next.quantity;
        return next;
      }),
    );
  }

  function onApprove() {
    setError(null);
    const edits: EditedLineItem[] = items.map((i) => ({
      id: i.id,
      quantity: i.quantity,
      needs_review: i.needs_review,
    }));

    startTransition(async () => {
      const result = await approveProposal(proposalId, narrative, edits);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/proposals/${proposalId}/sent`);
    });
  }

  return (
    <div className="space-y-6 pb-32">
      {flags.length > 0 && <FlagPanel flags={flags} />}

      <SyncActions proposalId={proposalId} />

      {/* Summary strip */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Client" value={leadName} />
        <SummaryCard
          label="Current total"
          value={`$${currentTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
          note={totalChanged ? `Was $${initialTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : undefined}
          accent
        />
        <SummaryCard
          label="Items included"
          value={`${includedCount} of ${items.length}`}
          note={items.length - includedCount > 0 ? `${items.length - includedCount} flagged for your review` : undefined}
        />
      </div>

      {/* Notes (collapsible-style read-only block) */}
      <details className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)]">
        <summary className="cursor-pointer list-none border-b border-[var(--color-line)] px-5 py-3 text-sm font-medium hover:bg-[var(--color-canvas)]/50">
          <span className="text-[var(--color-ink-soft)]">Your site walk notes</span>
          <span className="ml-2 text-xs text-[var(--color-ink-muted)]">(click to expand)</span>
        </summary>
        <div className="p-5 text-sm whitespace-pre-wrap text-[var(--color-ink-soft)] leading-relaxed">
          {rawNotes || "—"}
        </div>
      </details>

      {/* Line items */}
      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-line)] px-5 py-3">
          <div>
            <div className="text-sm font-semibold">Line items</div>
            <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
              Adjust quantities, uncheck anything you don&apos;t want on the proposal. Items in yellow weren&apos;t fully matched, double-check them.
            </p>
          </div>
          <AddLineItemDialog
            proposalId={proposalId}
            catalog={catalog}
            onAdded={(added) =>
              setItems((prev) => [
                ...prev,
                {
                  id: added.id,
                  scope_description: added.scope_description,
                  item_name: added.item_name,
                  category: added.category,
                  unit: added.unit,
                  quantity: added.quantity,
                  unit_price: added.unit_price,
                  subtotal: added.subtotal,
                  confidence: added.confidence,
                  needs_review: added.needs_review,
                },
              ])
            }
          />
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-canvas)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
            <tr>
              <th className="px-5 py-2.5 text-left font-medium">Item</th>
              <th className="px-5 py-2.5 text-right font-medium">Match</th>
              <th className="px-5 py-2.5 text-right font-medium">Qty</th>
              <th className="px-5 py-2.5 text-right font-medium">Unit price</th>
              <th className="px-5 py-2.5 text-right font-medium">Subtotal</th>
              <th className="px-5 py-2.5 text-center font-medium">Include</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className={`border-t border-[var(--color-line)] ${item.needs_review ? "bg-[var(--color-warn-soft)]/40" : ""}`}
              >
                <td className="px-5 py-3">
                  <div className="font-medium">{item.scope_description}</div>
                  <div className="text-xs text-[var(--color-ink-muted)]">→ {item.item_name}</div>
                </td>
                <td className="px-5 py-3 text-right">
                  <ConfidenceBadge value={item.confidence} />
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <input
                      type="number" min={0} step="any"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) || 0 })}
                      className="w-20 rounded-md border border-[var(--color-line-strong)] px-2 py-1 text-right text-sm tabular-nums"
                    />
                    <span className="text-xs text-[var(--color-ink-muted)]">{item.unit}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-[var(--color-ink-soft)]">
                  ${item.unit_price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </td>
                <td className="px-5 py-3 text-right tabular-nums font-medium">
                  {item.needs_review ? <span className="text-[var(--color-ink-muted)]">—</span> :
                    `$${(item.unit_price * item.quantity).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                  }
                </td>
                <td className="px-5 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={!item.needs_review}
                    onChange={(e) => updateItem(item.id, { needs_review: !e.target.checked })}
                    className="h-4 w-4 rounded border-[var(--color-line-strong)] accent-[var(--color-brand)]"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Narrative — editable */}
      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-3">
          <div>
            <div className="text-sm font-semibold">Proposal text</div>
            <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
              This goes on top of the proposal PDF. Edit anything that doesn&apos;t sound like you. Your edits train the system for next time.
            </p>
          </div>
          {narrative !== initialNarrative && (
            <span className="rounded-full bg-[var(--color-warn-soft)] px-2.5 py-1 text-xs font-medium text-[var(--color-warn)]">
              Saving as voice training
            </span>
          )}
        </div>
        <textarea
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
          rows={16}
          className="w-full resize-y border-0 px-5 py-4 text-sm leading-relaxed focus:outline-none focus:ring-0"
        />
      </section>

      {/* Approval bar — sticky */}
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-[var(--color-line)] bg-[var(--color-card)] shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.08)]">
        <div className="mx-auto max-w-6xl px-6 py-4">
          {error && (
            <div className="mb-3 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-3 text-sm text-[var(--color-danger)]">
              {error}
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-[var(--color-ink-soft)]">
              <span className="text-[var(--color-ink)] font-semibold tabular-nums">
                ${currentTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>{" "}
              · {includedCount} items
            </div>
            <button
              onClick={onApprove}
              disabled={isPending}
              className="rounded-md bg-[var(--color-brand)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-50"
            >
              {isPending ? "Sending…" : "Approve & Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, note, accent }: { label: string; value: string; note?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? "border-[var(--color-brand-soft)] bg-[var(--color-brand-soft)]" : "border-[var(--color-line)] bg-[var(--color-card)]"}`}>
      <div className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${accent ? "text-[var(--color-brand-dark)]" : "text-[var(--color-ink)]"}`}>{value}</div>
      {note && <div className="mt-1 text-xs text-[var(--color-warn)]">{note}</div>}
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  let cls = "bg-[var(--color-warn-soft)] text-[var(--color-warn)]";
  let label = "Check this";
  if (value >= 0.85) {
    cls = "bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]";
    label = "Strong";
  } else if (value >= 0.7) {
    cls = "bg-[var(--color-canvas)] text-[var(--color-ink-soft)]";
    label = "Good";
  }
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`} title={`${pct}% match confidence`}>
      {label}
    </span>
  );
}

function FlagPanel({ flags }: { flags: ProposalFlag[] }) {
  return (
    <div className="rounded-xl border border-[var(--color-warn)]/30 bg-[var(--color-warn-soft)] p-4">
      <div className="text-sm font-semibold text-[var(--color-warn)]">
        {flags.length} thing{flags.length === 1 ? "" : "s"} to double-check
      </div>
      <ul className="mt-2 space-y-1 text-sm text-[var(--color-ink-soft)]">
        {flags.map((f, i) => (
          <li key={i}>· {f.message}</li>
        ))}
      </ul>
    </div>
  );
}
