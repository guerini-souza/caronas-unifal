// Quando os botões INICIEI A ROTA e ESTOU NO LOCAL ficam disponíveis.
// Mesma janela do banco (start_ride / mark_arrived): 30 min antes até 60 min depois do horário.
export const TRIP_OPENS_BEFORE_MIN = 30;
export const TRIP_CLOSES_AFTER_MIN = 60;
const SOON_HOURS = 12;

/** later: falta muito · soon: libera nas próximas 12 h · open: botões liberados · closed: encerrado. */
export type TripPhase = "later" | "soon" | "open" | "closed";

export function tripOpensAt(departureAt: string | Date): Date {
  return new Date(new Date(departureAt).getTime() - TRIP_OPENS_BEFORE_MIN * 60_000);
}

export function tripPhase(departureAt: string | Date, now: Date = new Date()): TripPhase {
  const departure = new Date(departureAt).getTime();
  const t = now.getTime();
  const opens = departure - TRIP_OPENS_BEFORE_MIN * 60_000;
  if (t > departure + TRIP_CLOSES_AFTER_MIN * 60_000) return "closed";
  if (t >= opens) return "open";
  return opens - t <= SOON_HOURS * 3_600_000 ? "soon" : "later";
}
