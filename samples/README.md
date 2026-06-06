# Demo samples

Sample data for evaluators to exercise the catalog import and voice training flows.

## `catalog-sheet-sync.csv`
26-row CSV mirroring a Google Sheet export. Use at `/settings/catalog` → Sync now (after populating sheet URL) or via Import CSV button. Includes price updates against seed items + new inserts + 2 deliberately bad rows to demonstrate skip behavior. Details in `catalog-sheet-sync-README.md`.

## `voice-style-docs/`
Two style buckets to demonstrate voice convergence:
- `style-a-surfer-casual/` — casual conversational past proposals
- `style-b-corporate-formal/` — formal corporate past proposals

Upload either bucket at `/settings/voice` → Upload tab and draft a proposal afterward to see how the narrative shifts. Designed as an A/B comparison, not real Marcus voice.

## What lives in production vs. samples
These files are demo artifacts only. Real production would have:
- Live Google Sheet, not CSV file
- Marcus's actual past proposals + sent voice corrections
- Per-tenant voice profile under auth
