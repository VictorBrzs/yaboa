import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || `https://${projectId}.supabase.co`;
const chavePublica = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || publicAnonKey;

export const supabase = createClient(supabaseUrl, chavePublica);
