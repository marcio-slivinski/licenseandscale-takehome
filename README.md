# Greenscape Pro · Proposal Drafter Agent

License & Scale AI Developer take-home project, built in 24 hours by Marcio Slivinski.

This is the **P0 agent** from a 5-agent strategy proposed for Greenscape Pro (a $4.2M premium hardscape/landscape design-build company in Phoenix, AZ). Strategy doc lives in [`strategy/strategy.md`](../strategy/strategy.md) of the session repo. P0 spec lives in [`notes/p0-spec.md`](../notes/p0-spec.md).

---

## What this is

Not a "proposal generator." It's a **proxy for Marcus's brain on scope interpretation**, with a HITL approval flow and progressive voice replication.

The founder's stated #1 priority is *"speed up quoting — it's killing us."* The data agrees on priority, but disagrees on diagnosis. Two sentences later in the discovery call he said:

> *"I am the bottleneck. I have to touch every proposal... Nobody else knows how to do that."*

That's not a speed problem. It's a **knowledge transfer problem.** Faster templates don't fix it. The only thing that fixes it is a system that can interpret site walk notes the way Marcus does, with him as the editor instead of the author.

This P0 ships that system end-to-end:

1. Marcus pastes site walk notes.
2. Claude Sonnet extracts a structured scope (via tool use).
3. Claude Haiku matches scope items against the pricing catalog with confidence scoring.
4. Claude Sonnet writes the proposal narrative in Marcus's voice, using uploaded exemplars + auto-captured edit corrections.
5. Marcus reviews side-by-side and approves.
6. PDF is generated, Slack notification fires, edit corrections are saved as voice training, audit log records every action.

The HITL loop is the safety net AND the training signal. Each edit teaches the system. By proposal #20-30, voice quality converges from "approximation" to "indistinguishable."

---

## Architecture

```
                    ┌────────────────────────────────────────────────────┐
                    │  Lead arrives (manual UI in P0; GHL webhook in prod)│
                    └────────────────────────────────────────────────────┘
                                              │
                                              ▼
                    ┌────────────────────────────────────────────────────┐
                    │  Marcus pastes site walk notes (text, paste form)  │
                    └────────────────────────────────────────────────────┘
                                              │
                                              ▼
       ┌───────────────────────────────────────────────────────────────────────┐
       │ PIPELINE (server action: draftProposal)                               │
       │                                                                       │
       │ Call A — Sonnet 4.6 + tool use                                        │
       │   notes → ScopeSchema (project_type, items[], site_constraints[])    │
       │   System cached: extraction rules + catalog summary                   │
       │                                                                       │
       │ Call B — Haiku 4.5 (per scope item)                                   │
       │   scope item → best pricing match + confidence (0-1) + reasoning      │
       │   Catalog pre-filtered by category (5-10 candidates per call)         │
       │                                                                       │
       │ Call C — Sonnet 4.6                                                   │
       │   scope + matches + voice exemplars (cached) → narrative              │
       │   Hard anti-hallucination constraint in system prompt                 │
       │                                                                       │
       │ Guardrails                                                            │
       │   • Zod schema validation (every LLM output)                         │
       │   • Confidence threshold 0.7 (low → needs_review, excluded from total)│
       │   • Hallucination regex (forbids invented $ amounts / item names)    │
       │   • Total range check ($8K-$120K per onboarding doc)                  │
       │   • Deviation flag (>2x or <0.5x $28K avg)                            │
       └───────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
       ┌───────────────────────────────────────────────────────────────────────┐
       │ HITL REVIEW UI (/proposals/[id]/review)                               │
       │                                                                       │
       │  ┌──────────────┬──────────────┬──────────────┐                       │
       │  │ Raw notes    │ Parsed scope │ Investment   │                       │
       │  │ (read-only)  │ JSON         │ summary      │                       │
       │  └──────────────┴──────────────┴──────────────┘                       │
       │  Matched line items table (qty editable, toggle include/exclude)      │
       │  Narrative textarea (editable; diff captured as edit_correction)      │
       │  [Approve & Send]                                                     │
       └───────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
       ┌───────────────────────────────────────────────────────────────────────┐
       │ APPROVAL (server action: approveProposal)                             │
       │  • Persist final state to DB                                         │
       │  • Save edit diff as voice_exemplar(type='edit_correction')           │
       │  • Generate PDF via @react-pdf/renderer                              │
       │  • Upload PDF to Supabase Storage (proposal-pdfs bucket)             │
       │  • Fire Slack webhook with PDF link + view-in-app link                │
       │  • Write audit_log row                                                │
       └───────────────────────────────────────────────────────────────────────┘
```

---

## Stack & rationale

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 App Router + Server Actions | Real eng, not n8n vibe-coding. Type-safe boundaries. Server actions = co-located mutation logic. |
| Language | TypeScript 5 | Zod boundary validation, exhaustive checks, IDE intel. |
| DB | Supabase Postgres + Storage | Hard req. Free tier. Generated PDFs hosted in same project. |
| LLM | Claude Sonnet 4.6 (judgment) + Haiku 4.5 (classification) | Sonnet for scope inference + narrative writing. Haiku for cheap classification (line matching). Cost split documented below. |
| Validation | Zod | Every LLM output and every form input gets validated at the boundary. No untyped JSON crosses into business logic. |
| PDF | @react-pdf/renderer | Server-side React components → Buffer → Supabase Storage. |
| File parsing | mammoth (.docx), pdf-parse (.pdf) | For voice training file uploads. |
| External integration | Slack incoming webhook | Hard req: ≥1 external integration. Slack chosen over GHL for P0 (faster iteration, zero OAuth burden). GHL push deferred to production roadmap (~2h work). |
| Deploy | Vercel | Native Next.js. Free tier OK for take-home. |

---

## Cost per proposal

- **Call A (Sonnet, scope extraction):** ~3K input + 1K output → ~$0.027
- **Call B (Haiku, per scope item × ~5 items):** ~500 input + 200 output each → ~$0.005 total
- **Call C (Sonnet, narrative):** ~4K input + 1.5K output → ~$0.045
- **Total cold-start:** ~$0.08
- **With prompt cache hits** (system + catalog + voice exemplars cached `cache_control: ephemeral`): ~$0.04

At Greenscape's 150 proposals/yr (one per qualified lead): ~$6–12 of LLM spend per year. Less than $1/month at scale.

---

## Guardrails

| Check | Where | Behavior |
|---|---|---|
| Scope JSON shape | Post-Call A | Zod validation. Retry once on failure. |
| Line item confidence <70% | Post-Call B | `needs_review=true`. Item EXCLUDED from auto-total. Marcus toggles inclusion in review UI. |
| Hallucination | Post-Call C | Regex scans narrative for $ amounts and catalog item names not in matched items. Flagged. |
| Total range | Pre-persist | <$8K or >$120K (onboarding doc range) → blocking-style flag. |
| Total deviation | Pre-persist | <0.5x or >2x $28K avg → advisory flag. |
| Empty/garbage notes | Pre-Call A | <20 chars → reject at form. |
| API spam | Server action | In-memory rate limit: 1 draft per lead per 30s. |

---

## Voice approximation strategy

**Cold start (no uploaded exemplars):** Synthetic exemplar baked into the prompt, derived from positioning signals in the truth docs (Marcus's quoted phrases: *"quality, reliability, photographs well"*).

**Production path (uploaded):** `/settings/voice` UI:
- **Past Proposals tab** — upload `.pdf/.docx/.txt/.md`. Parsed, stored as `voice_exemplar(type='proposal')`.
- **Voice & Style Docs tab** — Marcus's writing samples (emails, briefs). Stored as `type='voice_doc'`.
- **Edit Corrections (auto)** — every time Marcus edits a draft narrative and approves, the diff is saved as `type='edit_correction'`. Next draft pulls these as few-shot examples.

Prompt builder dynamically injects top 3 voice_docs + top 5 proposals + top 10 recent edit_corrections. The cacheable sections are marked `cache_control: ephemeral` so we don't pay full cost on repeated calls.

---

## Pricing catalog management

The catalog is the single source of truth for line item prices. Marcus manages it at `/settings/catalog`:

- **Initial setup:** Marcus exports his Google Sheet to CSV and uploads via the **Import CSV** button. Existing items with the same name update, new names insert. Validation per row — bad rows skip with a reason, good rows commit.
- **Day-to-day:** Catalog stays mostly untouched. Marcus opens it when a supplier price moves or he adds a new product offering.
- **Edit individual:** Click any row → inline edit name, description, category, unit, price, tags → save. Audit logged.
- **Add individual:** "+ Add item" button → form → save.
- **Delete:** Confirm modal. Existing proposals are NOT affected by deletion (line items snapshot price at draft time, see below).

**Price snapshot guarantee.** Each `proposal_line_items` row stores its own `unit_price` and `subtotal` at the time the proposal was drafted. Catalog edits afterward do NOT retroactively change sent proposals. This is intentional — proposals are contracts, not live computations.

**Add line item during review.** In the HITL review UI, the "+ Add item" button on the line items header opens a catalog picker. Marcus searches by name/category/tag, sets quantity, adds to the proposal. Added items get `confidence: 1.0` (Marcus picked it explicitly) and bypass `needs_review`.

CSV format expected:
```
category,item_name,description,unit,unit_price,tags
hardscape,Travertine Paver Patio (24x24),"Premium travertine pavers",sqft,28.00,patio|travertine|premium
structure,Cedar Pergola 12x12,"Stained cedar pergola",each,8500.00,pergola|cedar
```

Tags pipe-separated. category ∈ {hardscape, landscape, irrigation, lighting, water_feature, structure}. unit ∈ {sqft, linear_ft, each, project}.

## What's deliberately NOT in P0 (production roadmap)

- **GHL API push** — would update opportunity stage + push PDF to GHL. ~2h of integration work. Cut for 24h ship.
- **Voice memo input** — Whisper transcription of Marcus dictating. ~1.5h. Paste-text only in P0.
- **Google Sheets sync** — daily polling of Marcus's pricing sheet to auto-update the catalog. P0 covers this need via the CSV import + manual edit UI. Sheets sync is a ~3h add when Marcus tires of re-exporting.
- **Auth** — single-user demo. Production adds Supabase Auth + per-user RLS.
- **Embedding-based matching** — overkill for ~200 item catalog. Haiku classification is faster + cheaper + gives reasoning we can show in UI.
- **Tests** — coverage deliberately deferred to ship within 24h. Production would include integration tests on guardrails and unit tests on scope extraction.

---

## Setup

### 1. Clone + install
```bash
git clone https://github.com/marcio-slivinski/licenseandscale-takehome.git
cd licenseandscale-takehome
npm install
```

### 2. Provision Supabase
- Create project at supabase.com.
- Run `db/schema.sql` in the SQL Editor.
- Create a public Storage bucket named `proposal-pdfs`.

### 3. Set env vars
Copy `.env.example` to `.env.local` and fill in:
- `ANTHROPIC_API_KEY` — get from console.anthropic.com
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — from Supabase project settings → API
- `SLACK_WEBHOOK_URL` — create at api.slack.com/messaging/webhooks
- `NEXT_PUBLIC_BASE_URL` — `http://localhost:3000` for dev, production URL for deploy

### 4. Seed
```bash
npm run db:seed
```
Inserts 15 pricing items + 2 demo leads.

### 5. Run
```bash
npm run dev
```
Open http://localhost:3000. Click into a demo lead. Paste notes. Draft. Review. Approve.

---

## Repository layout

```
.
├── app/                          Next.js App Router
│   ├── page.tsx                  Dashboard (leads + proposals lists)
│   ├── leads/[id]/page.tsx       Lead detail + intake form
│   ├── proposals/[id]/
│   │   ├── review/               HITL side-by-side UI
│   │   └── sent/                 Confirmation
│   ├── settings/
│   │   ├── voice/                Voice training upload UI
│   │   └── catalog/              Pricing catalog management (CRUD + CSV import)
│   ├── api/health/               DB + Anthropic + Slack check
│   ├── error.tsx                 Global error boundary
│   ├── loading.tsx               Suspense fallback
│   └── not-found.tsx             404
├── actions/
│   ├── proposals.ts              createLead, draftProposal, approveProposal, addLineItem
│   ├── voice.ts                  uploadVoiceFile, deleteVoiceExemplar
│   └── catalog.ts                createPricingItem, updatePricingItem, deletePricingItem, importCSV
├── lib/
│   ├── agents/
│   │   ├── scope-extractor.ts    Call A (Sonnet + tool use)
│   │   ├── line-matcher.ts       Call B (Haiku, per-item)
│   │   └── narrative-writer.ts   Call C (Sonnet + voice exemplars)
│   ├── guardrails.ts             Confidence + range + hallucination checks
│   ├── pdf-generator.tsx         react-pdf component
│   ├── parsers.ts                pdf-parse + mammoth for voice uploads
│   ├── slack.ts                  Webhook notifier
│   ├── rate-limit.ts             In-memory bucket
│   ├── anthropic.ts              SDK init + model constants
│   ├── supabase.ts               Server (service-role) + anon clients
│   └── types.ts                  Zod schemas + DB row types
└── db/
    ├── schema.sql                7 tables + indexes
    └── seed.ts                   15 pricing items + 2 demo leads
```

---

## Author

Marcio Slivinski · contact.marcio.slivinski@gmail.com
