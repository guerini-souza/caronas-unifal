"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { isAllowedPushEndpoint } from "@/lib/push/endpoint";

const subscriptionSchema = z.object({
  endpoint: z.string().refine(isAllowedPushEndpoint),
  p256dh: z.string().regex(/^[A-Za-z0-9_-]{20,200}={0,2}$/),
  auth: z.string().regex(/^[A-Za-z0-9_-]{8,100}={0,2}$/),
});

/** Liga este celular à conta logada (troca de conta no mesmo aparelho reatribui). */
export async function savePushSubscription(
  input: z.input<typeof subscriptionSchema>,
  userAgent: string,
): Promise<{ ok: boolean }> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.p256dh,
    p_auth: parsed.data.auth,
    p_user_agent: String(userAgent ?? "").slice(0, 300),
  });
  return { ok: !error };
}

/** Ao sair da conta: este celular para de receber os avisos dela. */
export async function removePushSubscription(endpoint: string): Promise<void> {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return;
  const { supabase } = await requireUser();
  await supabase.rpc("delete_push_subscription", { p_endpoint: endpoint });
}
