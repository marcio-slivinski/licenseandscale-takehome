"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDraft } from "@/actions/proposals";

export function DeleteDraftForm({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm("Delete this draft? Your edits to it will be gone.")) return;
    startTransition(async () => {
      const result = await deleteDraft(proposalId);
      if (!result.ok) {
        alert(result.error ?? "Delete failed.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={isPending}
      className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-danger)] disabled:opacity-50"
    >
      {isPending ? "Deleting…" : "Delete"}
    </button>
  );
}
