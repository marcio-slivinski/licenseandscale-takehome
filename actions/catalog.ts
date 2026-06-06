"use server";

/**
 * Server actions for the pricing catalog.
 *
 *   - createPricingItem    → add a single new line item (manual UI)
 *   - updatePricingItem    → edit name/desc/unit/price/tags of existing item
 *   - deletePricingItem    → remove from catalog (existing proposals untouched — they snapshot price)
 *   - importCSV            → bulk upsert from CSV (initial setup + seasonal updates)
 *
 * Important guarantee: proposals already drafted/sent are NOT affected by catalog changes.
 * Each proposal_line_item snapshots unit_price at draft time. Catalog edits only affect
 * FUTURE proposals + new "add line item" picks.
 *
 * CSV format expected (header row required, case-insensitive):
 *   category,item_name,description,unit,unit_price,tags
 *
 * - category must be one of: hardscape, landscape, irrigation, lighting, water_feature, structure
 * - unit must be one of: sqft, linear_ft, each, project
 * - unit_price: number, no $ sign
 * - tags: pipe-separated (e.g., "patio|premium|travertine")
 *
 * Upsert key: item_name (case-insensitive). Existing item with same name → update.
 */

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import type { PricingItem } from "@/lib/types";

const VALID_CATEGORIES = new Set(["hardscape", "landscape", "irrigation", "lighting", "water_feature", "structure"]);
const VALID_UNITS = new Set(["sqft", "linear_ft", "each", "project"]);

// ── createPricingItem ────────────────────────────────────────────────────────
export async function createPricingItem(formData: FormData): Promise<void> {
  const category = String(formData.get("category") ?? "").trim();
  const item_name = String(formData.get("item_name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const unit = String(formData.get("unit") ?? "").trim();
  const unit_price = Number(formData.get("unit_price") ?? 0);
  const tagsRaw = String(formData.get("tags") ?? "").trim();
  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : null;

  if (!item_name) throw new Error("Item name is required.");
  if (!VALID_CATEGORIES.has(category)) throw new Error(`Category must be one of: ${[...VALID_CATEGORIES].join(", ")}`);
  if (!VALID_UNITS.has(unit)) throw new Error(`Unit must be one of: ${[...VALID_UNITS].join(", ")}`);
  if (!(unit_price > 0)) throw new Error("Unit price must be greater than zero.");

  const { data, error } = await supabaseAdmin
    .from("pricing_items")
    .insert({ category, item_name, description, unit, unit_price, tags })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to add item: ${error.message}`);

  await audit("pricing_item", data.id, "drafted", { action: "created", item_name, unit_price });
  revalidatePath("/settings/catalog");
}

// ── updatePricingItem ────────────────────────────────────────────────────────
export type UpdateItemResult = { ok: true } | { ok: false; error: string };

export async function updatePricingItem(
  id: string,
  patch: { category?: string; item_name?: string; description?: string | null; unit?: string; unit_price?: number; tags?: string[] | null },
): Promise<UpdateItemResult> {
  if (patch.category && !VALID_CATEGORIES.has(patch.category)) {
    return { ok: false, error: `Category must be one of: ${[...VALID_CATEGORIES].join(", ")}` };
  }
  if (patch.unit && !VALID_UNITS.has(patch.unit)) {
    return { ok: false, error: `Unit must be one of: ${[...VALID_UNITS].join(", ")}` };
  }
  if (patch.unit_price != null && !(patch.unit_price > 0)) {
    return { ok: false, error: "Unit price must be greater than zero." };
  }

  const { error } = await supabaseAdmin.from("pricing_items").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await audit("pricing_item", id, "edited", { patch });
  revalidatePath("/settings/catalog");
  return { ok: true };
}

// ── deletePricingItem ────────────────────────────────────────────────────────
export async function deletePricingItem(id: string): Promise<{ ok: boolean; error?: string }> {
  // Per FK constraint (ON DELETE SET NULL on proposal_line_items.pricing_item_id),
  // existing proposals lose the linkage but retain the snapshot of name/qty/price/subtotal.
  const { error } = await supabaseAdmin.from("pricing_items").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await audit("pricing_item", id, "edited", { action: "deleted" });
  revalidatePath("/settings/catalog");
  return { ok: true };
}

// ── importCSV ────────────────────────────────────────────────────────────────
export type ImportSummary = {
  ok: true;
  inserted: number;
  updated: number;
  purged: number;
  skipped: Array<{ row: number; reason: string }>;
  priceChanges: Array<{ name: string; oldPrice: number; newPrice: number }>;
};
export type ImportResult = ImportSummary | { ok: false; error: string };

/**
 * Parse a price string. Handles US (1,234.56) and BR/EU (1.234,56) locales.
 * Whichever separator appears last is treated as the decimal separator.
 */
function parsePrice(raw: string): number {
  let s = (raw ?? "").replace(/[$\s]/g, "");
  if (!s) return NaN;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastComma > lastDot && lastDot > -1) {
    // Both present, comma after dot → comma is decimal (EU style: 1.234,56)
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > -1) {
    // Dot is decimal (US style: 1,234.56 or 28.00). Strip commas as thousands.
    s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    // Only comma(s), no dot. Multi-comma → thousands separators (1,234,567).
    // Single comma → could be decimal (BR "28,00") or unlikely thousands ("1,234").
    // Heuristic: if comma followed by exactly 3 digits at end → thousands. Else decimal.
    const commaCount = (s.match(/,/g) ?? []).length;
    if (commaCount >= 2) {
      s = s.replace(/,/g, "");
    } else if (/,\d{3}$/.test(s) && !/,\d{1,2}$/.test(s)) {
      // unlikely path — "1,234" reads as thousands too
      s = s.replace(",", "");
    } else {
      s = s.replace(",", ".");
    }
  }
  return Number(s);
}

export type ImportOptions = {
  /** If true, items in the DB whose names aren't in the CSV get DELETED. Sheet = source of truth. */
  mirror?: boolean;
};

export async function importCSV(csvText: string, options: ImportOptions = {}): Promise<ImportResult> {
  // Strip BOM if present (Google Sheets sometimes emits one)
  const cleanText = csvText.replace(/^﻿/, "");
  const rows = parseCSV(cleanText);
  if (rows.length === 0) return { ok: false, error: "CSV is empty or has no parseable rows." };

  const header = rows[0].map((c) => c.trim().toLowerCase().replace(/^﻿/, ""));
  const requiredCols = ["category", "item_name", "unit", "unit_price"];
  for (const col of requiredCols) {
    if (!header.includes(col)) {
      return { ok: false, error: `Missing required column: ${col}. Found columns: ${header.join(", ")}` };
    }
  }

  const idx = {
    category: header.indexOf("category"),
    item_name: header.indexOf("item_name"),
    description: header.indexOf("description"),
    unit: header.indexOf("unit"),
    unit_price: header.indexOf("unit_price"),
    tags: header.indexOf("tags"),
  };

  // Load existing items for upsert-by-name (include unit_price so we can compute diffs).
  const { data: existingRaw } = await supabaseAdmin.from("pricing_items").select("id, item_name, unit_price");
  const existingByName = new Map<string, { id: string; unit_price: number }>();
  for (const item of (existingRaw ?? []) as Array<{ id: string; item_name: string; unit_price: number }>) {
    existingByName.set(item.item_name.toLowerCase().trim(), { id: item.id, unit_price: Number(item.unit_price) });
  }

  let inserted = 0;
  let updated = 0;
  let purged = 0;
  const skipped: Array<{ row: number; reason: string }> = [];
  const priceChanges: Array<{ name: string; oldPrice: number; newPrice: number }> = [];
  const csvNames = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 1 && !row[0].trim()) continue; // blank line

    const category = (row[idx.category] ?? "").trim().toLowerCase();
    const item_name = (row[idx.item_name] ?? "").trim();
    const unit = (row[idx.unit] ?? "").trim().toLowerCase();
    const unit_price = parsePrice(row[idx.unit_price] ?? "");
    const description = idx.description >= 0 ? ((row[idx.description] ?? "").trim() || null) : null;
    const tagsRaw = idx.tags >= 0 ? (row[idx.tags] ?? "").trim() : "";
    const tags = tagsRaw ? tagsRaw.split(/[|;]/).map((t) => t.trim()).filter(Boolean) : null;

    // Validate
    if (!item_name) { skipped.push({ row: i + 1, reason: "missing item_name" }); continue; }
    if (!VALID_CATEGORIES.has(category)) { skipped.push({ row: i + 1, reason: `invalid category: ${category}` }); continue; }
    if (!VALID_UNITS.has(unit)) { skipped.push({ row: i + 1, reason: `invalid unit: ${unit}` }); continue; }
    if (!(unit_price > 0)) { skipped.push({ row: i + 1, reason: `invalid unit_price: ${row[idx.unit_price]} (parsed ${unit_price})` }); continue; }

    const payload = { category, item_name, description, unit, unit_price, tags };
    const nameKey = item_name.toLowerCase().trim();
    csvNames.add(nameKey);

    const existing = existingByName.get(nameKey);
    if (existing) {
      const { error } = await supabaseAdmin.from("pricing_items").update(payload).eq("id", existing.id);
      if (error) {
        skipped.push({ row: i + 1, reason: `update failed: ${error.message}` });
      } else {
        updated += 1;
        if (Math.abs(existing.unit_price - unit_price) > 0.001) {
          priceChanges.push({ name: item_name, oldPrice: existing.unit_price, newPrice: unit_price });
        }
      }
    } else {
      const { error } = await supabaseAdmin.from("pricing_items").insert(payload);
      if (error) skipped.push({ row: i + 1, reason: `insert failed: ${error.message}` });
      else inserted += 1;
    }
  }

  // Mirror mode: delete items in DB that aren't in the sheet anymore.
  if (options.mirror) {
    for (const [nameKey, entry] of existingByName.entries()) {
      if (!csvNames.has(nameKey)) {
        const { error } = await supabaseAdmin.from("pricing_items").delete().eq("id", entry.id);
        if (!error) purged += 1;
      }
    }
  }

  await audit("pricing_item", "bulk", "uploaded", {
    inserted, updated, purged, skipped: skipped.length,
    priceChanges: priceChanges.length, mirror: !!options.mirror,
  });
  revalidatePath("/settings/catalog");
  return { ok: true, inserted, updated, purged, skipped, priceChanges };
}

// ── getCatalog (read helper) ─────────────────────────────────────────────────
export async function getCatalog(): Promise<PricingItem[]> {
  const { data } = await supabaseAdmin.from("pricing_items").select("*").order("category", { ascending: true }).order("item_name", { ascending: true });
  return (data ?? []) as PricingItem[];
}

// ── Google Sheet sync ────────────────────────────────────────────────────────

export type SheetSyncConfig = {
  sheet_csv_url: string | null;
  last_synced_at: string | null;
  last_result: ImportResult | null;
};

export async function getSheetSyncConfig(): Promise<SheetSyncConfig> {
  const { data } = await supabaseAdmin
    .from("catalog_sync_config")
    .select("sheet_csv_url, last_synced_at, last_result")
    .eq("id", 1)
    .single();
  return {
    sheet_csv_url: data?.sheet_csv_url ?? null,
    last_synced_at: data?.last_synced_at ?? null,
    last_result: (data?.last_result ?? null) as ImportResult | null,
  };
}

export async function setSheetUrl(url: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = url.trim();
  if (trimmed && !/^https:\/\//.test(trimmed)) {
    return { ok: false, error: "URL must start with https://" };
  }
  const { error } = await supabaseAdmin
    .from("catalog_sync_config")
    .update({ sheet_csv_url: trimmed || null, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };
  await audit("pricing_item", "00000000-0000-0000-0000-000000000000", "edited", { action: "sheet_url_set", url: trimmed || "(cleared)" });
  revalidatePath("/settings/catalog");
  return { ok: true };
}

/**
 * Fetch published-CSV from configured URL, parse, upsert.
 *
 * Trade-off documented in README: this approach requires Marcus to publish his Google Sheet
 * as a public CSV (File -> Share -> Publish to web). Anyone with the URL can read.
 * Production upgrade path: Google Sheets API with service account credentials.
 */
export async function syncFromSheet(options: ImportOptions = {}): Promise<ImportResult> {
  const config = await getSheetSyncConfig();
  if (!config.sheet_csv_url) {
    return { ok: false, error: "No Google Sheet URL configured. Set it first." };
  }

  // Cache-bust: Google publish-to-CSV caches for ~5 min. Append a timestamp param so each
  // sync hits the latest version. (Google may still serve stale, but worth trying.)
  const baseUrl = config.sheet_csv_url;
  const sep = baseUrl.includes("?") ? "&" : "?";
  const fetchUrl = `${baseUrl}${sep}_=${Date.now()}`;

  let csvText: string;
  try {
    const response = await fetch(fetchUrl, {
      cache: "no-store",
      headers: { "cache-control": "no-cache", "pragma": "no-cache" },
    });
    if (!response.ok) {
      const summary: ImportResult = { ok: false, error: `Fetch failed: HTTP ${response.status}. Confirm the sheet is published as CSV.` };
      await persistResult(summary);
      return summary;
    }
    csvText = await response.text();
  } catch (err) {
    const summary: ImportResult = { ok: false, error: `Network error: ${err instanceof Error ? err.message : "unknown"}` };
    await persistResult(summary);
    return summary;
  }

  if (csvText.trim().length === 0) {
    const summary: ImportResult = { ok: false, error: "Sheet returned empty content." };
    await persistResult(summary);
    return summary;
  }

  const result = await importCSV(csvText, options);
  await persistResult(result);
  return result;
}

async function persistResult(result: ImportResult) {
  await supabaseAdmin
    .from("catalog_sync_config")
    .update({
      last_synced_at: new Date().toISOString(),
      last_result: result,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  await audit("pricing_item", "00000000-0000-0000-0000-000000000000", "uploaded", {
    action: "sheet_synced",
    ok: result.ok,
    ...(result.ok
      ? { inserted: result.inserted, updated: result.updated, skipped: result.skipped.length }
      : { error: result.error }),
  });
  revalidatePath("/settings/catalog");
}

// ── CSV parser (minimal, no deps) ────────────────────────────────────────────
/**
 * Tiny CSV parser handling double-quoted fields with embedded commas/newlines.
 * Sufficient for catalog upload — not RFC-perfect, but covers Excel/Sheets exports.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && next === "\n") i++;
        row.push(field); field = "";
        rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 0 && !(r.length === 1 && !r[0].trim()));
}

async function audit(entityType: string, entityId: string, action: string, metadata: Record<string, unknown>) {
  await supabaseAdmin.from("audit_log").insert({
    entity_type: entityType,
    entity_id: entityId === "bulk" ? "00000000-0000-0000-0000-000000000000" : entityId,
    action,
    actor: "marcus",
    metadata: { ...metadata, ...(entityId === "bulk" ? { bulk: true } : {}) },
  });
}
