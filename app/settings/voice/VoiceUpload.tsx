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
      setStatus(`Saved ${result.charCount.toLocaleString()} chars`);
      router.refresh();
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div>
      <label className="block cursor-pointer rounded border border-dashed border-stone-300 bg-stone-50 px-3 py-4 text-center text-sm text-stone-600 hover:border-emerald-500 hover:bg-emerald-50">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={onChange}
          disabled={isPending}
          className="hidden"
        />
        {isPending ? "Parsing…" : `Drop ${accept} file or click to upload`}
      </label>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      {status && <p className="mt-2 text-xs text-emerald-700">{status}</p>}
    </div>
  );
}
