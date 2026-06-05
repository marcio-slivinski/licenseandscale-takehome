"use client";

import { useEffect, useRef, useState } from "react";
import { createLead } from "@/actions/proposals";

export function NewLeadDialog() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[var(--color-brand)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]"
      >
        + New lead
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div
            ref={dialogRef}
            className="w-full max-w-md rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Add a lead</h3>
                <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                  For walk-ins, referrals, or anything outside the Meta and Google funnel.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form action={createLead} className="space-y-3">
              <FormInput name="name" label="Full name" required />
              <FormInput name="email" label="Email" type="email" />
              <FormInput name="phone" label="Phone" />
              <FormInput name="project_address" label="Project address" placeholder="e.g., 8420 E Camelback Rd, Scottsdale" />
              <div>
                <label htmlFor="notes" className="block text-xs font-medium text-[var(--color-ink-soft)]">
                  Quick notes
                </label>
                <textarea
                  id="notes" name="notes" rows={3}
                  placeholder="Budget hints, HOA, timeline, how they found you…"
                  className="mt-1 w-full rounded-md border border-[var(--color-line-strong)] px-3 py-2 text-sm placeholder:text-[var(--color-ink-muted)]"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-4 py-2 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]"
                >
                  Add lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function FormInput({ name, label, type = "text", required, placeholder }: { name: string; label: string; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-medium text-[var(--color-ink-soft)]">
        {label}{required && <span className="text-[var(--color-danger)]"> *</span>}
      </label>
      <input
        id={name} name={name} type={type} required={required} placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-[var(--color-line-strong)] px-3 py-2 text-sm placeholder:text-[var(--color-ink-muted)]"
      />
    </div>
  );
}
