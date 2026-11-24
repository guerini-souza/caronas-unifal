"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelReservation } from "@/app/actions/reservations";
import { AppButton } from "@/components/AppButton";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { IconCar, IconPin, IconWhatsapp } from "@/components/icons";
import { ErrorMessage, StatusBadge, SuccessMessage } from "@/components/States";
import { directionLabel } from "@/lib/direction";
import { formatDateTime, formatPrice, isPast } from "@/lib/format";
import type { MyReservation } from "@/lib/types";
import { reservationMessage, whatsappUrl } from "@/lib/whatsapp";
import { ArrivalPanel } from "./ArrivalPanel";

export function ReservationItem({ reservation: r }: { reservation: MyReservation }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cancelWhatsapp, setCancelWhatsapp] = useState<string | null | undefined>(undefined);

  const departed = isPast(r.departure_at);
  const active = r.reservation_status === "ACTIVE";
  const canCancel = active && !departed && (r.ride_status === "OPEN" || r.ride_status === "FULL");
  const badge = active && departed ? "DEPARTED" : r.reservation_status;
  const contactUrl = active && r.driver_phone ? whatsappUrl(r.driver_phone, reservationMessage(r.pickup_point_name, r.direction)) : null;

  function doCancel() {
    setError(null);
    startTransition(async () => {
      const res = await cancelReservation(r.reservation_id);
      setOpen(false);
      if (!res.ok) return setError(res.error);
      setCancelWhatsapp(res.data.whatsapp);
      router.refresh();
    });
  }

  return (
    <article className="rounded-2xl border-2 border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-pegar">{directionLabel(r.direction)}</p>
          <p className="text-xl font-extrabold">{formatDateTime(r.departure_at)}</p>
          <p className="text-muted">{formatPrice(r.price)}</p>
        </div>
        <StatusBadge status={badge} />
      </div>
      <div className="mt-3 space-y-1">
        <p className="flex items-center gap-2">
          <IconPin className="h-5 w-5 text-pegar" /> {r.direction === "TO_CAMPUS" ? "Esperar em" : "Saída da UNIFAL · descer em"}{" "}
          <b>{r.pickup_point_name}</b>
        </p>
        <p className="flex items-center gap-2 text-muted">
          <IconCar className="h-5 w-5" /> {r.driver_first_name} · {r.vehicle_model} {r.vehicle_color} ·{" "}
          <span className="font-mono">{r.plate_masked}</span>
        </p>
      </div>

      {active && (r.ride_status === "OPEN" || r.ride_status === "FULL") && cancelWhatsapp === undefined ? (
        <ArrivalPanel reservationId={r.reservation_id} departureAt={r.departure_at} startedAt={r.started_at} arrivedAt={r.arrived_at} />
      ) : null}

      {cancelWhatsapp !== undefined ? (
        <div className="mt-4 space-y-3">
          <SuccessMessage>Reserva cancelada. A vaga foi devolvida.</SuccessMessage>
          {cancelWhatsapp ? (
            <AppButton href={cancelWhatsapp} external variant="whatsapp" icon={<IconWhatsapp />}>
              AVISAR MOTORISTA
            </AppButton>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2">
        <ErrorMessage>{error}</ErrorMessage>
      </div>

      {canCancel && cancelWhatsapp === undefined ? (
        <div className="mt-4 grid gap-3">
          {contactUrl ? (
            <AppButton href={contactUrl} external variant="whatsapp" size="md" icon={<IconWhatsapp />}>
              WHATSAPP DO MOTORISTA
            </AppButton>
          ) : null}
          <AppButton variant="ghost" size="md" onClick={() => setOpen(true)} className="!border-danger !text-danger">
            CANCELAR CARONA
          </AppButton>
        </div>
      ) : null}

      <ConfirmationModal
        open={open}
        title="Cancelar esta reserva?"
        message="Sua vaga volta a ficar disponível para outra pessoa."
        confirmLabel="SIM, CANCELAR"
        busy={pending}
        onConfirm={doCancel}
        onCancel={() => setOpen(false)}
      />
    </article>
  );
}
