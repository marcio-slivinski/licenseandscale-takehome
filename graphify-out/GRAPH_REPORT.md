# Graph Report - /home/marcio/Claude/Profissional/LicenseScale-Test/build  (2026-06-05)

## Corpus Check
- Corpus is ~27,989 words - fits in a single context window. You may not need a graph.

## Summary
- 208 nodes · 245 edges · 44 communities detected
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_LLM Pipeline + Guardrails|LLM Pipeline + Guardrails]]
- [[_COMMUNITY_Proposal Server Actions|Proposal Server Actions]]
- [[_COMMUNITY_Strategy + 5 Agents|Strategy + 5 Agents]]
- [[_COMMUNITY_Catalog CRUD + CSV Import|Catalog CRUD + CSV Import]]
- [[_COMMUNITY_Voice Training Uploads|Voice Training Uploads]]
- [[_COMMUNITY_Catalog Client UI|Catalog Client UI]]
- [[_COMMUNITY_Narrative Writer (Sonnet C)|Narrative Writer (Sonnet C)]]
- [[_COMMUNITY_Proposal Review UI|Proposal Review UI]]
- [[_COMMUNITY_Catalog Rationale + Snapshot|Catalog Rationale + Snapshot]]
- [[_COMMUNITY_Add Line Item Dialog|Add Line Item Dialog]]
- [[_COMMUNITY_Review Page Routing|Review Page Routing]]
- [[_COMMUNITY_Exemplars List Bulk Manager|Exemplars List Bulk Manager]]
- [[_COMMUNITY_Corrections Bulk Manager|Corrections Bulk Manager]]
- [[_COMMUNITY_Style & Voice Page|Style & Voice Page]]
- [[_COMMUNITY_Line Matcher (Haiku B)|Line Matcher (Haiku B)]]
- [[_COMMUNITY_Voice Training Rationale|Voice Training Rationale]]
- [[_COMMUNITY_New Lead Dialog|New Lead Dialog]]
- [[_COMMUNITY_Root Layout + Nav|Root Layout + Nav]]
- [[_COMMUNITY_Style & Voice Tabs|Style & Voice Tabs]]
- [[_COMMUNITY_Sheet Sync Panel|Sheet Sync Panel]]
- [[_COMMUNITY_Error Boundary|Error Boundary]]
- [[_COMMUNITY_Loading State|Loading State]]
- [[_COMMUNITY_Delete Draft Form|Delete Draft Form]]
- [[_COMMUNITY_Draft Intake Form|Draft Intake Form]]
- [[_COMMUNITY_Import Sent Button|Import Sent Button]]
- [[_COMMUNITY_Health Checks|Health Checks]]
- [[_COMMUNITY_Database Seed|Database Seed]]
- [[_COMMUNITY_TypeScript Env|TypeScript Env]]
- [[_COMMUNITY_Next Config|Next Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Page Singleton 1|Page Singleton 1]]
- [[_COMMUNITY_Page Singleton 2|Page Singleton 2]]
- [[_COMMUNITY_Page Singleton 3|Page Singleton 3]]
- [[_COMMUNITY_Supabase Client|Supabase Client]]
- [[_COMMUNITY_Anthropic Client|Anthropic Client]]
- [[_COMMUNITY_Shared Types|Shared Types]]
- [[_COMMUNITY_PDF Generator|PDF Generator]]
- [[_COMMUNITY_Roadmap Whisper Input|Roadmap: Whisper Input]]
- [[_COMMUNITY_Roadmap Scheduled Sync|Roadmap: Scheduled Sync]]
- [[_COMMUNITY_Scaffold SVG (file)|Scaffold SVG (file)]]
- [[_COMMUNITY_Scaffold SVG (globe)|Scaffold SVG (globe)]]
- [[_COMMUNITY_Scaffold SVG (next)|Scaffold SVG (next)]]
- [[_COMMUNITY_Scaffold SVG (vercel)|Scaffold SVG (vercel)]]
- [[_COMMUNITY_Scaffold SVG (window)|Scaffold SVG (window)]]

## God Nodes (most connected - your core abstractions)
1. `P0 Proposal Drafter implementation` - 15 edges
2. `#1 Proposal Drafter Agent` - 14 edges
3. `draftProposal()` - 10 edges
4. `audit()` - 10 edges
5. `regenerateDraft()` - 10 edges
6. `Pipeline Call C — Sonnet 4.6 narrative writer` - 10 edges
7. `Pipeline Call B — Haiku 4.5 line matcher` - 8 edges
8. `writeNarrative()` - 7 edges
9. `audit()` - 7 edges
10. `GET()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `P0 omits: GHL API push (~2h)` --references--> `GHL (GoHighLevel CRM)`  [EXTRACTED]
  README.md → STRATEGY.md
- `P0 Proposal Drafter implementation` --implements--> `#1 Proposal Drafter Agent`  [EXTRACTED]
  README.md → STRATEGY.md
- `P0 Proposal Drafter implementation` --references--> `Push-back: knowledge transfer not speed problem`  [EXTRACTED]
  README.md → STRATEGY.md
- `Rationale: Sonnet judgment + Haiku classification cost split` --rationale_for--> `Sonnet + Haiku model split`  [EXTRACTED]
  README.md → STRATEGY.md
- `createPricingItem()` --calls--> `GET()`  [INFERRED]
  /home/marcio/Claude/Profissional/LicenseScale-Test/build/actions/catalog.ts → /home/marcio/Claude/Profissional/LicenseScale-Test/build/app/api/health/route.ts

## Hyperedges (group relationships)
- **Five-agent strategy ranked set** — strategy_proposal_drafter, strategy_closed_lost_reactivator, strategy_post_sign_concierge, strategy_build_progress_narrator, strategy_jenna_approval_copilot [EXTRACTED 1.00]
- **Proposal Drafter pipeline (Sonnet+Haiku+Sonnet → HITL → Approval)** — readme_pipeline_call_a_sonnet_scope, readme_pipeline_call_b_haiku_matcher, readme_pipeline_call_c_sonnet_narrative, readme_hitl_review_ui, readme_approval_action [EXTRACTED 1.00]
- **Guardrail stack (zod + confidence + hallucination + range)** — readme_zod_validation, readme_confidence_threshold, readme_hallucination_regex, readme_total_range_check, readme_guardrails [EXTRACTED 1.00]

## Communities

### Community 0 - "LLM Pipeline + Guardrails"
Cohesion: 0.09
Nodes (34): Anthropic SDK (Claude), Approval server action (approveProposal), audit_log table, Confidence threshold 0.7 → needs_review, db/schema.sql — 7 tables + indexes, Production: frequency-weighted corrections, Guardrails (zod + confidence + hallucination + range), Hallucination regex check (+26 more)

### Community 1 - "Proposal Server Actions"
Cohesion: 0.13
Nodes (22): buildScoredLineItems(), calculateTotal(), detectHallucinatedItems(), formatDollar(), generateFlags(), toLocaleString(), addLineItem(), approveProposal() (+14 more)

### Community 2 - "Strategy + 5 Agents"
Cohesion: 0.11
Nodes (25): Assumption: pricing catalog CSV exportable, Assumption: Marcus adopts digital site walk input, Assumption: GHL API supports needed ops, Brittany (sporadic batch re-engagement), #4 Build Progress Narrator, #2 Closed-Lost Reactivator, CompanyCam, Excluded: Crew Coaching Agent (founder #3) (+17 more)

### Community 3 - "Catalog CRUD + CSV Import"
Cohesion: 0.25
Nodes (13): audit(), createPricingItem(), deletePricingItem(), getCatalog(), getSheetSyncConfig(), importCSV(), parseCSV(), parsePrice() (+5 more)

### Community 4 - "Voice Training Uploads"
Cohesion: 0.18
Nodes (3): parseFile(), uploadVoiceFile(), worker()

### Community 5 - "Catalog Client UI"
Cohesion: 0.33
Nodes (0): 

### Community 6 - "Narrative Writer (Sonnet C)"
Cohesion: 0.53
Nodes (4): buildExemplarSections(), buildScopeForLLM(), stripMarkdownArtifacts(), writeNarrative()

### Community 7 - "Proposal Review UI"
Cohesion: 0.4
Nodes (0): 

### Community 8 - "Catalog Rationale + Snapshot"
Cohesion: 0.4
Nodes (5): Add line item during review (catalog picker), CSV Import upsert by item name, Price snapshot guarantee on proposal_line_items, Pricing catalog management (/settings/catalog), Rationale: catalog edits do not retroactively change proposals (price snapshot)

### Community 9 - "Add Line Item Dialog"
Cohesion: 0.5
Nodes (0): 

### Community 10 - "Review Page Routing"
Cohesion: 0.5
Nodes (2): NotFound(), ProposalReviewPage()

### Community 11 - "Exemplars List Bulk Manager"
Cohesion: 0.5
Nodes (0): 

### Community 12 - "Corrections Bulk Manager"
Cohesion: 0.5
Nodes (0): 

### Community 13 - "Style & Voice Page"
Cohesion: 0.5
Nodes (0): 

### Community 14 - "Line Matcher (Haiku B)"
Cohesion: 0.83
Nodes (3): extractJSON(), matchLineItems(), matchOne()

### Community 15 - "Voice Training Rationale"
Cohesion: 0.67
Nodes (4): Convergence: 3-5 corrections with consistent signal, Rationale: conservative voice training (3-5 corrections to flip), Production: synthesized voice profile (meta-LLM pass), Voice training current behavior (top-3+top-5+top-10)

### Community 16 - "New Lead Dialog"
Cohesion: 0.67
Nodes (0): 

### Community 17 - "Root Layout + Nav"
Cohesion: 0.67
Nodes (0): 

### Community 18 - "Style & Voice Tabs"
Cohesion: 0.67
Nodes (0): 

### Community 19 - "Sheet Sync Panel"
Cohesion: 0.67
Nodes (0): 

### Community 20 - "Error Boundary"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Loading State"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Delete Draft Form"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Draft Intake Form"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Import Sent Button"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Health Checks"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Database Seed"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "TypeScript Env"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Next Config"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "PostCSS Config"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Page Singleton 1"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Page Singleton 2"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Page Singleton 3"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Supabase Client"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Anthropic Client"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Shared Types"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "PDF Generator"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Roadmap: Whisper Input"
Cohesion: 1.0
Nodes (1): P0 omits: voice memo Whisper input (~1.5h)

### Community 38 - "Roadmap: Scheduled Sync"
Cohesion: 1.0
Nodes (1): P0 omits: scheduled Google Sheets sync (~2h)

### Community 39 - "Scaffold SVG (file)"
Cohesion: 1.0
Nodes (1): file.svg (Next.js scaffold placeholder)

### Community 40 - "Scaffold SVG (globe)"
Cohesion: 1.0
Nodes (1): globe.svg (Next.js scaffold placeholder)

### Community 41 - "Scaffold SVG (next)"
Cohesion: 1.0
Nodes (1): next.svg (Next.js scaffold placeholder)

### Community 42 - "Scaffold SVG (vercel)"
Cohesion: 1.0
Nodes (1): vercel.svg (Next.js scaffold placeholder)

### Community 43 - "Scaffold SVG (window)"
Cohesion: 1.0
Nodes (1): window.svg (Next.js scaffold placeholder)

## Knowledge Gaps
- **35 isolated node(s):** `Marcus Tate (founder, Phoenix AZ)`, `License & Scale (evaluator)`, `Excluded: Lead Pre-Qualifier`, `Excluded: Crew Coaching Agent (founder #3)`, `Excluded: Marketing/Content Agent (founder #4)` (+30 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Error Boundary`** (2 nodes): `GlobalError()`, `error.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Loading State`** (2 nodes): `loading.tsx`, `Loading()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Delete Draft Form`** (2 nodes): `DeleteDraftForm()`, `DeleteDraftForm.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Draft Intake Form`** (2 nodes): `DraftForm()`, `DraftForm.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Import Sent Button`** (2 nodes): `ImportSentButton.tsx`, `ImportSentButton()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Health Checks`** (2 nodes): `page.tsx`, `runChecks()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Database Seed`** (2 nodes): `seed.ts`, `seed()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `TypeScript Env`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next Config`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PostCSS Config`** (1 nodes): `postcss.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Page Singleton 1`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Page Singleton 2`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Page Singleton 3`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supabase Client`** (1 nodes): `supabase.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Anthropic Client`** (1 nodes): `anthropic.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shared Types`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PDF Generator`** (1 nodes): `pdf-generator.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Roadmap: Whisper Input`** (1 nodes): `P0 omits: voice memo Whisper input (~1.5h)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Roadmap: Scheduled Sync`** (1 nodes): `P0 omits: scheduled Google Sheets sync (~2h)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Scaffold SVG (file)`** (1 nodes): `file.svg (Next.js scaffold placeholder)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Scaffold SVG (globe)`** (1 nodes): `globe.svg (Next.js scaffold placeholder)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Scaffold SVG (next)`** (1 nodes): `next.svg (Next.js scaffold placeholder)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Scaffold SVG (vercel)`** (1 nodes): `vercel.svg (Next.js scaffold placeholder)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Scaffold SVG (window)`** (1 nodes): `window.svg (Next.js scaffold placeholder)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `P0 Proposal Drafter implementation` connect `LLM Pipeline + Guardrails` to `Strategy + 5 Agents`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `#1 Proposal Drafter Agent` connect `Strategy + 5 Agents` to `LLM Pipeline + Guardrails`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `GET()` connect `Proposal Server Actions` to `Catalog CRUD + CSV Import`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `#1 Proposal Drafter Agent` (e.g. with `Excluded: Lead Pre-Qualifier` and `Excluded: Crew Coaching Agent (founder #3)`) actually correct?**
  _`#1 Proposal Drafter Agent` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `draftProposal()` (e.g. with `rateLimit()` and `extractScope()`) actually correct?**
  _`draftProposal()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `regenerateDraft()` (e.g. with `rateLimit()` and `extractScope()`) actually correct?**
  _`regenerateDraft()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Marcus Tate (founder, Phoenix AZ)`, `License & Scale (evaluator)`, `Excluded: Lead Pre-Qualifier` to the rest of the system?**
  _35 weakly-connected nodes found - possible documentation gaps or missing edges._