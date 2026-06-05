/**
 * Narrative Writer — Call C in the pipeline.
 *
 * Input: Scope + matched LineMatchResults + (optional) voice exemplars from DB.
 * Output: proposal narrative (intro, scope summary, what to expect) in Marcus's voice.
 *
 * Voice strategy (cold start vs. trained):
 * - COLD START (no uploaded exemplars): synthetic exemplars derived from truth doc positioning signals.
 * - TRAINED: top 3 voice_doc + top 5 proposal exemplars (tag-matched) + top 10 edit_correction (recent).
 *
 * Cache strategy: base voice rules + synthetic exemplars + voice_doc list all marked as
 * `cache_control: ephemeral`. Recent edit_corrections are fresh per call (small token cost).
 *
 * Anti-hallucination: prompt explicitly forbids citing items/prices not in the matched line items.
 * Guardrails module re-validates output afterward.
 */

import { anthropic, MODEL_SONNET } from "@/lib/anthropic";
import type { Scope, PricingItem, VoiceExemplar } from "@/lib/types";
import type { LineMatchResult } from "./line-matcher";

const BASE_VOICE_RULES = `You write proposal narratives in Marcus Tate's voice.

Marcus is the founder of Greenscape Pro (Phoenix AZ, premium hardscape/landscape, $4.2M/yr). He closes deals on site walks personally. He's direct, confident without being salesy, and his clients trust him.

VOICE RULES (non-negotiable):
- Plain direct English. Sound like Marcus talking to a client, not a document being drafted.
- Use contractions: "we'll", "you've", "it's", "I'm".
- Simple verbs: "build" not "architect", "use" not "utilize", "fix" not "implement a solution for".
- Vary sentence length. Short fragment. Then a longer sentence with context. Short again.
- Confidence without apology. No defensive openers ("we'd love to", "I hope this works").
- Honest about uncertainty: if scope item is unclear, say "subject to site verification" — don't fake precision.

KILL ON SIGHT (these mark AI writing):
- Em-dashes (—). Use commas, periods, or parentheses instead.
- Scaffolding ("Two things. First… Second…", "There are three reasons"). Just say them.
- Performative openers ("I'll be honest", "Here's the thing"). If you're being honest, just be.
- AI vocab: leverage, robust, seamless, delve, moreover, furthermore, it's worth noting, passionate about, spearheaded.
- Perfect tricolons ("fast, clear, and effective"). Real lists are uneven.
- Closing summary paragraph that restates everything. End on a hook.

GREENSCAPE POSITIONING (Marcus uses these signals — quoted from his own onboarding):
- "Quality, reliability, and a finished product that photographs well."
- Premium positioning. Does NOT compete on price.
- "Design to build — we handle everything from the first site walk to the final walkthrough."

PROPOSAL STRUCTURE (Marcus's template):
1. Project Overview — 2-4 sentences. What you're building, for whom, why this scope.
2. Scope of Work — sectioned by category (hardscape, structure, etc.). Plain language, no jargon dump.
3. Timeline & Process — typical 2-6 weeks build, depends on scope. Mention HOA/permit delays if site_constraints flagged.
4. What to Expect Next — deposit, design sign-off, permit pulls, crew start.

HARD CONSTRAINT (anti-hallucination):
You will be given a list of matched line items. The narrative may ONLY mention items, materials, or quantities that appear in that list. You may NOT invent specific brand names, exact prices, or items not in the list. If something is missing from the matched list, refer to it generally ("we'll include lighting throughout") rather than specifically.`;

const SYNTHETIC_PROPOSAL_EXEMPLAR = `[Synthetic example — what a Marcus-voice opening looks like, derived from his positioning signals]

Sarah,

Thanks for walking me through the backyard last Tuesday. Here's what we're proposing.

This is a full backyard build: travertine patio, cedar pergola for the seating area, gas fire pit, and a strip of premium turf for the kids. We're keeping the existing planter beds and adding drip irrigation throughout. Path lighting along the new walkway.

We've done a lot of work in your HOA. The submission package isn't complicated, but it adds 3-4 weeks to start date, so factor that in.

[Scope section follows. Then timeline. Then next steps.]`;

type NarrativeContext = {
  lead: { name: string; project_address: string | null; notes: string | null };
  scope: Scope;
  matches: LineMatchResult[];
  catalog: PricingItem[];
  exemplars: VoiceExemplar[]; // empty array = cold start
};

export type NarrativeResult =
  | { ok: true; narrative: string }
  | { ok: false; error: string };

export async function writeNarrative(ctx: NarrativeContext): Promise<NarrativeResult> {
  const matchedItemsText = buildMatchedItemsContext(ctx.matches, ctx.catalog);
  const exemplarSections = buildExemplarSections(ctx.exemplars);

  const systemBlocks: Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }> = [
    { type: "text", text: BASE_VOICE_RULES, cache_control: { type: "ephemeral" } },
  ];

  if (exemplarSections.voiceDocs) {
    systemBlocks.push({ type: "text", text: exemplarSections.voiceDocs, cache_control: { type: "ephemeral" } });
  }

  if (exemplarSections.proposals) {
    systemBlocks.push({ type: "text", text: exemplarSections.proposals, cache_control: { type: "ephemeral" } });
  } else {
    systemBlocks.push({
      type: "text",
      text: `No uploaded proposal exemplars yet. Use this synthetic example to calibrate voice:\n\n${SYNTHETIC_PROPOSAL_EXEMPLAR}`,
      cache_control: { type: "ephemeral" },
    });
  }

  // edit_corrections are fresh per call (small, continuous learning)
  if (exemplarSections.corrections) {
    systemBlocks.push({ type: "text", text: exemplarSections.corrections });
  }

  const userMessage = `Client: ${ctx.lead.name}
Project address: ${ctx.lead.project_address ?? "—"}
Intake notes: ${ctx.lead.notes ?? "—"}

Project type: ${ctx.scope.project_type}
Estimated complexity: ${ctx.scope.estimated_complexity}
Site constraints: ${ctx.scope.site_constraints.join(", ") || "none flagged"}

Matched line items (the ONLY items you may reference specifically):
${matchedItemsText}

Write the proposal narrative. Follow the structure (overview / scope / timeline / next steps). Match Marcus's voice. Do not invent items beyond the matched list.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 2048,
      system: systemBlocks,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content.find((c) => c.type === "text");
    if (!text || text.type !== "text") {
      return { ok: false, error: "Model returned no text content." };
    }

    return { ok: true, narrative: text.text.trim() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown narrative writer error." };
  }
}

function buildMatchedItemsContext(matches: LineMatchResult[], catalog: PricingItem[]): string {
  const lines: string[] = [];
  for (const m of matches) {
    const pricing = m.pricing_item_id ? catalog.find((c) => c.id === m.pricing_item_id) : null;
    if (pricing) {
      lines.push(`- ${m.scope_item.description} → ${pricing.item_name} (${m.scope_item.quantity} ${m.scope_item.unit}) [confidence: ${m.confidence.toFixed(2)}]`);
    } else {
      lines.push(`- ${m.scope_item.description} (${m.scope_item.quantity} ${m.scope_item.unit}) [NO MATCH — refer to generally, do NOT name specific products]`);
    }
  }
  return lines.join("\n");
}

function buildExemplarSections(exemplars: VoiceExemplar[]): {
  voiceDocs?: string;
  proposals?: string;
  corrections?: string;
} {
  const voiceDocs = exemplars.filter((e) => e.type === "voice_doc").slice(0, 3);
  const proposals = exemplars.filter((e) => e.type === "proposal").slice(0, 5);
  const corrections = exemplars.filter((e) => e.type === "edit_correction").slice(0, 10);

  const result: { voiceDocs?: string; proposals?: string; corrections?: string } = {};

  if (voiceDocs.length > 0) {
    result.voiceDocs = `Voice & style references (sample writing by Marcus):\n\n${voiceDocs
      .map((v) => `--- ${v.source_filename ?? "voice doc"} ---\n${truncate(v.content, 2000)}`)
      .join("\n\n")}`;
  }

  if (proposals.length > 0) {
    result.proposals = `Past proposal exemplars (use these as the primary voice/structure model):\n\n${proposals
      .map((p) => `--- ${p.source_filename ?? "past proposal"} ---\n${truncate(p.content, 3000)}`)
      .join("\n\n")}`;
  }

  if (corrections.length > 0) {
    result.corrections = `Recent Marcus edits (negative→positive examples — learn from these):\n\n${corrections
      .map((c, i) => {
        const meta = (c.metadata ?? {}) as { original?: string; edited?: string };
        return `Edit ${i + 1}:\n- Original (AI draft): ${truncate(meta.original ?? "", 500)}\n- Marcus's version: ${truncate(meta.edited ?? "", 500)}`;
      })
      .join("\n\n")}`;
  }

  return result;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}
