/**
 * Line Item Matcher — Call B in the pipeline.
 *
 * Input: Scope (output of scope-extractor) + full PricingItem catalog.
 * Output: per scope item, the best matching pricing_item_id + confidence (0–1).
 *
 * Strategy: Claude Haiku 4.5 (cheap, fast). Pre-filter catalog by scope item category before sending,
 * so the model only sees ~5–10 candidates per item, not the full catalog. Cheap per call.
 *
 * Why Haiku not embeddings: catalog is small (P0=15, prod=200). Embedding setup overhead not justified.
 * Haiku is faster + simpler + gives reasoning we can show in the review UI.
 */

import { anthropic, MODEL_HAIKU } from "@/lib/anthropic";
import { LineMatchSchema, type Scope, type ScopeItem, type PricingItem, type LineMatch } from "@/lib/types";

const SYSTEM_PROMPT = `You match a scope item to the best pricing catalog entry.

You will receive:
- One scope item (description, category, quantity, unit, complexity notes).
- A short list of candidate pricing items in the same category.

Return JSON only, with this shape:
{ "pricing_item_id": "<uuid or null>", "confidence": <0–1>, "reasoning": "<one short sentence>" }

Rules:
1. confidence > 0.85: scope item and pricing item match in spirit AND unit (e.g., "Travertine patio 600sqft" → "Travertine Paver Patio (24x24)" with unit sqft).
2. confidence 0.7–0.85: same category and intent, but some mismatch (e.g., scope says "stone patio" without specifying which stone).
3. confidence 0.4–0.7: weak match, needs human review.
4. confidence < 0.4 OR no good candidate: return pricing_item_id = null. Do not force a match.
5. Unit mismatch is a hard signal of low confidence: do not match "linear_ft" scope to "sqft" pricing.

Output ONLY the JSON object. No prose, no markdown.`;

export type LineMatchResult = LineMatch & { scope_item: ScopeItem };

export async function matchLineItems(scope: Scope, catalog: PricingItem[]): Promise<LineMatchResult[]> {
  const results: LineMatchResult[] = [];

  for (let i = 0; i < scope.items.length; i++) {
    const scopeItem = scope.items[i];
    const candidates = catalog.filter((c) => c.category === scopeItem.category);

    if (candidates.length === 0) {
      results.push({
        scope_index: i,
        pricing_item_id: null,
        confidence: 0,
        reasoning: `No candidates in catalog for category "${scopeItem.category}".`,
        scope_item: scopeItem,
      });
      continue;
    }

    const match = await matchOne(scopeItem, candidates, i);
    results.push({ ...match, scope_item: scopeItem });
  }

  return results;
}

async function matchOne(scopeItem: ScopeItem, candidates: PricingItem[], index: number): Promise<LineMatch> {
  const candidatesText = candidates
    .map((c) => `- id=${c.id} | ${c.item_name} [${c.unit}] | tags: ${(c.tags ?? []).join(", ") || "—"} | desc: ${c.description ?? "—"}`)
    .join("\n");

  const userMessage = `Scope item:
- description: ${scopeItem.description}
- category: ${scopeItem.category}
- quantity: ${scopeItem.quantity}
- unit: ${scopeItem.unit}
- notes: ${scopeItem.complexity_notes ?? "—"}

Candidates:
${candidatesText}

Return the JSON match.`;

  const response = await anthropic.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content.find((c) => c.type === "text");
  if (!text || text.type !== "text") {
    return { scope_index: index, pricing_item_id: null, confidence: 0, reasoning: "Model returned no text." };
  }

  const raw = extractJSON(text.text);
  if (!raw) {
    return { scope_index: index, pricing_item_id: null, confidence: 0, reasoning: "Could not parse JSON from response." };
  }

  const parsed = LineMatchSchema.safeParse({ ...raw, scope_index: index });
  if (!parsed.success) {
    return { scope_index: index, pricing_item_id: null, confidence: 0, reasoning: `Validation failed: ${parsed.error.message}` };
  }

  return parsed.data;
}

function extractJSON(text: string): unknown | null {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find first {...} block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
