// Tradução dos códigos de erro levantados pelas funções do banco.
const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Faça login para continuar.",
  EMAIL_NOT_VERIFIED: "Confirme seu e-mail para continuar.",
  PROFILE_REQUIRED: "Complete seu perfil primeiro.",
  VEHICLE_NOT_FOUND: "Cadastre seu veículo primeiro.",
  NEIGHBORHOOD_NOT_FOUND: "Bairro inválido.",
  DEPARTURE_IN_PAST: "Escolha um horário no futuro.",
  DEPARTURE_TOO_FAR: "Escolha uma data nos próximos 60 dias.",
  INVALID_SEATS: "Número de vagas inválido.",
  INVALID_PRICE: "Preço inválido.",
  POINTS_REQUIRED: "Escolha pelo menos um ponto.",
  DUPLICATE_POINTS: "Pontos repetidos.",
  INVALID_POINTS: "Ponto inválido para este bairro.",
  RIDE_NOT_FOUND: "Carona não encontrada.",
  OWN_RIDE: "Você não pode reservar a própria carona.",
  RIDE_FULL: "Essa carona não tem mais vagas.",
  RIDE_DEPARTED: "Essa carona já saiu.",
  POINT_NOT_IN_RIDE: "Essa carona não passa por esse ponto.",
  ALREADY_RESERVED: "Você já reservou essa carona.",
  RESERVATION_NOT_FOUND: "Reserva não encontrada.",
  RESERVATION_NOT_ACTIVE: "Essa reserva já foi cancelada.",
  RIDE_NOT_ACTIVE: "Essa carona já foi cancelada ou encerrada.",
  INVALID_DIRECTION: "Escolha se é ida ou volta.",
  ROUTE_WINDOW: "Você pode iniciar a rota de 30 minutos antes até 1 hora depois do horário da carona.",
  ARRIVAL_WINDOW: "O aviso de chegada fica disponível de 30 minutos antes até 1 hora depois do horário da carona.",
};

export function friendlyError(error: { message?: string; code?: string } | null | undefined): string {
  const msg = error?.message ?? "";
  for (const key of Object.keys(MESSAGES)) {
    if (msg.includes(key)) return MESSAGES[key];
  }
  // Violação do índice único de reserva ativa (corrida entre duas abas).
  if (error?.code === "23505") return MESSAGES.ALREADY_RESERVED;
  return "Algo deu errado. Tente de novo.";
}
