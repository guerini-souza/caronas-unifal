"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import type { RideDirection } from "@/lib/direction";
import { friendlyError } from "@/lib/errors";
import { arrivedPush, routeStartedPush } from "@/lib/push/messages";
import { sendPush } from "@/lib/push/send";
import type { ActionResult } from "@/lib/types";
import { arrivedMessage, routeStartedMessage, whatsappUrl } from "@/lib/whatsapp";

type StartRow = {
  newly_started: boolean;
  started_at: string;
  departure_at: string;
  direction: RideDirection;
  driver_first_name: string | null;
  passengers: { reservation_id: string; passenger_id: string; name: string | null; phone: string | null; pickup_point: string }[];
};

export type StartedPassenger = {
  reservationId: string;
  name: string;
  point: string;
  /** true: recebeu no celular · false: sem notificações · null: a rota já tinha sido iniciada. */
  notified: boolean | null;
  whatsapp: string | null;
};

/** INICIEI A ROTA: o banco confere dono e horário; cada passageiro recebe o aviso com o próprio ponto. */
export async function startRoute(
  rideId: string,
): Promise<ActionResult<{ startedAt: string; newlyStarted: boolean; passengers: StartedPassenger[] }>> {
  if (!z.uuid().safeParse(rideId).success) return { ok: false, error: "Carona inválida." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("start_ride", { p_ride_id: rideId }).single<StartRow>();
  if (error || !data) return { ok: false, error: friendlyError(error) };

  const delivered = new Set<string>();
  if (data.newly_started) {
    const results = await Promise.all(
      data.passengers.map((p) =>
        sendPush(
          [p.passenger_id],
          routeStartedPush({
            rideId,
            driverName: data.driver_first_name ?? "",
            direction: data.direction,
            departureAt: data.departure_at,
            pointName: p.pickup_point,
          }),
          1800,
        ),
      ),
    );
    results.forEach((set) => set.forEach((id) => delivered.add(id)));
  }

  revalidatePath("/minhas-caronas", "layout");
  return {
    ok: true,
    data: {
      startedAt: data.started_at,
      newlyStarted: data.newly_started,
      passengers: data.passengers.map((p) => ({
        reservationId: p.reservation_id,
        name: p.name || "Passageiro",
        point: p.pickup_point,
        notified: data.newly_started ? delivered.has(p.passenger_id) : null,
        whatsapp: p.phone ? whatsappUrl(p.phone, routeStartedMessage(data.direction, p.pickup_point, data.departure_at)) : null,
      })),
    },
  };
}

type ArrivedRow = {
  newly_arrived: boolean;
  arrived_at: string;
  ride_id: string;
  direction: RideDirection;
  departure_at: string;
  pickup_point_name: string;
  passenger_first_name: string | null;
  driver_id: string;
  driver_first_name: string | null;
  driver_phone: string | null;
};

/** ESTOU NO LOCAL: o banco confere a reserva e o horário; o motorista recebe o aviso. */
export async function markArrived(
  reservationId: string,
): Promise<ActionResult<{ arrivedAt: string; driverNotified: boolean | null; whatsapp: string | null }>> {
  if (!z.uuid().safeParse(reservationId).success) return { ok: false, error: "Reserva inválida." };
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.rpc("mark_arrived", { p_reservation_id: reservationId }).single<ArrivedRow>();
  if (error || !data) return { ok: false, error: friendlyError(error) };

  let driverNotified: boolean | null = null;
  if (data.newly_arrived) {
    const delivered = await sendPush(
      [data.driver_id],
      arrivedPush({
        rideId: data.ride_id,
        passengerId: user.id,
        passengerName: data.passenger_first_name ?? "",
        direction: data.direction,
        pointName: data.pickup_point_name,
      }),
      900,
    );
    driverNotified = delivered.has(data.driver_id);
  }

  revalidatePath("/reservas");
  return {
    ok: true,
    data: {
      arrivedAt: data.arrived_at,
      driverNotified,
      whatsapp: data.driver_phone ? whatsappUrl(data.driver_phone, arrivedMessage(data.direction, data.pickup_point_name)) : null,
    },
  };
}
