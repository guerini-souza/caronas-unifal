import { CAMPUS_NAME, type RideDirection } from "@/lib/direction";
import { formatTime } from "@/lib/format";

/** Conteúdo lido pelo service worker (public/sw.js). `url` é sempre um caminho interno. */
export type PushPayload = { title: string; body: string; url: string; tag: string };

export function reminderPush(rideId: string, passengerCount: number): PushPayload {
  const body =
    passengerCount === 0
      ? "Ninguém reservou ainda. Toque para ver ou compartilhar a carona."
      : `${passengerCount} ${passengerCount === 1 ? "passageiro esperando" : "passageiros esperando"}. Toque para iniciar a rota.`;
  return { title: "🚗 Sua carona sai em 10 min", body, url: `/minhas-caronas/${rideId}`, tag: `lembrete-${rideId}` };
}

export function routeStartedPush(input: {
  rideId: string;
  driverName: string;
  direction: RideDirection;
  departureAt: string;
  pointName: string;
}): PushPayload {
  const time = formatTime(input.departureAt);
  const body =
    input.direction === "TO_CAMPUS"
      ? `Esteja no ponto ${input.pointName} às ${time}.`
      : `Te encontro na ${CAMPUS_NAME} às ${time}. Você desce em ${input.pointName}.`;
  return {
    title: `🚗 ${input.driverName || "O motorista"} iniciou a rota`,
    body,
    url: "/reservas",
    tag: `rota-${input.rideId}`,
  };
}

/** A tag por carona + passageiro faz um aviso novo substituir o anterior em vez de empilhar. */
export function arrivedPush(input: {
  rideId: string;
  passengerId: string;
  passengerName: string;
  direction: RideDirection;
  pointName: string;
}): PushPayload {
  const body =
    input.direction === "TO_CAMPUS"
      ? `Esperando no ponto ${input.pointName}.`
      : `Esperando no local combinado na ${CAMPUS_NAME}.`;
  return {
    title: `📍 ${input.passengerName || "Seu passageiro"} está no local`,
    body,
    url: `/minhas-caronas/${input.rideId}`,
    tag: `chegada-${input.rideId}-${input.passengerId}`,
  };
}
