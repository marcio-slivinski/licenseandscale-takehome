import Link from "next/link";
import { getCatalog, getSheetSyncConfig } from "@/actions/catalog";
import { CatalogClient } from "./CatalogClient";
import { SheetSyncPanel } from "./SheetSyncPanel";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const [catalog, syncConfig] = await Promise.all([getCatalog(), getSheetSyncConfig()]);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-brand)]">← Dashboard</Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Pricing catalog</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)] max-w-2xl">
          Your line items, units, and prices. The agent matches your site walk notes against this list when it drafts proposals.
          Changes here only affect future drafts. Proposals already sent keep the price they were sent at.
        </p>
      </div>

      <SheetSyncPanel initialConfig={syncConfig} />

      <CatalogClient initialCatalog={catalog} />
    </div>
  );
}
