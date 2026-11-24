import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushConfig = { publicKey: string; privateKey: string; cronSecret: string };

type Row = { vapid_public_key: string | null; vapid_private_key: string | null; cron_secret: string | null };

const CACHE_MS = 10 * 60 * 1000;
let cached: { value: PushConfig; at: number } | null = null;

/** Chaves VAPID e segredo do agendamento, guardados no Vault do Supabase (lidos com a service role). */
export async function getPushConfig(): Promise<PushConfig | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.rpc("get_push_config").maybeSingle<Row>();
  if (error || !data?.vapid_public_key || !data.vapid_private_key || !data.cron_secret) return null;
  const value = { publicKey: data.vapid_public_key, privateKey: data.vapid_private_key, cronSecret: data.cron_secret };
  cached = { value, at: Date.now() };
  return value;
}
