/**
 * Narrative Writer — Call C in the pipeline.
 *
 * Input: Scope + matched LineMatchResults + (optional) voice exemplars from DB.
 * Output: proposal narrative (intro, scope summary, what to expect) in Marcus's voice.
 *
 * IMPORTANT context for the model: this narrative goes INTO the same PDF as the line-items table.
 * It does NOT promise "we'll send a proposal" — it IS the proposal. The line items table is
 * rendered automatically by the system right below the narrative.
 *
 * Voice strategy (cold start vs. trained):
 * - COLD START (no uploaded exemplars): synthetic exemplar baked into prompt.
 * - TRAINED: top 3 voice_doc + top 5 proposal exemplars (tag-matched) + top 10 edit_correction.
 *
 * Output format: PLAIN PROSE ONLY. No markdown (no **bold**, no ---, no #), because react-pdf renders
 * literal characters.
 */

import { anthropic, MODEL_SONNET } from "@/lib/anthropic";
import type { Scope, PricingItem, VoiceExemplar } from "@/lib/types";
import type { LineMatchResult } from "./line-matcher";

const BASE_VOICE_RULES = `You write proposal narratives in Marcus Tate's voice.

Marcus is the founder of Greenscape Pro (Phoenix AZ, premium hardscape/landscape, $4.2M/yr). He closes deals on site walks personally. He's direct, confident without being salesy, and his clients trust him.

# Where this narrative goes

The output you write is the OPENING SECTION of a printable proposal PDF. Right below the narrative, the system automatically renders a formatted table of line items, quantities, unit prices, and the total. After the table, a footer mentions deposit terms.

So you are NOT writing a cover letter, NOT writing a summary that promises a future proposal, NOT writing "we'll send you the numbers." This is the proposal itself. The numbers are right below your prose.

# Output format — strict

Plain prose only. No markdown markers anywhere. Do not output:
- ** for bold
- --- or === for separators
- # or ## for headings
- _ for italics
- • or * for bullets

If you want a section break, use a blank line between paragraphs. If you want to label a section, write it as a short line of plain text (no leading #), like "What's included" on its own line. The PDF renders the text exactly as you write it.

# Voice rules

- Plain direct English. Sound like Marcus talking to a client, not a document being drafted.
- Use contractions: "we'll", "you've", "it's", "I'm".
- Simple verbs: "build" not "architect", "use" not "utilize", "fix" not "implement a solution for".
- Vary sentence length. Short fragment. Then a longer sentence with context. Short again.
- Confidence without apology. No defensive openers ("we'd love to", "I hope this works").
- Honest about uncertainty: if scope item is unclear, say "subject to site verification" — don't fake precision.

# Kill on sight

- Em-dashes (—). Use commas, periods, or parentheses instead.
- Scaffolding ("Two things. First… Second…", "There are three reasons"). Just say them.
- Performative openers ("I'll be honest", "Here's the thing"). If you're being honest, just be.
- AI vocab: leverage, robust, seamless, delve, moreover, furthermore, it's worth noting, passionate about, spearheaded.
- Perfect tricolons ("fast, clear, and effective"). Real lists are uneven.
- Closing summary paragraph that restates everything above.
- Phrases like "we'll get you a line-item proposal" or "we'll send the numbers next" — the numbers are RIGHT BELOW this text.

# Greenscape positioning

These are Marcus's actual phrases from his onboarding (quoted from the truth docs):
- "Quality, reliability, and a finished product that photographs well."
- Premium positioning. Does not compete on price.
- "Design to build — we handle everything from the first site walk to the final walkthrough."

# Structure for the narrative

1. Opening (1-3 short sentences). Reference the site walk by date if you know it, the client by first name, what you walked through. Conversational.
2. What we're building (a paragraph or two). Plain language summary of the scope. No prices in this paragraph (table is below). Mention complexity notes if they matter — HOA, slope, access. Don't over-explain materials Marcus already discussed on the walk.
3. Timeline + what's next (short paragraph). Realistic build time. If HOA / permit will add weeks, say so. Mention the deposit + design sign-off + permit pulls as part of how Marcus's process works ("once you're in, we handle the HOA package and permit work from there"). Keep it short.
4. Sign-off line. Just "Marcus" on its own line.

# Hard constraint (anti-hallucination)

You will be given a list of matched line items. The prose may ONLY mention items, materials, or quantities that appear in that list. You may NOT invent brand names, specific prices, or items not in the list. If a scope item didn't get matched (marked NO MATCH in the list), refer to it generally ("we'll include path lighting") not specifically.`;

const SYNTHETIC_PROPOSAL_EXEMPLAR = `Sarah,

Good walking the backyard with you last Tuesday. Here's the proposal.

We're putting in a travertine paver patio for the main entertaining area, a cedar pergola over the dining spot to handle the afternoon sun, a gas fire pit by the seating wall, and a stretch of premium turf for the kids. Path lighting will run along the new walkway. Existing planter beds stay, and we'll add drip irrigation throughout so you're not babysitting anything.

We've done a few projects in your HOA. The submission package isn't complicated but adds three to four weeks to your start date, so plan on six weeks from signed proposal to crew on site. Once you're in, we handle the HOA package, permit pulls, and design sign-off. You won't be chasing paperwork.

Numbers are below. When you're ready to move, the deposit kicks off your spot on the schedule.

Marcus`;

type NarrativeContext = {
  lead: { name: string; project_address: string | null; notes: string | null };
  scope: Scope;
  matches: LineMatchResult[];
  catalog: PricingItem[];
  exemplars: VoiceExemplar[];
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
      text: `No uploaded proposal exemplars yet. Use this synthetic example to calibrate voice. Notice: no markdown markers, plain prose only, sign-off is just "Marcus" on its own line.\n\n${SYNTHETIC_PROPOSAL_EXEMPLAR}`,
      cache_control: { type: "ephemeral" },
    });
  }

  if (exemplarSections.corrections) {
    systemBlocks.push({ type: "text", text: exemplarSections.corrections });
  }

  const userMessage = `Client: ${ctx.lead.name}
Project address: ${ctx.lead.project_address ?? "—"}
Intake notes: ${ctx.lead.notes ?? "—"}

Project type: ${ctx.scope.project_type}
Estimated complexity: ${ctx.scope.estimated_complexity}
Site constraints: ${ctx.scope.site_constraints.join(", ") || "none flagged"}

Matched line items (the ONLY items you may reference specifically — the system renders these in a table right below your prose):
${matchedItemsText}

Write the proposal narrative now. Plain prose, no markdown. Remember: the line items table renders automatically below your text. Do not promise to send numbers, do not write "next steps will be a proposal" — this IS the proposal.`;

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

    // Defensive: strip any stray markdown markers the model might still emit.
    const cleaned = stripMarkdownArtifacts(text.text.trim());
    return { ok: true, narrative: cleaned };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown narrative writer error." };
  }
}

/**
 * Remove markdown markers that react-pdf would render as literals.
 * Conservative: only strips when clearly markdown syntax, not content.
 */
function stripMarkdownArtifacts(text: string): string {
  return text
    // **bold** → bold
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    // __bold__ → bold
    .replace(/__([^_]+)__/g, "$1")
    // *italic* / _italic_ → italic  (only when clearly emphasis pattern)
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, "$1")
    // --- or === separators on their own line
    .replace(/^[ \t]*[-=]{3,}[ \t]*$/gm, "")
    // # leading headers
    .replace(/^#{1,6}\s+/gm, "")
    // > blockquotes
    .replace(/^>\s+/gm, "")
    // collapse 3+ newlines to 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildMatchedItemsContext(matches: LineMatchResult[], catalog: PricingItem[]): string {
  const lines: string[] = [];
  for (const m of matches) {
    const pricing = m.pricing_item_id ? catalog.find((c) => c.id === m.pricing_item_id) : null;
    if (pricing) {
      lines.push(`- ${m.scope_item.description} → ${pricing.item_name} (${m.scope_item.quantity} ${m.scope_item.unit}) [confidence: ${m.confidence.toFixed(2)}]`);
    } else {
      lines.push(`- ${m.scope_item.description} (${m.scope_item.quantity} ${m.scope_item.unit}) [NO MATCH — refer to generally, do not name specific products]`);
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
    result.proposals = `Past proposal exemplars (primary voice + structure model):\n\n${proposals
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
