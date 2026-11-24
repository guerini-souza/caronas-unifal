"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import type { ActionResult, AvailableRide } from "@/lib/types";

/** Caronas abertas que passam pelo ponto, no sentido escolhido (IDA/VOLTA). */
export async function searchRides(
  pointId: string,
  direction: string,
): Promise<ActionResult<AvailableRide[]>> {
  const input = z
    .object({ pointId: z.uuid(), direction: z.enum(["TO_CAMPUS", "FROM_CAMPUS"]) })
    .safeParse({ pointId, direction });
  if (!input.success) return { ok: false, error: "Busca inválida." };

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("list_available_rides", {
    p_pickup_point_id: input.data.pointId,
    p_direction: input.data.direction,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, data: (data ?? []) as AvailableRide[] };
}
