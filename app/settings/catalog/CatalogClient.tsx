"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPricingItem,
  updatePricingItem,
  deletePricingItem,
  importCSV,
  type ImportResult,
} from "@/actions/catalog";
import type { PricingItem } from "@/lib/types";

const CATEGORIES = ["hardscape", "landscape", "irrigation", "lighting", "water_feature", "structure"] as const;
const UNITS = ["sqft", "linear_ft", "each", "project"] as const;

type EditableItem = PricingItem;

export function CatalogClient({ initialCatalog }: { initialCatalog: PricingItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState<EditableItem[]>(initialCatalog);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (!q) return true;
      const hay = `${item.item_name} ${item.description ?? ""} ${(item.tags ?? []).join(" ")} ${item.category}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, categoryFilter]);

  const byCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const it of items) counts[it.category] = (counts[it.category] ?? 0) + 1;
    return counts;
  }, [items]);

  function patchLocal(id: string, patch: Partial<EditableItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, tag, or description…"
          className="flex-1 min-w-[240px] rounded-md border border-[var(--color-line-strong)] bg-[var(--color-card)] px-3 py-2 text-sm placeholder:text-[var(--color-ink-muted)]"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-[var(--color-line-strong)] bg-[var(--color-card)] px-3 py-2 text-sm"
        >
          <option value="all">All categories ({items.length})</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replace("_", " ")} ({byCategory[c] ?? 0})
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowImport(true)}
          className="rounded-md border border-[var(--color-line-strong)] bg-[var(--color-card)] px-4 py-2 text-sm font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand-dark)]"
        >
          Import CSV
        </button>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]"
        >
          + Add item
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-card)]">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--color-ink-muted)]">
            No items match. Adjust your search or add a new item.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-canvas)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Item</th>
                <th className="px-5 py-3 text-left font-medium">Category</th>
                <th className="px-5 py-3 text-right font-medium">Unit price</th>
                <th className="px-5 py-3 text-left font-medium">Unit</th>
                <th className="px-5 py-3 text-left font-medium">Tags</th>
                <th className="px-5 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <CatalogRow
                  key={item.id}
                  item={item}
                  onSavedLocal={(patch) => patchLocal(item.id, patch)}
                  onDeleted={() => setItems((prev) => prev.filter((it) => it.id !== item.id))}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add dialog */}
      {showAdd && (
        <AddItemDialog
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            router.refresh();
          }}
        />
      )}

      {/* Import dialog */}
      {showImport && (
        <ImportDialog
          onClose={() => setShowImport(false)}
          onDone={() => router.refresh()}
        />
      )}
    </>
  );
}

function CatalogRow({ item, onSavedLocal, onDeleted }: { item: EditableItem; onSavedLocal: (patch: Partial<EditableItem>) => void; onDeleted: () => void }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    item_name: item.item_name,
    description: item.description ?? "",
    category: item.category,
    unit: item.unit,
    unit_price: item.unit_price,
    tags: (item.tags ?? []).join(", "),
  });
  const [isPending, startTransition] = useTransition();

  function onSave() {
    setError(null);
    startTransition(async () => {
      const tags = draft.tags ? draft.tags.split(",").map((t) => t.trim()).filter(Boolean) : null;
      const result = await updatePricingItem(item.id, {
        item_name: draft.item_name.trim(),
        description: draft.description.trim() || null,
        category: draft.category,
        unit: draft.unit,
        unit_price: Number(draft.unit_price) || 0,
        tags,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSavedLocal({
        item_name: draft.item_name.trim(),
        description: draft.description.trim() || null,
        category: draft.category,
        unit: draft.unit,
        unit_price: Number(draft.unit_price) || 0,
        tags,
      });
      setEditing(false);
    });
  }

  function onDelete() {
    if (!confirm(`Delete "${item.item_name}"? Existing proposals are not affected.`)) return;
    startTransition(async () => {
      const result = await deletePricingItem(item.id);
      if (!result.ok) {
        setError(result.error ?? "Delete failed.");
        return;
      }
      onDeleted();
    });
  }

  if (!editing) {
    return (
      <tr className="border-t border-[var(--color-line)]">
        <td className="px-5 py-3">
          <div className="font-medium">{item.item_name}</div>
          {item.description && <div className="text-xs text-[var(--color-ink-muted)]">{item.description}</div>}
        </td>
        <td className="px-5 py-3 text-[var(--color-ink-soft)]">{item.category.replace("_", " ")}</td>
        <td className="px-5 py-3 text-right tabular-nums font-medium">${Number(item.unit_price).toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
        <td className="px-5 py-3 text-[var(--color-ink-soft)]">{item.unit.replace("_", " ")}</td>
        <td className="px-5 py-3">
          {(item.tags ?? []).slice(0, 4).map((tag) => (
            <span key={tag} className="mr-1 mb-0.5 inline-block rounded-full bg-[var(--color-canvas)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-ink-soft)]">
              {tag}
            </span>
          ))}
        </td>
        <td className="px-5 py-3 text-right">
          <button onClick={() => setEditing(true)} className="text-[var(--color-brand)] hover:underline text-xs">Edit</button>
          <button onClick={onDelete} className="ml-3 text-[var(--color-ink-muted)] hover:text-[var(--color-danger)] text-xs">Delete</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-[var(--color-line)] bg-[var(--color-brand-soft)]/30">
      <td className="px-5 py-3">
        <input
          type="text" value={draft.item_name}
          onChange={(e) => setDraft({ ...draft, item_name: e.target.value })}
          className="w-full rounded-md border border-[var(--color-line-strong)] bg-[var(--color-card)] px-2 py-1 text-sm"
        />
        <textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          rows={2}
          className="mt-1 w-full rounded-md border border-[var(--color-line-strong)] bg-[var(--color-card)] px-2 py-1 text-xs"
        />
      </td>
      <td className="px-5 py-3">
        <select
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          className="rounded-md border border-[var(--color-line-strong)] bg-[var(--color-card)] px-2 py-1 text-sm"
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
        </select>
      </td>
      <td className="px-5 py-3 text-right">
        <input
          type="number" step="any" min={0}
          value={draft.unit_price}
          onChange={(e) => setDraft({ ...draft, unit_price: Number(e.target.value) || 0 })}
          className="w-24 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-card)] px-2 py-1 text-right text-sm tabular-nums"
        />
      </td>
      <td className="px-5 py-3">
        <select
          value={draft.unit}
          onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
          className="rounded-md border border-[var(--color-line-strong)] bg-[var(--color-card)] px-2 py-1 text-sm"
        >
          {UNITS.map((u) => <option key={u} value={u}>{u.replace("_", " ")}</option>)}
        </select>
      </td>
      <td className="px-5 py-3">
        <input
          type="text"
          value={draft.tags}
          placeholder="comma, separated"
          onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
          className="w-full rounded-md border border-[var(--color-line-strong)] bg-[var(--color-card)] px-2 py-1 text-xs"
        />
      </td>
      <td className="px-5 py-3 text-right">
        {error && <div className="text-xs text-[var(--color-danger)] mb-1">{error}</div>}
        <button onClick={onSave} disabled={isPending} className="text-[var(--color-brand)] hover:underline text-xs">
          {isPending ? "…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)} className="ml-3 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] text-xs">Cancel</button>
      </td>
    </tr>
  );
}

function AddItemDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createPricingItem(formData);
        onCreated();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-semibold tracking-tight">New catalog item</h3>
          <button onClick={onClose} className="text-xl leading-none text-[var(--color-ink-muted)]">×</button>
        </div>
        <form action={onSubmit} className="space-y-3">
          <Field name="item_name" label="Name" required placeholder="e.g., Travertine Paver Patio (24x24)" />
          <Field name="description" label="Description" />
          <div className="grid grid-cols-2 gap-3">
            <SelectField name="category" label="Category" options={CATEGORIES.map((c) => ({ value: c, label: c.replace("_", " ") }))} required />
            <SelectField name="unit" label="Unit" options={UNITS.map((u) => ({ value: u, label: u.replace("_", " ") }))} required />
          </div>
          <Field name="unit_price" label="Unit price ($)" type="number" required placeholder="e.g., 28.00" />
          <Field name="tags" label="Tags (comma-separated)" placeholder="patio, premium, travertine" />
          {error && (
            <div className="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-2 text-xs text-[var(--color-danger)]">
              {error}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]">Cancel</button>
            <button type="submit" disabled={isPending} className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-50">
              {isPending ? "Adding…" : "Add item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImportDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mirrorMode, setMirrorMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    if (mirrorMode) {
      if (!confirm(
        "Mirror mode will DELETE items from your catalog that are not in this CSV. Continue?",
      )) {
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
    }
    const text = await file.text();
    startTransition(async () => {
      const r = await importCSV(text, { mirror: mirrorMode });
      setResult(r);
      if (r.ok) onDone();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Import CSV</h3>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
              Headers required: <code>category, item_name, description, unit, unit_price, tags</code>. Existing items with the same name will be updated. New names will be added.
            </p>
          </div>
          <button onClick={onClose} className="text-xl leading-none text-[var(--color-ink-muted)]">×</button>
        </div>

        <label className={`block cursor-pointer rounded-lg border-2 border-dashed bg-[var(--color-canvas)] px-4 py-6 text-center text-sm transition ${
          isPending ? "border-[var(--color-brand)] text-[var(--color-brand-dark)]" : "border-[var(--color-line-strong)] text-[var(--color-ink-soft)] hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]"
        }`}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            disabled={isPending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
            className="hidden"
          />
          {isPending ? "Importing…" : (
            <>
              <div className="font-medium">Click or drop your CSV</div>
              <div className="mt-1 text-xs text-[var(--color-ink-muted)]">Up to ~5MB</div>
            </>
          )}
        </label>

        <div className="mt-3 flex items-center gap-2 text-xs">
          <input
            id="manual-mirror"
            type="checkbox"
            checked={mirrorMode}
            onChange={(e) => setMirrorMode(e.target.checked)}
            disabled={isPending}
            className="h-3.5 w-3.5 rounded border-[var(--color-line-strong)] accent-[var(--color-brand)]"
          />
          <label htmlFor="manual-mirror" className="cursor-pointer text-[var(--color-ink-soft)]">
            Mirror mode — delete catalog items missing from this CSV
          </label>
        </div>

        {result && (
          <div className={`mt-4 rounded-md p-3 text-sm ${result.ok ? "bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]" : "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"}`}>
            {result.ok ? (
              <>
                <div className="font-medium">Done.</div>
                <div className="mt-1 text-xs">
                  {result.inserted} inserted, {result.updated} updated, {result.purged > 0 ? `${result.purged} deleted, ` : ""}{result.skipped.length} skipped.
                </div>
                {result.skipped.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs underline">Show skipped rows</summary>
                    <ul className="mt-1 list-inside list-disc text-xs">
                      {result.skipped.slice(0, 20).map((s) => (
                        <li key={s.row}>Row {s.row}: {s.reason}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            ) : (
              <div>Error: {result.error}</div>
            )}
          </div>
        )}

        <details className="mt-4 text-xs">
          <summary className="cursor-pointer text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">Sample CSV format</summary>
          <pre className="mt-2 overflow-auto rounded-md bg-[var(--color-canvas)] p-3 text-[11px] font-mono leading-tight text-[var(--color-ink-soft)]">
{`category,item_name,description,unit,unit_price,tags
hardscape,Travertine Paver Patio (24x24),"Premium travertine pavers",sqft,28.00,patio|travertine|premium
structure,Cedar Pergola 12x12,"Stained cedar pergola",each,8500.00,pergola|cedar
irrigation,Drip Irrigation System,"Full property drip",each,2400.00,irrigation|drip`}
          </pre>
        </details>
      </div>
    </div>
  );
}

function Field({ name, label, type = "text", required, placeholder }: { name: string; label: string; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-medium text-[var(--color-ink-soft)]">
        {label}{required && <span className="text-[var(--color-danger)]"> *</span>}
      </label>
      <input
        id={name} name={name} type={type} required={required} placeholder={placeholder} step={type === "number" ? "any" : undefined}
        className="mt-1 w-full rounded-md border border-[var(--color-line-strong)] px-3 py-2 text-sm placeholder:text-[var(--color-ink-muted)]"
      />
    </div>
  );
}

function SelectField({ name, label, options, required }: { name: string; label: string; options: Array<{ value: string; label: string }>; required?: boolean }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-medium text-[var(--color-ink-soft)]">
        {label}{required && <span className="text-[var(--color-danger)]"> *</span>}
      </label>
      <select id={name} name={name} required={required} className="mt-1 w-full rounded-md border border-[var(--color-line-strong)] bg-[var(--color-card)] px-3 py-2 text-sm">
        <option value="">Select…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
