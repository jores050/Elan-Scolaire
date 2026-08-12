import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { assertSupabasePublicEnv, getSupabaseServiceRoleKey, hasServiceRole } from "@/lib/env";

export function createAdminClient() {
  if (!hasServiceRole()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");
  }
  const { url } = assertSupabasePublicEnv();
  return createSupabaseClient(url, getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
