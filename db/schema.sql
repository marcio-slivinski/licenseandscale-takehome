-- Greenscape Pro Proposal Drafter — Schema
-- Run in Supabase SQL editor, or via psql against the project connection string.
-- Order matters (FK dependencies).

-- 1. Leads (inbound, manual create in P0, GHL webhook in prod)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT,                              -- 'meta_ads' | 'google_lsa' | 'manual' | 'referral'
  project_address TEXT,
  notes TEXT,                               -- intake-form context (budget, timeline hints)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Site walks (raw input for the agent)
CREATE TABLE IF NOT EXISTS site_walks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  raw_notes TEXT NOT NULL,
  parsed_scope JSONB,                       -- { project_type, items[], site_constraints[], estimated_complexity }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Pricing catalog (seed: 15 items in P0, prod: 200+)
CREATE TABLE IF NOT EXISTS pricing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,                   -- 'hardscape' | 'landscape' | 'irrigation' | 'lighting' | 'water_feature' | 'structure'
  item_name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL,                       -- 'sqft' | 'linear_ft' | 'each' | 'project'
  unit_price NUMERIC(10, 2) NOT NULL,
  tags TEXT[]                               -- ['patio', 'travertine', 'premium', 'pergola']
);

CREATE INDEX IF NOT EXISTS idx_pricing_category ON pricing_items(category);
CREATE INDEX IF NOT EXISTS idx_pricing_tags ON pricing_items USING GIN(tags);

-- 4. Proposals
CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  site_walk_id UUID REFERENCES site_walks(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',     -- 'draft' | 'approved' | 'sent'
  narrative TEXT,
  total NUMERIC(12, 2),
  pdf_url TEXT,
  flags JSONB,                              -- [{ type, message }]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_proposals_lead ON proposals(lead_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);

-- 5. Proposal line items (matched scope → pricing)
CREATE TABLE IF NOT EXISTS proposal_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  pricing_item_id UUID REFERENCES pricing_items(id) ON DELETE SET NULL,
  scope_description TEXT NOT NULL,          -- what scope item this maps to (from parsed_scope)
  quantity NUMERIC(10, 2) NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL,
  confidence NUMERIC(3, 2),                 -- 0.00 - 1.00
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  position INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_line_items_proposal ON proposal_line_items(proposal_id);

-- 6. Voice exemplars (training data for the narrative writer)
CREATE TABLE IF NOT EXISTS voice_exemplars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,                       -- 'proposal' | 'voice_doc' | 'edit_correction'
  source_filename TEXT,
  content TEXT NOT NULL,
  tags TEXT[],
  metadata JSONB,                           -- for edit_correction: { original, edited, proposal_id }
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_type ON voice_exemplars(type);
CREATE INDEX IF NOT EXISTS idx_voice_tags ON voice_exemplars USING GIN(tags);

-- 7. Audit log (every mutating action)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,                -- 'proposal' | 'lead' | 'voice_exemplar'
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,                     -- 'drafted' | 'edited' | 'approved' | 'sent' | 'uploaded' | 'flagged'
  actor TEXT NOT NULL DEFAULT 'marcus',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- Storage bucket for generated PDFs (run separately in Supabase Storage settings, or via SQL):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('proposal-pdfs', 'proposal-pdfs', true);
