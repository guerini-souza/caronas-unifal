import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";

/**
 * Client com service role: ignora RLS. Uso EXCLUSIVO no servidor e só para
 * tarefas internas (buscar e-mail para notificação, gravar logs).
 * Retorna null se a chave não estiver configurada.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
