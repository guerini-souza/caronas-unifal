/** Sentido da carona: IDA (bairro → UNIFAL) ou VOLTA (UNIFAL → bairro). */
export type RideDirection = "TO_CAMPUS" | "FROM_CAMPUS";

export const CAMPUS_NAME = "UNIFAL";

/** Valor usado na URL (?sentido=ida|volta). */
export type DirectionParam = "ida" | "volta";

export function parseDirection(value: unknown): RideDirection | null {
  if (value === "ida" || value === "TO_CAMPUS") return "TO_CAMPUS";
  if (value === "volta" || value === "FROM_CAMPUS") return "FROM_CAMPUS";
  return null;
}

export function directionParam(d: RideDirection): DirectionParam {
  return d === "TO_CAMPUS" ? "ida" : "volta";
}

export function directionLabel(d: RideDirection): string {
  return d === "TO_CAMPUS" ? "Ida para a UNIFAL" : "Volta da UNIFAL";
}

export function directionShort(d: RideDirection): string {
  return d === "TO_CAMPUS" ? "IDA" : "VOLTA";
}

/** Rota legível: ida "A → B → UNIFAL"; volta "UNIFAL → A → B". */
export function routeText(d: RideDirection, pointNames: string[]): string {
  const pts = pointNames.join(" → ");
  return d === "TO_CAMPUS" ? `${pts} → ${CAMPUS_NAME}` : `${CAMPUS_NAME} → ${pts}`;
}

/** Verbo do passageiro em relação ao ponto: esperar (ida) ou descer (volta). */
export function pointVerb(d: RideDirection): { question: string; action: string } {
  return d === "TO_CAMPUS"
    ? { question: "Onde você vai esperar?", action: "esperar em" }
    : { question: "Onde você quer descer?", action: "descer em" };
}
