import { createClient } from "@supabase/supabase-js";
import { environments } from "./environments/environments";

export const supabase = createClient(
    environments.supabaseUrl,
    environments.supabaseAnonkey
)