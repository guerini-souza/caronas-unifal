import { timingSafeEqual } from "node:crypto";
import { getPushConfig } from "@/lib/push/config";
import { reminderPush } from "@/lib/push/messages";
import { sendPush } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Due = { ride_id: string; driver_id: string; passenger_count: number };

function sameSecret(given: string | null, expected: string) {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Chamado pelo agendamento do Supabase (pg_cron + pg_net) quando há carona saindo em até 10 min. */
export async function POST(request: Request) {
  const config = await getPushConfig();
  const admin = createAdminClient();
  if (!config || !admin) return Response.json({ error: "indisponível" }, { status: 503 });
  if (!sameSecret(request.headers.get("x-cron-secret"), config.cronSecret)) {
    return Response.json({ error: "não autorizado" }, { status: 401 });
  }

  const { data, error } = await admin.rpc("claim_departure_reminders");
  if (error) return Response.json({ error: "falha ao buscar caronas" }, { status: 500 });
  const due = (data ?? []) as Due[];
  const results = await Promise.all(
    due.map((ride) => sendPush([ride.driver_id], reminderPush(ride.ride_id, ride.passenger_count), 600)),
  );
  return Response.json({ rides: due.length, sent: results.filter((r) => r.size > 0).length });
}
