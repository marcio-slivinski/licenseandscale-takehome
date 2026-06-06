import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { VoiceUpload } from "./VoiceUpload";
import { CorrectionsManager } from "./CorrectionsManager";
import { ExemplarsList } from "./ExemplarsList";
import { ImportSentButton } from "./ImportSentButton";
import { StyleVoiceTabs } from "./StyleVoiceTabs";

export const dynamic = "force-dynamic";

export default async function StyleVoicePage() {
  const { data: exemplarsRaw } = await supabaseAdmin
    .from("voice_exemplars")
    .select("*")
    .order("uploaded_at", { ascending: false });

  const exemplars = exemplarsRaw ?? [];
  const proposals = exemplars.filter((e) => e.type === "proposal");
  const voiceDocs = exemplars.filter((e) => e.type === "voice_doc");
  const corrections = exemplars.filter((e) => e.type === "edit_correction");

  const formattedProposals = proposals.map((item) => ({
    id: item.id,
    source_filename: item.source_filename ?? null,
    content_length: item.content?.length ?? 0,
    uploaded_at: item.uploaded_at,
  }));

  const formattedVoiceDocs = voiceDocs.map((item) => ({
    id: item.id,
    source_filename: item.source_filename ?? null,
    content_length: item.content?.length ?? 0,
    uploaded_at: item.uploaded_at,
  }));

  const formattedCorrections = corrections.map((c) => ({
    id: c.id,
    uploaded_at: c.uploaded_at,
    metadata: (c.metadata ?? null) as { original?: string; edited?: string } | null,
  }));

  const uploadContent = (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <UploadCard
          title="Past proposals"
          subtitle="The best training material. Drop signed proposals from Google Drive or anywhere."
          type="proposal"
          count={proposals.length}
          accept=".pdf,.docx,.txt,.md"
          extraButton={<ImportSentButton />}
        />
        <UploadCard
          title="Writing samples"
          subtitle="Emails, briefs, anything you wrote. Helps the tone match yours."
          type="voice_doc"
          count={voiceDocs.length}
          accept=".pdf,.docx,.txt,.md"
        />
      </div>

      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-5">
        <h2 className="text-base font-semibold">Edits we&apos;ve learned from</h2>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
          Every time you change a draft and approve, we save the before-and-after as a training signal. Manage them in the Database tab.
        </p>
        <div className="mt-3 text-2xl font-semibold tabular-nums text-[var(--color-ink)]">
          {corrections.length} captured
        </div>
      </section>
    </div>
  );

  const databaseContent = (
    <div className="space-y-8">
      <DatabaseSection title="Past proposals" count={proposals.length}>
        <ExemplarsList items={formattedProposals} kind="proposal" searchable />
      </DatabaseSection>
      <DatabaseSection title="Writing samples" count={voiceDocs.length}>
        <ExemplarsList items={formattedVoiceDocs} kind="voice_doc" searchable />
      </DatabaseSection>
      <DatabaseSection title="Edit corrections" count={corrections.length}>
        <CorrectionsManager initialCorrections={formattedCorrections} searchable />
      </DatabaseSection>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-brand)]">← Dashboard</Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Style &amp; Voice</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)] max-w-2xl">
          Train the agent on how you write and how you structure your proposals. Upload past work, drop writing samples, and the system learns from every edit you make.
        </p>
      </div>

      <StyleVoiceTabs
        uploadContent={uploadContent}
        databaseContent={databaseContent}
        counts={{ proposals: proposals.length, voiceDocs: voiceDocs.length, corrections: corrections.length }}
      />
    </div>
  );
}

function UploadCard({
  title, subtitle, type, count, accept, extraButton,
}: {
  title: string;
  subtitle: string;
  type: "proposal" | "voice_doc";
  count: number;
  accept: string;
  extraButton?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{subtitle}</p>
        </div>
        <span className="text-xs text-[var(--color-ink-muted)]">{count} stored</span>
      </div>
      <div className="mt-4">
        <VoiceUpload type={type} accept={accept} />
      </div>
      {extraButton}
    </section>
  );
}

function DatabaseSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="text-xs text-[var(--color-ink-muted)]">{count} stored</span>
      </div>
      {count === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--color-line-strong)] bg-[var(--color-canvas)] p-6 text-center text-sm text-[var(--color-ink-muted)]">
          Nothing here yet. Use the Upload tab to add some.
        </div>
      ) : (
        children
      )}
    </section>
  );
}
