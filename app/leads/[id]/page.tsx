import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { DraftForm } from "./DraftForm";

export const dynamic = "force-dynamic";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: lead, error } = await supabaseAdmin.from("leads").select("*").eq("id", id).single();
  if (error || !lead) notFound();

  const { data: siteWalks } = await supabaseAdmin
    .from("site_walks")
    .select("id, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  const { data: proposals } = await supabaseAdmin
    .from("proposals")
    .select("id, status, total, created_at, flags")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-stone-500 hover:text-stone-800">← Dashboard</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{lead.name}</h1>
        <div className="mt-1 text-sm text-stone-600">
          {lead.project_address && <span>{lead.project_address} · </span>}
          {lead.source && <span className="capitalize">{lead.source.replace("_", " ")}</span>}
        </div>
        {lead.notes && (
          <div className="mt-3 rounded border border-stone-200 bg-white p-3 text-sm text-stone-700">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-stone-500">Intake notes</div>
            <p className="whitespace-pre-wrap">{lead.notes}</p>
          </div>
        )}
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Draft a new proposal</h2>
        <p className="mt-2 text-sm text-stone-600">
          Paste your site walk notes below. Marcus-brain interprets them, matches line items, drafts the proposal narrative.
          You review and approve before anything goes out.
        </p>
        <DraftForm leadId={lead.id} />
      </section>

      {(proposals ?? []).length > 0 && (
        <section>
          <h2 className="text-xl font-semibold tracking-tight">Proposals for this lead</h2>
          <ul className="mt-3 space-y-2">
            {(proposals ?? []).map((p: any) => (
              <li key={p.id} className="rounded border border-stone-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {p.status === "draft" ? "Draft" : p.status === "approved" ? "Approved" : "Sent"} — ${(p.total ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs text-stone-500">
                      {new Date(p.created_at).toLocaleString()}
                      {(p.flags ?? []).length > 0 && (
                        <span className="ml-2 text-amber-700">{(p.flags ?? []).length} flag{(p.flags ?? []).length === 1 ? "" : "s"}</span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={p.status === "draft" ? `/proposals/${p.id}/review` : `/proposals/${p.id}/sent`}
                    className="text-sm text-emerald-700 hover:underline"
                  >
                    {p.status === "draft" ? "Review →" : "View →"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(siteWalks ?? []).length > 0 && (
        <section className="text-xs text-stone-500">
          {(siteWalks ?? []).length} site walk note{(siteWalks ?? []).length === 1 ? "" : "s"} saved.
        </section>
      )}
    </div>
  );
}
