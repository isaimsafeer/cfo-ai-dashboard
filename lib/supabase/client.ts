import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// NOTE: We intentionally avoid throwing at module import time so `next build` works
// in environments where `.env.local` isn't present. If these variables are missing,
// Supabase requests will fail at runtime when used.
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

