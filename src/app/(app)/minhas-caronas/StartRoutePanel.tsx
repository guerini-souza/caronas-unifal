"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type StartedPassenger, startRoute } from "@/app/actions/trips";
import { AppButton } from "@/components/AppButton";
import { IconWhatsapp } from "@/components/icons";
import { ErrorMessage, SuccessMessage } from "@/components/States";
import { formatDateTime, formatTime } from "@/lib/format";
import { tripOpensAt, tripPhase } from "@/lib/trip";

type Props = { rideId: string; departureAt: string; startedAt: string | null; hasPassengers: boolean };
type Result = { startedAt: string; newlyStarted: boolean; passengers: StartedPassenger[] };

/** Botão INICIEI A ROTA (30 min antes até 1 h depois) e o resultado do aviso aos passageiros. */
export function StartRoutePanel({ rideId, departureAt, startedAt, hasPassengers }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const phase = tripPhase(departureAt);

  function start() {
    setError(null);
    startTransition(async () => {
      const res = await startRoute(rideId);
      if (!res.ok) return setError(res.error);
      setResult(res.data);
      router.refresh();
    });
  }

  if (result) {
    const missing = result.passengers.filter((p) => p.notified === false);
    return (
      <div className="mt-4 space-y-3">
        <SuccessMessage>
          {result.newlyStarted
            ? `Rota iniciada às ${formatTime(result.startedAt)}.`
            : `A rota já tinha sido iniciada às ${formatTime(result.startedAt)}.`}
        </SuccessMessage>
        {result.newlyStarted && result.passengers.length === 0 ? <p className="text-muted">Ninguém reservou esta carona.</p> : null}
        {result.newlyStarted
          ? result.passengers
              .filter((p) => p.notified)
              .map((p) => (
                <p key={p.reservationId} className="font-semibold text-success">
                  ✓ {p.name} avisado no celular
                </p>
              ))
          : null}
        {missing.map((p) => (
          <div key={p.reservationId} className="rounded-xl bg-background p-3">
            <p>
              <b>{p.name}</b> não tem notificações ligadas.
            </p>
            {p.whatsapp ? (
              <div className="mt-2">
                <AppButton href={p.whatsapp} external variant="whatsapp" size="md" icon={<IconWhatsapp />}>
                  AVISAR {p.name.toUpperCase()} NO WHATSAPP
                </AppButton>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (startedAt) {
    return (
      <p className="mt-4 rounded-xl bg-oferecer-soft px-3 py-2 font-bold text-oferecer-dark">🚗 Rota iniciada às {formatTime(startedAt)}</p>
    );
  }

  if (phase === "open") {
    return (
      <div className="mt-4 space-y-2">
        <AppButton variant="oferecer" size="xl" onClick={start} disabled={pending} aria-busy={pending}>
          {pending ? "AVISANDO..." : "INICIEI A ROTA"}
        </AppButton>
        <p className="text-center text-sm text-muted">
          {hasPassengers ? "Os passageiros recebem o aviso no celular." : "Ninguém reservou ainda, mas você pode iniciar mesmo assim."}
        </p>
        <ErrorMessage>{error}</ErrorMessage>
      </div>
    );
  }

  if (phase === "soon") {
    return <p className="mt-4 text-sm text-muted">O botão INICIEI A ROTA libera {formatDateTime(tripOpensAt(departureAt))}.</p>;
  }
  return null;
}
