"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveProposal, type EditedLineItem } from "@/actions/proposals";
import type { ProposalFlag } from "@/lib/types";

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
};

export function ReviewClient({ proposalId, leadName, rawNotes, parsedScope, narrative: initialNarrative, lineItems: initialItems, total: initialTotal, flags }: Props) {
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
  const narrativeChanged = narrative !== initialNarrative;

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
    <div className="space-y-6">
      {flags.length > 0 && (
        <FlagPanel flags={flags} />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT: raw notes */}
        <section className="rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-200 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Raw site walk notes
          </div>
          <div className="max-h-[400px] overflow-auto p-4 text-sm whitespace-pre-wrap text-stone-700 leading-relaxed">
            {rawNotes || "—"}
          </div>
        </section>

        {/* MIDDLE: parsed scope */}
        <section className="rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-200 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Parsed scope (Sonnet)
          </div>
          <div className="max-h-[400px] overflow-auto p-4 text-xs font-mono text-stone-700">
            <pre className="whitespace-pre-wrap">{JSON.stringify(parsedScope, null, 2)}</pre>
          </div>
        </section>

        {/* RIGHT: total */}
        <section className="rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-200 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Investment summary
          </div>
          <div className="p-4 space-y-3">
            <div>
              <div className="text-xs text-stone-500">Client</div>
              <div className="font-medium">{leadName}</div>
            </div>
            <div className="border-t border-stone-100 pt-3">
              <div className="text-xs text-stone-500">Current total</div>
              <div className="text-2xl font-semibold tabular-nums">
                ${currentTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </div>
              {totalChanged && (
                <div className="mt-1 text-xs text-amber-700">
                  Changed from ${initialTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </div>
              )}
            </div>
            <div className="border-t border-stone-100 pt-3 text-xs text-stone-500">
              {items.filter((i) => !i.needs_review).length} of {items.length} items included
            </div>
          </div>
        </section>
      </div>

      {/* Line items table — editable */}
      <section className="rounded-lg border border-stone-200 bg-white overflow-hidden">
        <div className="border-b border-stone-200 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
          Matched line items (Haiku) — toggle, edit quantity
        </div>
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
            <tr>
              <th className="px-4 py-2 text-left">Scope → Match</th>
              <th className="px-4 py-2 text-right">Confidence</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Unit $</th>
              <th className="px-4 py-2 text-right">Subtotal</th>
              <th className="px-4 py-2 text-center">Include</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className={`border-t border-stone-100 ${item.needs_review ? "bg-amber-50/50" : ""}`}
              >
                <td className="px-4 py-3">
                  <div className="text-stone-900">{item.scope_description}</div>
                  <div className="text-xs text-stone-500">→ {item.item_name}</div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                    item.confidence >= 0.85 ? "bg-emerald-100 text-emerald-800" :
                    item.confidence >= 0.7 ? "bg-blue-100 text-blue-800" :
                    "bg-amber-100 text-amber-800"
                  }`}>
                    {(item.confidence * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <input
                    type="number" min={0} step="any"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) || 0 })}
                    className="w-20 rounded border border-stone-300 px-2 py-1 text-right text-sm tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="ml-1 text-xs text-stone-500">{item.unit}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                  ${item.unit_price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">
                  {item.needs_review ? <span className="text-stone-400">—</span> :
                    `$${(item.unit_price * item.quantity).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                  }
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={!item.needs_review}
                    onChange={(e) => updateItem(item.id, { needs_review: !e.target.checked })}
                    className="h-4 w-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-500"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Narrative — editable */}
      <section className="rounded-lg border border-stone-200 bg-white">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Proposal narrative (Sonnet, Marcus-voice) — edit inline
          </div>
          {narrativeChanged && (
            <div className="text-xs text-amber-700">
              Edits will be saved as voice training signal
            </div>
          )}
        </div>
        <textarea
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
          rows={14}
          className="w-full resize-y border-0 px-4 py-3 text-sm leading-relaxed text-stone-800 focus:outline-none focus:ring-0"
        />
      </section>

      {/* Approval bar */}
      <div className="sticky bottom-0 -mx-6 border-t border-stone-200 bg-white px-6 py-4 shadow-[0_-2px_8px_-2px_rgba(0,0,0,0.05)]">
        {error && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-stone-600">
            On approve: PDF generated, Slack notification fires, audit log written, edit corrections captured.
          </div>
          <button
            onClick={onApprove}
            disabled={isPending}
            className="rounded bg-emerald-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {isPending ? "Approving…" : "Approve & Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FlagPanel({ flags }: { flags: ProposalFlag[] }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="text-sm font-semibold text-amber-900">
        {flags.length} flag{flags.length === 1 ? "" : "s"} from guardrails
      </div>
      <ul className="mt-2 space-y-1 text-sm text-amber-900">
        {flags.map((f, i) => (
          <li key={i}>
            <span className="font-mono text-xs">{f.type}</span> · {f.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
