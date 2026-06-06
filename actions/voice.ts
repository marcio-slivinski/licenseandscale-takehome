"use server";

/**
 * Server actions for voice training (file uploads).
 *
 *  - uploadVoiceFile  → parses file, stores as voice_exemplar (type='proposal' or 'voice_doc').
 *  - deleteVoiceExemplar → removes uploaded exemplar.
 *
 * Edit corrections are captured automatically in actions/proposals.ts → approveProposal.
 */

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { parseFile } from "@/lib/parsers";

export type UploadResult =
  | { ok: true; id: string; charCount: number }
  | { ok: false; error: string };

export async function uploadVoiceFile(
  type: "proposal" | "voice_doc",
  filename: string,
  fileBuffer: ArrayBuffer,
  tags: string[] = [],
): Promise<UploadResult> {
  const buffer = Buffer.from(fileBuffer);
  if (buffer.byteLength > 10 * 1024 * 1024) {
    return { ok: false, error: "File too large (>10MB). Split it." };
  }

  const parsed = await parseFile(filename, buffer);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  if (parsed.text.length < 50) return { ok: false, error: "Parsed text too short (<50 chars). Check the file." };

  const { data, error } = await supabaseAdmin
    .from("voice_exemplars")
    .insert({
      type,
      source_filename: filename,
      content: parsed.text,
      tags,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: `Save failed: ${error.message}` };

  await supabaseAdmin.from("audit_log").insert({
    entity_type: "voice_exemplar",
    entity_id: data.id,
    action: "uploaded",
    actor: "marcus",
    metadata: { type, filename, char_count: parsed.text.length },
  });

  revalidatePath("/settings/voice");
  return { ok: true, id: data.id, charCount: parsed.text.length };
}

export async function deleteVoiceExemplar(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin.from("voice_exemplars").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/voice");
  return { ok: true };
}

/**
 * Bulk delete voice exemplars (used by the corrections manager).
 *
 * Use case: Marcus wants a clean slate before uploading new exemplars, or wants to
 * purge stale auto-captured edit_corrections that no longer represent his voice.
 */
export async function deleteVoiceExemplars(ids: string[]): Promise<{ ok: boolean; deleted?: number; error?: string }> {
  if (ids.length === 0) return { ok: true, deleted: 0 };
  const { error, count } = await supabaseAdmin
    .from("voice_exemplars")
    .delete({ count: "exact" })
    .in("id", ids);
  if (error) return { ok: false, error: error.message };
  await supabaseAdmin.from("audit_log").insert({
    entity_type: "voice_exemplar",
    entity_id: "00000000-0000-0000-0000-000000000000",
    action: "edited",
    actor: "marcus",
    metadata: { action: "bulk_deleted", count: count ?? ids.length },
  });
  revalidatePath("/settings/voice");
  return { ok: true, deleted: count ?? ids.length };
}
