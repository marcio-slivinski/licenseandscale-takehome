/**
 * Supabase clients.
 *
 * - `supabaseAdmin` — server-only, uses service_role key. Bypasses RLS. Use in server actions + API routes.
 * - `supabaseAnon` — for client-side reads only (we don't use it directly in P0; left here for parity).
 *
 * RLS not configured in P0 (single-user demo). Production adds row-level policies per user.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");

export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY);

export const PDF_BUCKET = "proposal-pdfs";
