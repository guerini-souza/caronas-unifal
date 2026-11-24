import Link from "next/link";
import { IconCar, IconClock, IconPin, IconSeat } from "@/components/icons";
import { CAMPUS_NAME, directionShort } from "@/lib/direction";
import { formatDay, formatPrice, formatTime } from "@/lib/format";
import type { AvailableRide } from "@/lib/types";

type Props = { ride: AvailableRide; href?: string; highlightPointId?: string };

/** Card de carona disponível. Placa sempre mascarada. */
export function RideCard({ ride, href, highlightPointId }: Props) {
  const seatsLabel = ride.available_seats === 1 ? "1 vaga" : `${ride.available_seats} vagas`;
  const body = (
    <article className="rounded-2xl border-2 border-border bg-surface p-4 shadow-sm transition hover:border-pegar">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-3xl font-extrabold">
            <IconClock className="h-6 w-6 text-pegar" />
            {formatTime(ride.departure_at)}
          </p>
          <p className="text-sm font-medium text-muted">
            {formatDay(ride.departure_at)} ·{" "}
            <span className="font-bold text-pegar-dark">{directionShort(ride.direction)}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold">{formatPrice(ride.price)}</p>
          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-pegar-soft px-3 py-1 text-sm font-bold text-pegar-dark">
            <IconSeat className="h-4 w-4" />
            {seatsLabel}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-base">
        <p>
          <span className="font-bold">{ride.driver_first_name || "Motorista"}</span>
        </p>
        <p className="flex items-center gap-2 text-muted">
          <IconCar className="h-5 w-5 shrink-0" />
          <span className="min-w-0 break-words">
            {ride.vehicle_model} · {ride.vehicle_color} · <span className="font-mono">{ride.plate_masked}</span>
          </span>
        </p>
        <p className="flex items-start gap-2 text-muted">
          <IconPin className="mt-0.5 h-5 w-5 shrink-0" />
          <span className="min-w-0 break-words">
            {ride.direction === "FROM_CAMPUS" ? <span className="font-semibold">{CAMPUS_NAME} → </span> : null}
            {ride.points.map((p, i) => (
              <span key={p.id}>
                {i > 0 ? " → " : ""}
                <span className={p.id === highlightPointId ? "font-bold text-foreground" : ""}>{p.name}</span>
              </span>
            ))}
            {ride.direction === "TO_CAMPUS" ? <span className="font-semibold"> → {CAMPUS_NAME}</span> : null}
          </span>
        </p>
      </div>
      {ride.is_mine ? (
        <p className="mt-3 rounded-xl bg-oferecer-soft px-3 py-2 text-sm font-bold text-oferecer-dark">
          Sua carona — é assim que os passageiros veem
        </p>
      ) : href ? (
        <p className="mt-3 text-right text-sm font-bold text-pegar" aria-hidden>
          Ver e reservar →
        </p>
      ) : null}
      {ride.already_reserved ? (
        <p className="mt-3 rounded-xl bg-success-soft px-3 py-2 text-sm font-bold text-success">Você já reservou</p>
      ) : null}
    </article>
  );

  return href ? (
    <Link href={href} className="block rounded-2xl" aria-label={`Carona das ${formatTime(ride.departure_at)}, ${formatPrice(ride.price)}, ${seatsLabel}`}>
      {body}
    </Link>
  ) : (
    body
  );
}
