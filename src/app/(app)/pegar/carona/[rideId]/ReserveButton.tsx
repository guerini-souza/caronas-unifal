"use client";

import { useState, useTransition } from "react";
import { reserveSeat } from "@/app/actions/reservations";
import { AppButton } from "@/components/AppButton";
import { IconCheck, IconWhatsapp } from "@/components/icons";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { ErrorMessage } from "@/components/States";
import type { RideDirection } from "@/lib/direction";
import { formatDateTime } from "@/lib/format";

type Success = {
  whatsapp: string | null;
  driverName: string;
  pointName: string;
  departureAt: string;
  availableSeats: number;
};

export function ReserveButton({ rideId, pointId, direction }: { rideId: string; pointId: string; direction: RideDirection }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);

  function confirm() {
    setError(null);
    // Abre a aba já no clique (evita bloqueio de pop-up) e navega após a reserva.
    const tab = window.open("", "_blank");
    startTransition(async () => {
      const res = await reserveSeat(rideId, pointId);
      if (!res.ok) {
        tab?.close();
        return setError(res.error);
      }
      setSuccess(res.data);
      window.scrollTo({ top: 0 });
      if (res.data.whatsapp && tab) {
        tab.opener = null;
        tab.location.href = res.data.whatsapp;
      } else {
        tab?.close();
      }
    });
  }

  if (success) {
    return (
      <div className="text-center" role="status">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success text-white">
          <IconCheck className="h-12 w-12" />
        </div>
        <h2 className="mt-4 text-2xl font-extrabold">Carona confirmada!</h2>
        <p className="mt-2 text-lg text-muted">
          {formatDateTime(success.departureAt)} · {direction === "TO_CAMPUS" ? "espere em" : "saída da UNIFAL, descer em"} <b>{success.pointName}</b>
        </p>
        <p className="mt-1 text-base text-muted">
          Vagas restantes: <b>{success.availableSeats}</b>
        </p>
        <div className="mt-6 space-y-3">
          {success.whatsapp ? (
            <AppButton href={success.whatsapp} external variant="whatsapp" icon={<IconWhatsapp />}>
              FALAR COM {success.driverName.toUpperCase() || "MOTORISTA"}
            </AppButton>
          ) : null}
          <AppButton href="/reservas" variant="ghost">
            MINHAS RESERVAS
          </AppButton>
        </div>
        <div className="mt-6 text-left">
          <NotificationPrompt context="reservado" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ErrorMessage>{error}</ErrorMessage>
      <AppButton variant="pegar" size="xl" onClick={confirm} disabled={pending} aria-busy={pending}>
        {pending ? "CONFIRMANDO..." : "CONFIRMAR CARONA"}
      </AppButton>
    </div>
  );
}
