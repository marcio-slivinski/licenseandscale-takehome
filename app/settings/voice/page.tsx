import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { VoiceUpload } from "./VoiceUpload";
import { CorrectionsManager } from "./CorrectionsManager";
import { deleteVoiceExemplar } from "@/actions/voice";

export const dynamic = "force-dynamic";

export default async function VoiceSettingsPage() {
  const { data: exemplarsRaw } = await supabaseAdmin
    .from("voice_exemplars")
    .select("*")
    .order("uploaded_at", { ascending: false })
    .limit(100);

  const exemplars = exemplarsRaw ?? [];
  const proposals = exemplars.filter((e) => e.type === "proposal");
  const voiceDocs = exemplars.filter((e) => e.type === "voice_doc");
  const corrections = exemplars.filter((e) => e.type === "edit_correction");

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-brand)]">← Dashboard</Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Voice training</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)] max-w-2xl">
          Upload past proposals or anything written in your voice. Every draft pulls from these as examples.
          Every time you edit a draft and approve, your edits get saved here too. The system gets closer to your real voice with use.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <UploadSection
          title="Past proposals"
          subtitle="The best training material. Drop signed proposals from Google Drive or anywhere."
          type="proposal"
          items={proposals}
          accept=".pdf,.docx,.txt,.md"
        />
        <UploadSection
          title="Writing samples"
          subtitle="Emails, briefs, anything you wrote. Helps the tone match yours."
          type="voice_doc"
          items={voiceDocs}
          accept=".pdf,.docx,.txt,.md"
        />
      </div>

      <CorrectionsManager
        initialCorrections={corrections.map((c) => ({
          id: c.id,
          uploaded_at: c.uploaded_at,
          metadata: (c.metadata ?? null) as { original?: string; edited?: string } | null,
        }))}
      />
    </div>
  );
}

function UploadSection({ title, subtitle, type, items, accept }: { title: string; subtitle: string; type: "proposal" | "voice_doc"; items: any[]; accept: string }) {
  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{subtitle}</p>
        </div>
        <span className="text-xs text-[var(--color-ink-muted)]">{items.length} uploaded</span>
      </div>
      <div className="mt-4">
        <VoiceUpload type={type} accept={accept} />
      </div>
      {items.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between rounded-md border border-[var(--color-line)] px-3 py-2">
              <div className="min-w-0">
                <div className="truncate font-medium text-[var(--color-ink)]">{item.source_filename ?? "(unnamed)"}</div>
                <div className="text-xs text-[var(--color-ink-muted)]">
                  {(item.content?.length ?? 0).toLocaleString()} characters · {new Date(item.uploaded_at).toLocaleDateString()}
                </div>
              </div>
              <form action={async () => { "use server"; await deleteVoiceExemplar(item.id); }}>
                <button type="submit" className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-danger)]">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
