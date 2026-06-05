/**
 * Shared Zod schemas + TS types.
 *
 * Single source of truth for boundary validation. Every LLM output and every external input
 * is validated against one of these schemas before it touches the DB.
 */

import { z } from "zod";

// ── Scope (output of scope-extractor) ────────────────────────────────────────
export const ScopeItemSchema = z.object({
  description: z.string().min(3),
  category: z.enum(["hardscape", "landscape", "irrigation", "lighting", "water_feature", "structure"]),
  quantity: z.number().positive(),
  unit: z.enum(["sqft", "linear_ft", "each", "project"]),
  complexity_notes: z.string().optional(),
});

export const ScopeSchema = z.object({
  project_type: z.string().min(2),
  items: z.array(ScopeItemSchema).min(1),
  site_constraints: z.array(z.string()).default([]),
  estimated_complexity: z.enum(["simple", "medium", "complex"]),
});

export type ScopeItem = z.infer<typeof ScopeItemSchema>;
export type Scope = z.infer<typeof ScopeSchema>;

// ── Line item match (output of line-matcher) ─────────────────────────────────
export const LineMatchSchema = z.object({
  scope_index: z.number().int().min(0),
  pricing_item_id: z.string().uuid().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

export type LineMatch = z.infer<typeof LineMatchSchema>;

// ── DB row types ─────────────────────────────────────────────────────────────
export type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  project_address: string | null;
  notes: string | null;
  created_at: string;
};

export type PricingItem = {
  id: string;
  category: string;
  item_name: string;
  description: string | null;
  unit: string;
  unit_price: number;
  tags: string[] | null;
};

export type Proposal = {
  id: string;
  lead_id: string;
  site_walk_id: string | null;
  status: "draft" | "approved" | "sent";
  narrative: string | null;
  total: number | null;
  pdf_url: string | null;
  flags: ProposalFlag[] | null;
  created_at: string;
  approved_at: string | null;
};

export type ProposalFlag = {
  type: "total_out_of_range" | "total_deviation" | "low_confidence_item" | "hallucination_blocked";
  message: string;
};

export type ProposalLineItem = {
  id: string;
  proposal_id: string;
  pricing_item_id: string | null;
  scope_description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  confidence: number | null;
  needs_review: boolean;
  position: number;
};

export type VoiceExemplar = {
  id: string;
  type: "proposal" | "voice_doc" | "edit_correction";
  source_filename: string | null;
  content: string;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  uploaded_at: string;
};

// ── Constants from truth docs ────────────────────────────────────────────────
export const PROJECT_VALUE_MIN = 8_000;   // onboarding doc range floor
export const PROJECT_VALUE_MAX = 120_000; // onboarding doc range ceiling
export const PROJECT_VALUE_AVG = 28_000;  // onboarding doc avg
export const CONFIDENCE_THRESHOLD = 0.7;  // line-item match
