"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { combineDateTime, formatDateTime, parsePrice } from "@/lib/format";
import { getEmailProvider } from "@/lib/notifications/email";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";
import { driverCancelMessage, whatsappUrl } from "@/lib/whatsapp";

const createRideSchema = z.object({
  vehicleId: z.uuid(),
  neighborhoodId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  seats: z.number().int().min(1).max(8),
  price: z.string().max(20),
  pointIds: z.array(z.uuid()).min(1).max(20),
  direction: z.enum(["TO_CAMPUS", "FROM_CAMPUS"]),
});

export type CreateRideInput = z.input<typeof createRideSchema>;

export async function createRide(input: CreateRideInput): Promise<ActionResult<{ rideId: string }>> {
  const parsed = createRideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados da carona inválidos." };

  const departure = combineDateTime(parsed.data.date, parsed.data.time);
  if (!departure || departure.getTime() <= Date.now()) {
    return { ok: false, error: "Escolha um horário no futuro." };
  }
  const price = parsePrice(parsed.data.price);
  if (price === null) return { ok: false, error: "Preço inválido." };

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_ride", {
    p_vehicle_id: parsed.data.vehicleId,
    p_neighborhood_id: parsed.data.neighborhoodId,
    p_departure_at: departure.toISOString(),
    p_total_seats: parsed.data.seats,
    p_price: price,
    p_pickup_point_ids: parsed.data.pointIds,
    p_direction: parsed.data.direction,
  });
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/minhas-caronas");
  return { ok: true, data: { rideId: data as string } };
}

export type AffectedPassenger = {
  name: string;
  pickupPoint: string;
  whatsapp: string | null;
  emailStatus: "sent" | "failed" | "skipped";
};

export async function cancelRide(rideId: string): Promise<ActionResult<{ affected: AffectedPassenger[] }>> {
  const id = z.uuid().safeParse(rideId);
  if (!id.success) return { ok: false, error: "Carona inválida." };

  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.rpc("cancel_ride", { p_ride_id: id.data });
  if (error) return { ok: false, error: friendlyError(error) };

  type Row = {
    passenger_id: string;
    passenger_name: string | null;
    passenger_phone: string | null;
    pickup_point_name: string | null;
    departure_at: string;
  };
  const rows = (data ?? []) as Row[];
  const email = getEmailProvider();
  const admin = createAdminClient();

  // E-mail dos passageiros não sai do banco para o cliente: o servidor busca com a service role.
  const emails = new Map<string, string>();
  if (admin && email.enabled && rows.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, email")
      .in("user_id", rows.map((r) => r.passenger_id));
    for (const p of profiles ?? []) if (p.email) emails.set(p.user_id, p.email);
  }

  const affected = await Promise.all(
    rows.map(async (r): Promise<AffectedPassenger> => {
      const text = driverCancelMessage(r.departure_at);
      const to = emails.get(r.passenger_id);
      const result = to
        ? await email.send({
            to,
            subject: "Carona cancelada",
            text: `${text}

Carona de ${formatDateTime(r.departure_at)}. Sua reserva foi cancelada pelo motorista.`,
          })
        : { status: "skipped" as const, detail: email.enabled ? "sem e-mail" : "e-mail não configurado" };

      await admin?.from("notification_logs").insert({
        user_id: r.passenger_id,
        created_by: user.id,
        type: "ride_cancelled",
        channel: "email",
        status: result.status,
        payload: { ride_id: id.data, detail: result.detail ?? null },
      });

      return {
        name: r.passenger_name ?? "Passageiro",
        pickupPoint: r.pickup_point_name ?? "",
        whatsapp: r.passenger_phone ? whatsappUrl(r.passenger_phone, text) : null,
        emailStatus: result.status,
      };
    }),
  );

  revalidatePath("/minhas-caronas");
  return { ok: true, data: { affected } };
}
