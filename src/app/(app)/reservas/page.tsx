import type { Metadata } from "next";
import { AppButton } from "@/components/AppButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { EmptyState, ErrorMessage } from "@/components/States";
import { StepHeader } from "@/components/StepHeader";
import { requireProfile } from "@/lib/auth";
import { tripPhase } from "@/lib/trip";
import type { MyReservation } from "@/lib/types";
import { ReservationItem } from "./ReservationItem";

export const metadata: Metadata = { title: "Minhas reservas" };
export const dynamic = "force-dynamic";

export default async function ReservasPage() {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.rpc("get_my_reservations");
  const reservations = (data ?? []) as MyReservation[];
  const live = reservations.some(
    (r) =>
      r.reservation_status === "ACTIVE" &&
      (r.ride_status === "OPEN" || r.ride_status === "FULL") &&
      tripPhase(r.departure_at) === "open",
  );

  return (
    <>
      <StepHeader title="Minhas reservas" />
      {error ? <ErrorMessage>Não foi possível carregar suas reservas.</ErrorMessage> : null}
      {!error && reservations.length === 0 ? (
        <EmptyState
          title="Você ainda não reservou nenhuma carona."
          action={
            <AppButton href="/pegar" variant="pegar">
              PEGAR CARONA
            </AppButton>
          }
        />
      ) : null}
      <div className="space-y-4">
        {reservations.map((r) => (
          <ReservationItem key={r.reservation_id} reservation={r} />
        ))}
      </div>
      <AutoRefresh active={live} />
    </>
  );
}
