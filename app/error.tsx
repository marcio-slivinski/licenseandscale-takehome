"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6">
      <h2 className="text-lg font-semibold text-red-900">Something broke</h2>
      <p className="mt-2 text-sm text-red-800">{error.message}</p>
      {error.digest && <p className="mt-1 text-xs font-mono text-red-700">digest: {error.digest}</p>}
      <button onClick={() => reset()} className="mt-4 rounded bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800">
        Try again
      </button>
    </div>
  );
}
