/**
 * Anthropic client + model constants.
 *
 * Model split (cost-conscious per L&S brief):
 * - SONNET — judgment calls: scope inference + narrative writing.
 * - HAIKU  — classification: line item matching against pricing catalog.
 *
 * Cost target: ~$0.08 per proposal cold-start, ~$0.04 with prompt cache hits.
 * Cache strategy: system prompts + voice exemplars + pricing summary marked `cache_control: ephemeral`.
 *
 * Models pinned to current generation (Sonnet 4.6, Haiku 4.5). Bump explicitly on review.
 */

import Anthropic from "@anthropic-ai/sdk";

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("Missing ANTHROPIC_API_KEY");
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODEL_SONNET = "claude-sonnet-4-6";
export const MODEL_HAIKU = "claude-haiku-4-5-20251001";

export const PROMPT_CACHE_TTL = "5m" as const;
