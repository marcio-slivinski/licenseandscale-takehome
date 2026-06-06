"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadVoiceFile } from "@/actions/voice";

type FileStatus = {
  name: string;
  status: "pending" | "uploading" | "done" | "error";
  chars?: number;
  error?: string;
};

const CONCURRENCY = 3;

export function VoiceUpload({ type, accept }: { type: "proposal" | "voice_doc"; accept: string }) {
  const router = useRouter();
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = Array.from(e.target.files ?? []);
    if (fileList.length === 0) return;

    const initial: FileStatus[] = fileList.map((f) => ({ name: f.name, status: "pending" }));
    setFiles(initial);

    startTransition(async () => {
      await processBatch(fileList, type);
      router.refresh();
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  async function processBatch(fileList: File[], targetType: "proposal" | "voice_doc") {
    const queue = fileList.map((f, idx) => ({ file: f, idx }));
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker(queue, targetType));
    await Promise.all(workers);
  }

  async function worker(queue: Array<{ file: File; idx: number }>, targetType: "proposal" | "voice_doc") {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      setFiles((prev) => prev.map((f, i) => (i === next.idx ? { ...f, status: "uploading" } : f)));
      try {
        const buffer = await next.file.arrayBuffer();
        const result = await uploadVoiceFile(targetType, next.file.name, buffer, []);
        setFiles((prev) =>
          prev.map((f, i) =>
            i === next.idx
              ? result.ok
                ? { ...f, status: "done", chars: result.charCount }
                : { ...f, status: "error", error: result.error }
              : f,
          ),
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((f, i) => (i === next.idx ? { ...f, status: "error", error: (err as Error).message } : f)),
        );
      }
    }
  }

  const done = files.filter((f) => f.status === "done").length;
  const errored = files.filter((f) => f.status === "error").length;
  const inProgress = files.filter((f) => f.status === "uploading" || f.status === "pending").length;

  return (
    <div>
      <label
        className={`block cursor-pointer rounded-lg border-2 border-dashed bg-[var(--color-canvas)] px-4 py-6 text-center text-sm transition ${
          isPending
            ? "border-[var(--color-brand)] text-[var(--color-brand-dark)]"
            : "border-[var(--color-line-strong)] text-[var(--color-ink-soft)] hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          onChange={onChange}
          disabled={isPending}
          className="hidden"
        />
        {isPending ? (
          <div>
            <div className="font-medium">Uploading {done + errored} of {files.length}…</div>
            <div className="mt-1 text-xs text-[var(--color-ink-muted)]">{inProgress} in queue</div>
          </div>
        ) : (
          <>
            <div className="font-medium">Click or drop files</div>
            <div className="mt-1 text-xs text-[var(--color-ink-muted)]">
              {accept.split(",").join(" · ")} — multiple files OK
            </div>
          </>
        )}
      </label>

      {files.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {!isPending && (
            <div className="flex items-center justify-between rounded-md bg-[var(--color-canvas)] px-3 py-2 text-xs">
              <span className="font-medium text-[var(--color-ink)]">
                {done > 0 ? `${done} saved` : null}
                {done > 0 && errored > 0 ? " · " : ""}
                {errored > 0 ? <span className="text-[var(--color-danger)]">{errored} failed</span> : null}
              </span>
              <button
                type="button"
                onClick={() => setFiles([])}
                className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              >
                Clear
              </button>
            </div>
          )}
          <ul className="max-h-48 space-y-1 overflow-auto text-xs">
            {files.map((f, i) => (
              <li
                key={i}
                className={`flex items-center justify-between rounded border px-2.5 py-1.5 ${
                  f.status === "done"
                    ? "border-[var(--color-brand-soft)] bg-[var(--color-brand-soft)]/40 text-[var(--color-brand-dark)]"
                    : f.status === "error"
                    ? "border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
                    : f.status === "uploading"
                    ? "border-[var(--color-warn)]/30 bg-[var(--color-warn-soft)] text-[var(--color-warn)]"
                    : "border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-ink-soft)]"
                }`}
              >
                <span className="truncate font-medium" title={f.name}>{f.name}</span>
                <span className="shrink-0 ml-2 text-[10px] uppercase tracking-wider">
                  {f.status === "done" && f.chars != null
                    ? `${f.chars.toLocaleString()} chars`
                    : f.status === "error"
                    ? f.error?.slice(0, 40) ?? "Failed"
                    : f.status === "uploading"
                    ? "Uploading"
                    : "Queued"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
