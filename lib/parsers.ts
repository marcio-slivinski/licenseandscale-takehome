/**
 * File parsers for voice training uploads.
 *
 * Supported: .pdf, .docx, .txt, .md.
 * .pdf  → pdf-parse (extracts text from each page)
 * .docx → mammoth (extracts raw text)
 * .txt/.md → direct UTF-8 read
 *
 * Parsers are server-only — they run inside a server action when files are uploaded.
 */

import mammoth from "mammoth";
// pdf-parse imports lazily inside the function — it has a side-effect-y top-level that breaks Next.js bundling otherwise.

export type ParseResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function parseFile(filename: string, buffer: Buffer): Promise<ParseResult> {
  const ext = filename.toLowerCase().split(".").pop();

  try {
    switch (ext) {
      case "txt":
      case "md":
        return { ok: true, text: buffer.toString("utf-8").trim() };

      case "docx": {
        const result = await mammoth.extractRawText({ buffer });
        return { ok: true, text: result.value.trim() };
      }

      case "pdf": {
        const pdfParse = (await import("pdf-parse")).default;
        const result = await pdfParse(buffer);
        return { ok: true, text: result.text.trim() };
      }

      default:
        return { ok: false, error: `Unsupported file type: .${ext}. Use .pdf, .docx, .txt, or .md.` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Parse failed." };
  }
}
