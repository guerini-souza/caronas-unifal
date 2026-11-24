"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type AffectedPassenger, cancelRide } from "@/app/actions/rides";
import { AppButton } from "@/components/AppButton";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { IconPin, IconWhatsapp } from "@/components/icons";
import { ShareRideButtons } from "@/components/ShareRideButtons";
import { ErrorMessage, StatusBadge, SuccessMessage } from "@/components/States";
import { directionLabel, routeText } from "@/lib/direction";
import { formatDateTime, formatPrice, formatTime, isPast } from "@/lib/format";
import type { MyRide } from "@/lib/types";
import { driverCancelMessage, whatsappUrl } from "@/lib/whatsapp";
import { StartRoutePanel } from "./StartRoutePanel";

const EMAIL_LABEL = { sent: "e-mail enviado", failed: "e-mail falhou", skipped: "e-mail não configurado" };

export function RideItem({ ride }: { ride: MyRide }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [affected, setAffected] = useState<AffectedPassenger[] | null>(null);

  const departed = isPast(ride.departure_at);
  const active = ride.status === "OPEN" || ride.status === "FULL";
  const badge = active && departed ? "DEPARTED" : ride.status;
  const activePassengers = ride.passengers.filter((p) => p.status === "ACTIVE");
  const impacted = ride.passengers.filter((p) => p.status === "CANCELLED_BY_DRIVER");
  const taken = ride.total_seats - ride.available_seats;

  function doCancel() {
    setError(null);
    startTransition(async () => {
      const res = await cancelRide(ride.ride_id);
      setOpen(false);
      if (!res.ok) return setError(res.error);
      setAffected(res.data.affected);
      router.refresh();
    });
  }

  return (
    <article className="rounded-2xl border-2 border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-oferecer">{directionLabel(ride.direction)}</p>
          <p className="text-xl font-extrabold">{formatDateTime(ride.departure_at)}</p>
          <p className="text-muted">
            {formatPrice(ride.price)} · {taken}/{ride.total_seats} vagas ocupadas
          </p>
        </div>
        <StatusBadge status={badge} />
      </div>
      <p className="mt-2 flex items-start gap-2 text-muted">
        <IconPin className="mt-0.5 h-5 w-5 shrink-0 text-oferecer" />
        {routeText(ride.direction, ride.points.map((p) => p.name))}
      </p>

      {active ? (
        <StartRoutePanel
          rideId={ride.ride_id}
          departureAt={ride.departure_at}
          startedAt={ride.started_at}
          hasPassengers={activePassengers.length > 0}
        />
      ) : null}

      {activePassengers.length > 0 ? (
        <div className="mt-4">
          <p className="font-bold">Passageiros</p>
          <ul className="mt-2 space-y-2">
            {activePassengers.map((p) => (
              <li key={p.reservation_id} className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2">
                <span>
                  <b>{p.name}</b>
                  <span className="block text-sm text-muted">{p.pickup_point}</span>
                  {p.arrived_at ? (
                    <span className="block text-sm font-bold text-success">no local ✓ {formatTime(p.arrived_at)}</span>
                  ) : null}
                </span>
                {whatsappUrl(p.phone, "Olá!") ? (
                  <a
                    href={whatsappUrl(p.phone, "Olá!") ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-whatsapp px-3 font-bold text-white"
                    aria-label={`WhatsApp de ${p.name}`}
                  >
                    <IconWhatsapp className="h-5 w-5" /> Chamar
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Após cancelar: lista de afetados com WhatsApp preenchido. */}
      {affected ? (
        <div className="mt-4 space-y-3">
          <SuccessMessage>Carona cancelada.</SuccessMessage>
          {affected.length === 0 ? <p className="text-muted">Nenhum passageiro tinha reservado.</p> : null}
          {affected.map((p, i) => (
            <div key={i} className="rounded-xl bg-background p-3">
              <p>
                <b>{p.name}</b> <span className="text-sm text-muted">· {EMAIL_LABEL[p.emailStatus]}</span>
              </p>
              {p.whatsapp ? (
                <div className="mt-2">
                  <AppButton href={p.whatsapp} external variant="whatsapp" size="md" icon={<IconWhatsapp />}>
                    AVISAR {p.name.split(" ")[0].toUpperCase()}
                  </AppButton>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : ride.status === "CANCELLED" && impacted.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="font-bold">Passageiros afetados</p>
          {impacted.map((p) => {
            const url = whatsappUrl(p.phone, driverCancelMessage(ride.departure_at));
            return (
              <div key={p.reservation_id} className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2">
                <span>{p.name}</span>
                {url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-whatsapp px-3 font-bold text-white">
                    <IconWhatsapp className="h-5 w-5" /> Avisar
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-2">
        <ErrorMessage>{error}</ErrorMessage>
      </div>

      {ride.status === "OPEN" && ride.available_seats > 0 && !departed && !affected ? (
        <div className="mt-4">
          <ShareRideButtons
            rideId={ride.ride_id}
            ride={{
              direction: ride.direction,
              departureAt: ride.departure_at,
              price: ride.price,
              availableSeats: ride.available_seats,
              points: ride.points.map((p) => p.name),
            }}
          />
        </div>
      ) : null}

      {active && !departed && !affected ? (
        <div className="mt-4">
          <AppButton variant="ghost" size="md" onClick={() => setOpen(true)} className="!border-danger !text-danger">
            CANCELAR CARONA
          </AppButton>
        </div>
      ) : null}

      <ConfirmationModal
        open={open}
        title="Cancelar esta carona?"
        message={
          activePassengers.length > 0
            ? `${activePassengers.length} passageiro(s) serão avisados e as reservas canceladas.`
            : "Ninguém reservou ainda."
        }
        confirmLabel="SIM, CANCELAR CARONA"
        busy={pending}
        onConfirm={doCancel}
        onCancel={() => setOpen(false)}
      />
    </article>
  );
}
