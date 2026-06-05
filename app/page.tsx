import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { createLead } from "@/actions/proposals";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { data: leads, error: leadsErr } = await supabaseAdmin
    .from("leads")
    .select("id, name, project_address, source, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: proposals } = await supabaseAdmin
    .from("proposals")
    .select("id, lead_id, status, total, created_at, leads(name)")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
            <p className="mt-1 text-sm text-stone-600">
              Manual create here; production wires this to the GHL lead webhook.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_360px]">
          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
            {leadsErr && (
              <div className="p-4 text-sm text-red-700 bg-red-50 border-b border-red-200">
                Failed to load leads: {leadsErr.message}
              </div>
            )}
            {(leads ?? []).length === 0 ? (
              <div className="p-6 text-sm text-stone-500">
                No leads yet. Use the form on the right to create one, or run <code className="rounded bg-stone-100 px-1">npm run db:seed</code>.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Project Address</th>
                    <th className="px-4 py-2 text-left">Source</th>
                    <th className="px-4 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(leads ?? []).map((l) => (
                    <tr key={l.id} className="border-t border-stone-100">
                      <td className="px-4 py-3 font-medium">{l.name}</td>
                      <td className="px-4 py-3 text-stone-600">{l.project_address ?? "—"}</td>
                      <td className="px-4 py-3 text-stone-600">{l.source ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/leads/${l.id}`} className="text-emerald-700 hover:underline">
                          Open →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <form action={createLead} className="rounded-lg border border-stone-200 bg-white p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">New Lead</h2>
            <FormInput name="name" label="Full name" required />
            <FormInput name="email" label="Email" type="email" />
            <FormInput name="phone" label="Phone" />
            <FormInput name="project_address" label="Project address" placeholder="e.g., 8420 E Camelback Rd, Scottsdale, AZ" />
            <div>
              <label htmlFor="notes" className="block text-xs font-medium text-stone-600">Intake notes</label>
              <textarea
                id="notes" name="notes" rows={3}
                placeholder="Budget hints, HOA, timeline, ad source…"
                className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <button type="submit" className="w-full rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800">
              Create Lead
            </button>
          </form>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight">Recent proposals</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-stone-200 bg-white">
          {(proposals ?? []).length === 0 ? (
            <div className="p-6 text-sm text-stone-500">No proposals drafted yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-2 text-left">Client</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {(proposals ?? []).map((p: any) => (
                  <tr key={p.id} className="border-t border-stone-100">
                    <td className="px-4 py-3 font-medium">{p.leads?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                        p.status === "sent" ? "bg-blue-100 text-blue-800" :
                        "bg-stone-100 text-stone-700"
                      }`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      ${(p.total ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={p.status === "approved" || p.status === "sent" ? `/proposals/${p.id}/sent` : `/proposals/${p.id}/review`}
                        className="text-emerald-700 hover:underline"
                      >
                        {p.status === "draft" ? "Review →" : "View →"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function FormInput({ name, label, type = "text", required, placeholder }: { name: string; label: string; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-medium text-stone-600">
        {label}{required && <span className="text-red-600"> *</span>}
      </label>
      <input
        id={name} name={name} type={type} required={required} placeholder={placeholder}
        className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
    </div>
  );
}
