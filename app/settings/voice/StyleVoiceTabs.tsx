"use client";

import { useState, type ReactNode } from "react";

type TabKey = "upload" | "database";

export function StyleVoiceTabs({
  uploadContent,
  databaseContent,
  counts,
}: {
  uploadContent: ReactNode;
  databaseContent: ReactNode;
  counts: { proposals: number; voiceDocs: number; corrections: number };
}) {
  const [tab, setTab] = useState<TabKey>("upload");
  const total = counts.proposals + counts.voiceDocs + counts.corrections;

  return (
    <div>
      <div className="border-b border-[var(--color-line)]">
        <nav className="flex gap-1">
          <TabButton active={tab === "upload"} onClick={() => setTab("upload")}>
            Upload
          </TabButton>
          <TabButton active={tab === "database"} onClick={() => setTab("database")}>
            Database
            <span className="ml-2 rounded-full bg-[var(--color-canvas)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink-soft)]">
              {total}
            </span>
          </TabButton>
        </nav>
      </div>

      <div className="mt-6">
        <div className={tab === "upload" ? "" : "hidden"}>{uploadContent}</div>
        <div className={tab === "database" ? "" : "hidden"}>{databaseContent}</div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative -mb-px px-4 py-2.5 text-sm font-medium transition ${
        active
          ? "border-b-2 border-[var(--color-brand)] text-[var(--color-ink)]"
          : "border-b-2 border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink-soft)]"
      }`}
    >
      {children}
    </button>
  );
}
