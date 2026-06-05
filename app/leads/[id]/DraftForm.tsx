"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { draftProposal } from "@/actions/proposals";

const EXAMPLE_NOTES = `Walked the backyard with Sarah today. About 600 sqft of patio space currently dirt — she wants travertine pavers, 24x24 if possible. Adding a cedar pergola, 12x12 over the seating area. Gas fire pit, basic, nothing fancy. Strip of premium turf for the kids, maybe 400 sqft. Path lighting along the new walkway, about 8 path lights. HOA submission needed — Camelback Country Club, board meets monthly. Site is flat, easy access from side gate.`;

export function DraftForm({ leadId }: { leadId: string }) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(formData: FormData) {
    const raw = String(formData.get("notes") ?? "");
    setError(null);
    startTransition(async () => {
      const result = await draftProposal(leadId, raw);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/proposals/${result.proposalId}/review`);
    });
  }

  return (
    <form action={onSubmit} className="mt-4 space-y-3">
      <textarea
        name="notes"
        rows={8}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Site walk notes — be specific on sizes, materials, constraints…"
        className="w-full rounded border border-stone-300 px-3 py-2 text-sm font-mono leading-relaxed focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setNotes(EXAMPLE_NOTES)}
          className="text-xs text-stone-500 underline hover:text-stone-800"
        >
          Insert example notes
        </button>
        <button
          type="submit"
          disabled={isPending || notes.trim().length < 20}
          className="rounded bg-emerald-700 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Drafting (15–25s)…" : "Draft Proposal"}
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {isPending && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Running 3-step pipeline: scope extraction (Sonnet) → line matching (Haiku) → narrative (Sonnet).
          This takes ~15–25 seconds. Hang tight.
        </div>
      )}
    </form>
  );
}
