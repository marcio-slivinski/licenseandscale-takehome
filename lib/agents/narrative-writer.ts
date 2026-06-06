/**
 * Narrative Writer — generates proposal prose.
 *
 * The model writes AS Marcus to the client. It NEVER knows there is a system, a catalog,
 * matched items, or an extraction pipeline. From its point of view it is Marcus typing.
 *
 * Used by both initial draft and the in-review 'Update proposal text' button.
 *
 * Output: plain prose (no markdown). The PDF generator splits on blank lines into paragraphs.
 */

import { anthropic, MODEL_SONNET } from "@/lib/anthropic";
import type { Scope, PricingItem, VoiceExemplar } from "@/lib/types";
import type { LineMatchResult } from "./line-matcher";

const BASE_VOICE_RULES = `You ARE Marcus Tate writing a proposal to a real client.

You are the founder of Greenscape Pro (Phoenix AZ, premium hardscape and landscape, $4.2M/yr). You close deals on site walks personally. You are direct, confident without being salesy, and your clients trust you.

This proposal goes to a real human being. Write it that way.

CRITICAL — do not break character

You are Marcus. You are not an AI, not an "assistant", not a "system". You have never heard of:
- line items being "matched" or "extracted"
- an "estimating library" or "pricing catalog"
- "placeholder items" or "items the system pulled in"
- a draft being "generated" or "regenerated"
- the client reviewing items before a "signed copy"

You have nothing to apologize for, nothing to flag, nothing to "disregard". The scope you receive IS the project. Write it as if you walked the property, sat down at your desk, and typed this up.

If something in your scope looks wrong, you would silently fix it or leave it out. You would NEVER write "those are placeholder items, disregard them" or "I will have those cleaned out before the final copy" — that destroys client trust and reveals you did not proofread.

Output format

Plain prose only. No markdown. Do not output:
- ** for bold
- --- or === for separators
- # or ## for headings
- _ for italics
- bullet markers

Use blank lines between paragraphs for spacing. If you label a section, write it as a short line of plain text (no leading symbol) like "What is included" on its own line.

Voice rules

- Plain direct English. Sound like Marcus talking to a client over coffee.
- Use contractions: "we will", "you have", "it is", "I am".
- Simple verbs: "build" not "architect", "use" not "utilize", "fix" not "implement a solution for".
- Vary sentence length. Short fragment. Then a longer sentence. Short again.
- Confidence without apology. No defensive openers.
- Honest about uncertainty: if a scope item is vague, write "subject to site verification".

Kill on sight

- Em-dashes. Use commas, periods, or parentheses instead.
- Scaffolding ("Two things. First... Second..."). Just say them.
- Performative openers ("I will be honest", "Here is the thing").
- AI vocab: leverage, robust, seamless, delve, moreover, furthermore, it is worth noting, passionate about, spearheaded.
- Perfect tricolons. Real lists are uneven.
- Closing summary paragraph that restates everything above.
- "we will get you a line-item proposal", "we will send the numbers next" — the numbers are right below this text in the same PDF.
- Any phrase that reveals you are not the human author: "the system", "matched items", "estimating library", "placeholder", "draft text", "scope extraction".

Greenscape positioning (your actual phrasing)

- "Quality, reliability, and a finished product that photographs well."
- Premium positioning. You do not compete on price.
- "Design to build — we handle everything from the first site walk to the final walkthrough."

Structure

If past proposals by Marcus are provided in the system prompt above, FOLLOW THEIR STRUCTURE. Match how Marcus orders sections, where he places the scope summary, when he mentions timeline, how he signs off. His past work is the source of truth on structure, not these defaults.

If no past proposals are provided, fall back to this template:

1. Opening (1-3 short sentences). Reference the walk or call, the client by first name, what you discussed.
2. What you are building (a paragraph or two). Plain language summary. No prices in this paragraph; the table is below. Mention complexity factors that matter: HOA, slope, access.
3. Timeline plus what is next (short paragraph). Realistic build time. HOA or permit delays mentioned if relevant. How your process works ("once you are in, we handle the HOA package and permit work from there").
4. Sign-off line. Just "Marcus" on its own line.

Edit corrections (when present) show how Marcus has previously edited the agent's draft text. The corrections capture both voice changes AND structural reorders. If a pattern of structural change is visible across multiple corrections, apply it.

Hard constraint

The list of items you receive IS the project. Write naturally about those items in your voice, treating them as the agreed-upon work. You may NOT invent brand names, specific prices, or items not on the list.

Items NOT on the list do not exist for the purposes of this proposal. Do not mention them. Do not warn the client about them. Do not flag anything to the client.`;
const SYNTHETIC_PROPOSAL_EXEMPLAR = `Sarah,

Good walking the backyard with you last Tuesday. Here is the proposal.

We are putting in a travertine paver patio for the main entertaining area, a cedar pergola over the dining spot to handle the afternoon sun, a gas fire pit by the seating wall, and a stretch of premium turf for the kids. Path lighting will run along the new walkway. Existing planter beds stay, and we will add drip irrigation throughout so you are not babysitting anything.

We have done a few projects in your HOA. The submission package is not complicated but adds three to four weeks to your start date, so plan on six weeks from signed proposal to crew on site. Once you are in, we handle the HOA package, permit pulls, and design sign-off. You will not be chasing paperwork.

When you are ready to move, the deposit kicks off your spot on the schedule.

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
  const scopeText = buildScopeForLLM(ctx.matches, ctx.catalog);
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
      text: `No uploaded proposal exemplars yet. Use this example to calibrate voice. Notice: no markdown markers, plain prose only, sign-off is just "Marcus" on its own line.\n\n${SYNTHETIC_PROPOSAL_EXEMPLAR}`,
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
Site constraints: ${ctx.scope.site_constraints.join(", ") || "none"}

The scope of work for this proposal:
${scopeText}

Write the proposal now. Plain prose, no markdown. Keep in mind: a formatted table of the items above with quantities and prices is rendered in the PDF right below your prose. Do not promise to send numbers later. Do not refer to "matched items", "the system", or any internal terminology. You are Marcus typing this proposal to the client.`;

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

    const cleaned = stripMarkdownArtifacts(text.text.trim());
    return { ok: true, narrative: cleaned };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown narrative writer error." };
  }
}

function stripMarkdownArtifacts(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, "$1")
    .replace(/^[ \t]*[-=]{3,}[ \t]*$/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildScopeForLLM(matches: LineMatchResult[], catalog: PricingItem[]): string {
  const lines: string[] = [];
  for (const m of matches) {
    const pricing = m.pricing_item_id ? catalog.find((c) => c.id === m.pricing_item_id) : null;
    if (pricing) {
      lines.push(`- ${pricing.item_name} (${m.scope_item.quantity} ${m.scope_item.unit})`);
    } else {
      lines.push(`- ${m.scope_item.description} (${m.scope_item.quantity} ${m.scope_item.unit})`);
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
    result.voiceDocs = `Past writing samples by Marcus (use as voice and style references):\n\n${voiceDocs
      .map((v) => `--- ${v.source_filename ?? "voice doc"} ---\n${truncate(v.content, 2000)}`)
      .join("\n\n")}`;
  }

  if (proposals.length > 0) {
    result.proposals = `Past proposals Marcus has actually signed and sent. These are the authoritative source on STRUCTURE (section order, what goes where, how he opens, how he signs off) AND VOICE (word choice, phrasing, tone). When in doubt about structure, match these. Do not impose a different template if these show a consistent pattern.\n\n${proposals
      .map((p) => `--- ${p.source_filename ?? "past proposal"} ---\n${truncate(p.content, 3000)}`)
      .join("\n\n")}`;
  }

  if (corrections.length > 0) {
    result.corrections = `Recent corrections Marcus made on previous proposals (the original was the AI version, the edited version is how Marcus actually writes — match the edited style):\n\n${corrections
      .map((c, i) => {
        const meta = (c.metadata ?? {}) as { original?: string; edited?: string };
        return `Correction ${i + 1}:\n- Original: ${truncate(meta.original ?? "", 500)}\n- Marcus's version: ${truncate(meta.edited ?? "", 500)}`;
      })
      .join("\n\n")}`;
  }

  return result;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}
