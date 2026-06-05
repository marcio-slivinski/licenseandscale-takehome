"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadVoiceFile } from "@/actions/voice";

export function VoiceUpload({ type, accept }: { type: "proposal" | "voice_doc"; accept: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setStatus(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();

    startTransition(async () => {
      const result = await uploadVoiceFile(type, file.name, buffer, []);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatus(`Saved · ${result.charCount.toLocaleString()} characters loaded`);
      router.refresh();
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div>
      <label className={`block cursor-pointer rounded-lg border-2 border-dashed bg-[var(--color-canvas)] px-4 py-6 text-center text-sm transition ${
        isPending ? "border-[var(--color-brand)] text-[var(--color-brand-dark)]" : "border-[var(--color-line-strong)] text-[var(--color-ink-soft)] hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]"
      }`}>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={onChange}
          disabled={isPending}
          className="hidden"
        />
        {isPending ? "Reading the file…" : (
          <>
            <div className="font-medium">Click or drop a file</div>
            <div className="mt-1 text-xs text-[var(--color-ink-muted)]">{accept.split(",").join(" · ")}</div>
          </>
        )}
      </label>
      {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
      {status && <p className="mt-2 text-xs text-[var(--color-brand-dark)]">{status}</p>}
    </div>
  );
}
