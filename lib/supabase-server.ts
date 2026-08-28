import { supabaseAdmin } from "@/lib/supabase";

// Server-side Supabase client factory used by API routes.
// These routes run on the server (no browser session), so we hand back
// the service-role client from lib/supabase.ts. Access control in each
// route is done manually via member_id / room participant checks.
export function createClient() {
  return supabaseAdmin;
  }
  