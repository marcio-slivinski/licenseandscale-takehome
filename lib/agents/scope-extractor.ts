/**
 * Scope Extractor — Call A in the pipeline.
 *
 * Input: raw site walk notes (text from Marcus).
 * Output: structured Scope (validated against ScopeSchema).
 *
 * Strategy: Claude Sonnet 4.6 with tool use (structured output via `extract_scope` tool).
 * System prompt cached — pricing catalog summary + extraction rules. Single retry on validation failure.
 */

import { anthropic, MODEL_SONNET } from "@/lib/anthropic";
import { ScopeSchema, type Scope, type PricingItem } from "@/lib/types";

const SYSTEM_PROMPT = `You are Marcus Tate's scope-interpretation proxy for Greenscape Pro, a premium residential hardscape/landscape design-build company in Phoenix, AZ.

Your job: read raw site walk notes (Marcus's dictation, bullets, fragments) and extract a structured scope of work.

Greenscape Pro context:
- Premium positioning ($28K avg project, $8K–$120K range, 150 projects/yr).
- Categories: hardscape (patios, walls, fire pits), structure (pergolas, kitchens), water_feature, landscape (turf, plantings), irrigation, lighting.
- Units: sqft (patios, turf, walls — wait, walls are linear), linear_ft (walls, edging), each (pergolas, kitchens, fire pits, lights, plants), project (rare; full-package items).
- Common items: travertine pavers, flagstone, cantera stone, cedar/aluminum pergolas, outdoor kitchens, gas/wood fire pits, basin fountains, 80oz artificial turf, drip irrigation, LED path lights, native plants, block retaining walls.

Rules:
1. Be conservative. If notes mention "patio" without size, infer reasonable default but mark complexity_notes as "size assumed — confirm with Marcus".
2. Surface site constraints from notes: HOA mentions, slope, access, permit needs, existing structures.
3. Estimate complexity: simple (single category, <$20K likely), medium ($20–60K, 2–3 categories), complex ($60K+, 3+ categories or HOA-heavy).
4. Never invent items not implied by notes. If notes are sparse, return fewer items, not made-up ones.
5. Quantity must be a number. If "two 12ft pergolas" → 2 each. If "600sqft patio" → 600 sqft.

You will be called with the tool \`extract_scope\`. Use the tool.`;

const TOOL_DEFINITION = {
  name: "extract_scope",
  description: "Extract a structured scope of work from site walk notes.",
  input_schema: {
    type: "object" as const,
    properties: {
      project_type: {
        type: "string",
        description: "Short descriptor: 'patio', 'pergola', 'full_backyard', 'pool_deck', etc.",
      },
      items: {
        type: "array",
        description: "Scope items. Each item is one quantifiable line of work.",
        items: {
          type: "object",
          properties: {
            description: { type: "string", description: "Short item description (e.g., 'Travertine patio 24x24')." },
            category: {
              type: "string",
              enum: ["hardscape", "landscape", "irrigation", "lighting", "water_feature", "structure"],
            },
            quantity: { type: "number" },
            unit: { type: "string", enum: ["sqft", "linear_ft", "each", "project"] },
            complexity_notes: {
              type: "string",
              description: "Site-specific notes: HOA, slope, access, assumptions. Empty if none.",
            },
          },
          required: ["description", "category", "quantity", "unit"],
        },
      },
      site_constraints: {
        type: "array",
        items: { type: "string" },
        description: "Site-level constraints: HOA, permits, slope, access.",
      },
      estimated_complexity: {
        type: "string",
        enum: ["simple", "medium", "complex"],
      },
    },
    required: ["project_type", "items", "site_constraints", "estimated_complexity"],
  },
};

export type ScopeExtractionResult =
  | { ok: true; scope: Scope }
  | { ok: false; error: string; raw?: unknown };

export async function extractScope(rawNotes: string, catalog: PricingItem[]): Promise<ScopeExtractionResult> {
  if (rawNotes.trim().length < 20) {
    return { ok: false, error: "Notes too short (<20 chars). Add more detail." };
  }

  const catalogSummary = buildCatalogSummary(catalog);

  const callOnce = async (): Promise<ScopeExtractionResult> => {
    const response = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 2048,
      tools: [TOOL_DEFINITION],
      tool_choice: { type: "tool", name: "extract_scope" },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        { type: "text", text: catalogSummary, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: `Site walk notes from Marcus:\n\n${rawNotes}\n\nExtract the scope using the extract_scope tool.`,
        },
      ],
    });

    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return { ok: false, error: "Model did not return tool_use block", raw: response.content };
    }

    const parsed = ScopeSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      return { ok: false, error: `Scope validation failed: ${parsed.error.message}`, raw: toolUse.input };
    }

    return { ok: true, scope: parsed.data };
  };

  const first = await callOnce();
  if (first.ok) return first;

  // Single retry on validation failure (Sonnet sometimes returns slightly off shapes).
  const second = await callOnce();
  return second;
}

function buildCatalogSummary(catalog: PricingItem[]): string {
  const byCategory = catalog.reduce<Record<string, PricingItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  const lines = ["Available pricing catalog (for context — do NOT include prices in scope, just align categories/units):"];
  for (const [category, items] of Object.entries(byCategory)) {
    lines.push(`\n${category}:`);
    for (const item of items) {
      lines.push(`  - ${item.item_name} [${item.unit}]`);
    }
  }
  return lines.join("\n");
}
