"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import type { ActionResult, RideDirection } from "@/lib/types";
import { passengerCancelMessage, reservationMessage, whatsappUrl } from "@/lib/whatsapp";

export async function reserveSeat(
  rideId: string,
  pointId: string,
): Promise<
  ActionResult<{
    whatsapp: string | null;
    driverName: string;
    pointName: string;
    departureAt: string;
    availableSeats: number;
  }>
> {
  const ids = z.object({ rideId: z.uuid(), pointId: z.uuid() }).safeParse({ rideId, pointId });
  if (!ids.success) return { ok: false, error: "Carona inválida." };

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .rpc("reserve_seat", { p_ride_id: ids.data.rideId, p_pickup_point_id: ids.data.pointId })
    .single<{
      reservation_id: string;
      departure_at: string;
      pickup_point_name: string;
      driver_first_name: string;
      driver_phone: string;
      available_seats: number;
      direction: RideDirection;
    }>();
  if (error || !data) return { ok: false, error: friendlyError(error) };

  revalidatePath("/reservas");
  revalidatePath("/pegar", "layout");
  return {
    ok: true,
    data: {
      whatsapp: whatsappUrl(data.driver_phone, reservationMessage(data.pickup_point_name, data.direction)),
      driverName: data.driver_first_name,
      pointName: data.pickup_point_name,
      departureAt: data.departure_at,
      availableSeats: data.available_seats,
    },
  };
}

export async function cancelReservation(
  reservationId: string,
): Promise<ActionResult<{ whatsapp: string | null }>> {
  const id = z.uuid().safeParse(reservationId);
  if (!id.success) return { ok: false, error: "Reserva inválida." };

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .rpc("cancel_reservation", { p_reservation_id: id.data })
    .single<{ departure_at: string; driver_phone: string | null }>();
  if (error || !data) return { ok: false, error: friendlyError(error) };

  revalidatePath("/reservas");
  revalidatePath("/pegar", "layout");
  return {
    ok: true,
    data: {
      whatsapp: data.driver_phone
        ? whatsappUrl(data.driver_phone, passengerCancelMessage(data.departure_at))
        : null,
    },
  };
}
