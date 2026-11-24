import { CAMPUS_NAME, type RideDirection } from "@/lib/direction";
import { formatDateTime, formatPrice, formatTime, greeting, hourInAppTz, normalizePhone, periodOfDay } from "@/lib/format";

/**
 * Monta link wa.me seguro: telefone só com dígitos e texto codificado.
 * Retorna null se o telefone for inválido.
 */
export function whatsappUrl(phone: string, text: string): string | null {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Remove quebras de linha/caracteres de controle de nomes vindos do banco. */
function clean(s: string) {
  return (s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
}

export function reservationMessage(
  pointName: string,
  direction: RideDirection = "TO_CAMPUS",
  now: Date = new Date(),
) {
  const g = greeting(periodOfDay(hourInAppTz(now)));
  const point = clean(pointName);
  return direction === "TO_CAMPUS"
    ? `Olá, ${g}! Acabei de reservar uma carona de ida para a ${CAMPUS_NAME} com você. Irei esperar no ponto ${point}.`
    : `Olá, ${g}! Acabei de reservar uma carona de volta com você. Onde posso te encontrar? Irei descer no ponto ${point}.`;
}

export function passengerCancelMessage(departureAt: string | Date) {
  return `Olá! Precisei cancelar minha reserva da carona das ${formatTime(departureAt)}. Desculpe pelo transtorno.`;
}

export function driverCancelMessage(departureAt: string | Date) {
  return `Olá! Precisei cancelar a carona das ${formatTime(departureAt)}. Peço desculpas pelo transtorno.`;
}

/** Link wa.me sem número: o WhatsApp pergunta para quem enviar (contato ou grupo). */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export type ShareableRide = {
  direction: RideDirection;
  departureAt: string;
  price: number;
  availableSeats: number;
  points: string[];
};

export function rideShareMessage(ride: ShareableRide, link: string) {
  const kind = ride.direction === "TO_CAMPUS" ? `Carona de ida para a ${CAMPUS_NAME}` : `Carona de volta da ${CAMPUS_NAME}`;
  const seats = ride.availableSeats === 1 ? "1 vaga" : `${ride.availableSeats} vagas`;
  return [
    `🚗 ${kind}`,
    `${formatDateTime(ride.departureAt)} · ${formatPrice(ride.price)} · ${seats}`,
    `Pontos: ${ride.points.map(clean).join(" → ")}`,
    `Reserve pelo app e ative as notificações para saber quando eu sair: ${link}`,
  ].join("\n");
}

/** Para o passageiro sem notificações: o motorista avisa pelo WhatsApp. */
export function routeStartedMessage(direction: RideDirection, pointName: string, departureAt: string, now: Date = new Date()) {
  const g = greeting(periodOfDay(hourInAppTz(now)));
  const time = formatTime(departureAt);
  return direction === "TO_CAMPUS"
    ? `Olá, ${g}! Iniciei a rota da carona. Chego no ponto ${clean(pointName)} por volta das ${time}.`
    : `Olá, ${g}! Iniciei a rota da carona de volta. Te encontro na ${CAMPUS_NAME} às ${time}.`;
}

/** Para o motorista sem notificações: o passageiro avisa pelo WhatsApp. */
export function arrivedMessage(direction: RideDirection, pointName: string) {
  return direction === "TO_CAMPUS"
    ? `Olá! Já estou no ponto ${clean(pointName)}.`
    : `Olá! Já estou no local combinado na ${CAMPUS_NAME}.`;
}
