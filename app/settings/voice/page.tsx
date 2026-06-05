import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { VoiceUpload } from "./VoiceUpload";
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
        <Link href="/" className="text-sm text-stone-500 hover:text-stone-800">← Dashboard</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Voice training</h1>
        <p className="mt-1 text-sm text-stone-600 max-w-2xl">
          Upload Marcus&apos;s past proposals and writing samples. The narrative writer uses them as
          few-shot exemplars. Every edit Marcus makes on a draft is captured automatically as an
          edit-correction signal. Voice quality converges with use.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Past proposals"
          subtitle="Drop signed proposals from Google Drive or anywhere. Best training signal."
          type="proposal"
          items={proposals}
          accept=".pdf,.docx,.txt,.md"
        />
        <Section
          title="Voice & style docs"
          subtitle="Writing samples by Marcus: emails, briefs, anything in his voice."
          type="voice_doc"
          items={voiceDocs}
          accept=".pdf,.docx,.txt,.md"
        />
      </div>

      <section>
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-lg font-semibold">Edit corrections (auto-captured)</h2>
            <p className="text-sm text-stone-600">
              Every time you edit an AI draft and approve it, the diff is saved here. The next draft pulls these as negative→positive examples.
            </p>
          </div>
          <span className="text-sm text-stone-500">{corrections.length} captured</span>
        </div>
        <ul className="mt-3 space-y-2">
          {corrections.length === 0 ? (
            <li className="rounded border border-stone-200 bg-white p-4 text-sm text-stone-500">
              No edit corrections yet. They appear automatically when you approve edited proposals.
            </li>
          ) : (
            corrections.slice(0, 10).map((c) => {
              const meta = (c.metadata ?? {}) as { original?: string; edited?: string };
              return (
                <li key={c.id} className="rounded border border-stone-200 bg-white p-4 text-sm">
                  <div className="text-xs text-stone-500 mb-2">
                    {new Date(c.uploaded_at).toLocaleString()}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold text-red-700 uppercase tracking-wider">AI draft</div>
                      <p className="mt-1 text-stone-700 line-clamp-4">{meta.original ?? "—"}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Marcus&apos;s version</div>
                      <p className="mt-1 text-stone-900 line-clamp-4">{meta.edited ?? "—"}</p>
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}

function Section({ title, subtitle, type, items, accept }: { title: string; subtitle: string; type: "proposal" | "voice_doc"; items: any[]; accept: string }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-stone-500">{subtitle}</p>
        </div>
        <span className="text-xs text-stone-400">{items.length} uploaded</span>
      </div>
      <div className="mt-4">
        <VoiceUpload type={type} accept={accept} />
      </div>
      {items.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between rounded border border-stone-100 px-3 py-2">
              <div>
                <div className="font-medium text-stone-800">{item.source_filename ?? "(unnamed)"}</div>
                <div className="text-xs text-stone-500">{(item.content?.length ?? 0).toLocaleString()} chars · {new Date(item.uploaded_at).toLocaleDateString()}</div>
              </div>
              <form action={async () => { "use server"; await deleteVoiceExemplar(item.id); }}>
                <button type="submit" className="text-xs text-stone-400 hover:text-red-700">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
