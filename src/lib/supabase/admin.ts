
import "server-only";

import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const secret = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !secret) throw new Error("SUPABASE_URL e SUPABASE_SECRET_KEY nao configurados.");
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
