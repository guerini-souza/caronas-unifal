"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markArrived } from "@/app/actions/trips";
import { AppButton } from "@/components/AppButton";
import { IconWhatsapp } from "@/components/icons";
import { ErrorMessage, SuccessMessage } from "@/components/States";
import { formatDateTime, formatTime } from "@/lib/format";
import { tripOpensAt, tripPhase } from "@/lib/trip";

type Props = { reservationId: string; departureAt: string; startedAt: string | null; arrivedAt: string | null };
type Result = { arrivedAt: string; driverNotified: boolean | null; whatsapp: string | null };

/** "Motorista a caminho" e o botão ESTOU NO LOCAL (30 min antes até 1 h depois). */
export function ArrivalPanel({ reservationId, departureAt, startedAt, arrivedAt }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const phase = tripPhase(departureAt);
  const arrived = result?.arrivedAt ?? arrivedAt;

  function press() {
    setError(null);
    startTransition(async () => {
      const res = await markArrived(reservationId);
      if (!res.ok) return setError(res.error);
      setResult(res.data);
      router.refresh();
    });
  }

  return (
    <div className="mt-4 space-y-3">
      {startedAt ? (
        <p className="rounded-xl bg-oferecer-soft px-3 py-2 font-bold text-oferecer-dark">🚗 Motorista a caminho desde {formatTime(startedAt)}</p>
      ) : null}

      {arrived ? (
        result?.driverNotified === false ? (
          <div className="space-y-3">
            <p className="rounded-xl bg-background px-3 py-2">O motorista não tem notificações ligadas. Avise pelo WhatsApp:</p>
            {result.whatsapp ? (
              <AppButton href={result.whatsapp} external variant="whatsapp" icon={<IconWhatsapp />}>
                AVISAR QUE CHEGUEI
              </AppButton>
            ) : null}
          </div>
        ) : (
          <SuccessMessage>
            {result?.driverNotified
              ? `Motorista avisado no celular ✓ (${formatTime(arrived)})`
              : `Você avisou que chegou às ${formatTime(arrived)}.`}
          </SuccessMessage>
        )
      ) : phase === "open" ? (
        <AppButton variant="pegar" size="xl" onClick={press} disabled={pending} aria-busy={pending}>
          {pending ? "AVISANDO..." : "ESTOU NO LOCAL"}
        </AppButton>
      ) : phase === "soon" ? (
        <p className="text-sm text-muted">O botão ESTOU NO LOCAL libera {formatDateTime(tripOpensAt(departureAt))}.</p>
      ) : null}

      <ErrorMessage>{error}</ErrorMessage>
    </div>
  );
}
