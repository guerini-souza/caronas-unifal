import "server-only";
import webpush from "web-push";
import { getPushConfig } from "@/lib/push/config";
import type { PushPayload } from "@/lib/push/messages";
import { createAdminClient } from "@/lib/supabase/admin";

const SUBJECT = "mailto:caronasunifal@gmail.com";
// O banco guarda no máximo 5 celulares por conta; envio em lotes para não disparar tudo de uma vez.
const MAX_DEVICES_PER_USER = 5;
const BATCH = 10;

type Subscription = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Envia a notificação para todos os celulares de cada usuário.
 * Devolve os usuários que receberam em pelo menos um celular.
 * Celulares que o serviço de push diz não existir mais (404/410) são apagados.
 */
export async function sendPush(userIds: string[], payload: PushPayload, ttlSeconds: number): Promise<Set<string>> {
  const delivered = new Set<string>();
  const ids = [...new Set(userIds)];
  const config = await getPushConfig();
  const admin = createAdminClient();
  if (ids.length === 0 || !config || !admin) return delivered;

  const { data } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", ids)
    .limit(ids.length * MAX_DEVICES_PER_USER);
  const subscriptions = (data ?? []) as Subscription[];
  const expired: string[] = [];
  const body = JSON.stringify(payload);

  const send = async (s: Subscription) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
        vapidDetails: { subject: SUBJECT, publicKey: config.publicKey, privateKey: config.privateKey },
        TTL: ttlSeconds,
        urgency: "high",
        timeout: 8000,
      });
      delivered.add(s.user_id);
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) expired.push(s.id);
    }
  };
  for (let i = 0; i < subscriptions.length; i += BATCH) {
    await Promise.all(subscriptions.slice(i, i + BATCH).map(send));
  }

  if (expired.length > 0) await admin.from("push_subscriptions").delete().in("id", expired);
  return delivered;
}
