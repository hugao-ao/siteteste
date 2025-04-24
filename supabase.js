// Arquivo de integração com Supabase
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

export const supabase = createClient(
  "https://siteteste.supabase.co",
  "SUA_PUBLIC_API_KEY_AQUI"
);
