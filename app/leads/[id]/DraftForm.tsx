"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { draftProposal } from "@/actions/proposals";

const PROGRESS_MESSAGES = [
  "Reading your notes…",
  "Working out the scope…",
  "Matching items against your pricing…",
  "Writing the proposal in your voice…",
  "Almost done…",
];

type Props = {
  leadId: string;
  leadName: string;
  intakeNotes: string;
  source: string | null;
};

export function DraftForm({ leadId, leadName, intakeNotes, source }: Props) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState(0);
  const [messageIdx, setMessageIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);
  const router = useRouter();

  const exampleNotes = useMemo(
    () => buildExampleNotes(leadName, intakeNotes, source),
    [leadName, intakeNotes, source],
  );

  useEffect(() => {
    if (!isPending) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    startRef.current = Date.now();
    setProgress(0);
    setMessageIdx(0);

    intervalRef.current = setInterval(() => {
      const elapsedMs = Date.now() - startRef.current;
      const s = elapsedMs / 1000;

      let p: number;
      if (s <= 5) {
        p = (s / 5) * 70;
      } else if (s <= 15) {
        p = 70 + ((s - 5) / 10) * 27;
      } else {
        p = Math.min(99, 97 + (s - 15) / 5);
      }

      setProgress(p);
      setMessageIdx(Math.min(PROGRESS_MESSAGES.length - 1, Math.floor(s / 6)));
    }, 200);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPending]);

  function onSubmit(formData: FormData) {
    const raw = String(formData.get("notes") ?? "");
    setError(null);
    startTransition(async () => {
      const result = await draftProposal(leadId, raw);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setProgress(100);
      setTimeout(() => router.push(`/proposals/${result.proposalId}/review`), 250);
    });
  }

  const charCount = notes.trim().length;
  const canSubmit = !isPending && charCount >= 20;

  return (
    <form action={onSubmit} className="mt-4 space-y-3">
      <textarea
        name="notes"
        rows={9}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="What did you see? What did the client want? Sizes, materials, HOA, anything from your notes."
        className="w-full rounded-lg border border-[var(--color-line-strong)] px-4 py-3 text-sm leading-relaxed placeholder:text-[var(--color-ink-muted)] focus:border-[var(--color-brand)]"
        disabled={isPending}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setNotes(exampleNotes)}
            disabled={isPending}
            className="text-xs text-[var(--color-ink-muted)] underline underline-offset-2 hover:text-[var(--color-ink)]"
          >
            Try example notes for {firstName(leadName)}
          </button>
          <span className="text-xs text-[var(--color-ink-muted)]">{charCount} chars (need 20+)</span>
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-[var(--color-brand)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? "Working…" : "Draft proposal"}
        </button>
      </div>

      {isPending && (
        <div className="space-y-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--color-ink-soft)]">{PROGRESS_MESSAGES[messageIdx]}</span>
            <span className="tabular-nums text-xs font-medium text-[var(--color-ink-muted)]">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-canvas)]">
            <div
              className="h-full rounded-full bg-[var(--color-brand)]"
              style={{ width: `${progress}%`, transition: "width 200ms ease-out" }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}
    </form>
  );
}

function firstName(full: string): string {
  return (full ?? "").trim().split(/\s+/)[0] || "this lead";
}

/**
 * Build a plausible "site walk dictation" tailored to the lead's intake notes.
 *
 * Strategy: frame as Marcus's post-walk dictation, anchor on the lead's first name, then weave
 * intake notes back into Marcus's voice. If intake is empty, falls back to a generic Phoenix
 * backyard scope so the user can still test the flow.
 */
function buildExampleNotes(name: string, intake: string, source: string | null): string {
  const fn = firstName(name);
  const trimmed = intake.trim();

  if (!trimmed) {
    return `Walked the property with ${fn} today. Standard Phoenix backyard, about 500 sqft of patio space currently bare ground. Looking at travertine pavers, 24x24, maybe a cedar pergola, basic gas fire pit, and a strip of premium turf. Path lighting along the walkway. Site is flat, easy crew access.`;
  }

  const channelHint =
    source === "google_lsa" ? "Called in this morning, walked the property after lunch." :
    source === "meta_ads" ? "Reached out off the Meta form, walked the property today." :
    source === "referral" ? "Referral, walked the property today." :
    "Walked the property today.";

  return `${channelHint} ${fn}'s notes summary:

${trimmed}

My read on site:
- Confirmed the scope above. Sizes match what they described.
- Access is fine for the crew, normal Phoenix lot.
- Materials available, nothing custom-order on the catalog side.
- Adjust quantities or strike anything that does not match what you saw on the walk.`;
}
