# Test CSV — Catalog Sheet Sync

File: `test-catalog-sync.csv` · 26 data rows (24 valid + 2 deliberately bad for skip-test).

## What's in it

### Updates to existing seed items (13 rows with PRICE BUMPS)
Match by `item_name`, will update existing rows in DB.

| Item | Old price | New price |
|---|---|---|
| Travertine Paver Patio (24x24) | $28 | **$32** |
| Flagstone Patio | $32 | **$36** |
| Cantera Stone Pavers | $22 | **$24** |
| Stamped Concrete Patio | $16 | **$18** |
| Block Retaining Wall | $145 | **$165** |
| Cedar Pergola 12x12 | $8,500 | **$9,200** |
| Aluminum Pergola 14x16 | $12,000 | **$13,500** |
| Outdoor Kitchen Basic 10ft | $18,500 | **$19,500** |
| Gas Fire Pit | $4,200 | **$4,500** |
| Basin Fountain | $5,800 | **$6,200** |
| Premium Artificial Turf (80oz) | $14 | **$15** |
| Drip Irrigation System | $2,400 | **$2,600** |
| LED Path Light | $185 | **$195** |

### New items (11 rows — INSERT)
| Item | Category | Unit | Price |
|---|---|---|---|
| Travertine Paver Walkway | hardscape | sqft | $26 |
| Cedar Pergola 10x10 | structure | each | $6,800 |
| Outdoor Kitchen Deluxe 14ft | structure | each | $32,000 |
| Concrete Paver Driveway Apron | hardscape | sqft | $19 |
| LED Spotlight Tree Uplight | lighting | each | $225 |
| LED Step Light | lighting | each | $145 |
| Modern Sheer Descent | water_feature | each | $8,500 |
| Desert Native Plant Package | landscape | project | $1,100 |
| Cactus Garden Install | landscape | project | $1,800 |
| Putting Green Synthetic | hardscape | sqft | $22 |
| Shade Sail Triangle 18ft | structure | each | $2,400 |

### Bad rows (4 — should SKIP with reason)
| Row | Skip reason expected |
|---|---|
| `Garbage Category Row` (category=furniture) | invalid category: furniture |
| `Bad Unit Row` (unit=parsec) | invalid unit: parsec |
| (blank item_name) | missing item_name |
| `Negative Price Row` (-50) | invalid unit_price: -50.00 |

## How to use

### Test 1 — Initial bulk sync

1. Upload CSV to Google Sheets:
   - drive.google.com → New → File upload → pick `test-catalog-sync.csv` → opens as Sheet.
   - OR copy-paste the CSV contents into a new blank sheet.

2. Publish as CSV:
   - File → Share → **Publish to web**
   - Choose the tab → format **Comma-separated values (.csv)** → Publish
   - Copy the URL (ends in `/pub?output=csv`)

3. On `/settings/catalog`:
   - Paste URL into the "Sync from your Google Sheet" panel
   - Save URL
   - Sync now
   - Expect summary: **13 updated · 11 new · 4 skipped**

4. Verify:
   - Travertine Paver Patio price now $32 (was $28)
   - New items appear in the catalog table
   - 1 skipped row in the result detail

### Test 2 — Edit something + re-sync

After Test 1, in the Sheet:
- Change a price (e.g., LED Path Light from $195 → $250).
- Add a new row (e.g., "Custom Stone Bench, hardscape, each, 2200, seating|stone|custom").
- Delete a row (rip out "Putting Green Synthetic").

Click **Sync now** again. Expect:
- 1+ updated (the price change)
- 1+ new (the bench)
- **Note:** sync is UPSERT — it does NOT remove items missing from the sheet. Putting Green stays in DB. (Production: add a "purge missing" flag, or use a soft-delete column.)

### Test 3 — Verify proposal pricing snapshot

Important behavior guarantee — verify in UI:

1. Before any sync: draft + approve a proposal that includes Travertine Paver Patio at $28.
2. Run the sync (price moves to $32).
3. Open the sent proposal — total still reflects $28 line item. Catalog change does NOT mutate sent proposals.

## CSV format reminder

```
category,item_name,description,unit,unit_price,tags
```

- `category` ∈ {hardscape, landscape, irrigation, lighting, water_feature, structure}
- `unit` ∈ {sqft, linear_ft, each, project}
- `unit_price` — number, no $ sign (commas OK, stripped)
- `tags` — pipe-separated (`patio|premium|travertine`)
- `description` optional, free text

Existing items match by `item_name` (case-insensitive). Bad rows skip with a per-row reason.

## Path

```
/home/marcio/Claude/Profissional/LicenseScale-Test/notes/test-catalog-sync.csv
```
