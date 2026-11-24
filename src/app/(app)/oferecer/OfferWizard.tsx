"use client";

import { useState, useTransition } from "react";
import { createRide } from "@/app/actions/rides";
import { AppButton } from "@/components/AppButton";
import { DirectionChoice } from "@/components/DirectionChoice";
import { Field } from "@/components/Field";
import { IconCheck } from "@/components/icons";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { PickupPointCard } from "@/components/PickupPointCard";
import { ShareRideButtons } from "@/components/ShareRideButtons";
import { EmptyState, ErrorMessage } from "@/components/States";
import { StepHeader } from "@/components/StepHeader";
import { useWizardSteps } from "@/components/useWizardSteps";
import { VehicleCard } from "@/components/VehicleCard";
import { type RideDirection, directionLabel, directionParam, routeText } from "@/lib/direction";
import { combineDateTime, formatDateTime, formatPrice, isPast, parsePrice } from "@/lib/format";
import type { Neighborhood, PickupPoint, Vehicle } from "@/lib/types";

type Point = Pick<PickupPoint, "id" | "neighborhood_id" | "name">;
type Props = {
  vehicle: Vehicle;
  neighborhoods: Neighborhood[];
  points: Point[];
  defaultNeighborhoodId: string | null;
  today: string;
  initialDirection: RideDirection | null;
};

// Etapas: 1 sentido · 2 dia/horário · 3 bairro · 4 pontos · 5 vagas · 6 preço · 7 resumo
const TOTAL = 7;
const MAX_SEATS = 8;

export function OfferWizard({ vehicle, neighborhoods, points, defaultNeighborhoodId, today, initialDirection }: Props) {
  const [direction, setDirection] = useState<RideDirection | null>(initialDirection);
  const [neighborhoodId, setNeighborhoodId] = useState<string>(
    neighborhoods.find((n) => n.id === defaultNeighborhoodId)?.id ?? (neighborhoods.length === 1 ? neighborhoods[0].id : ""),
  );
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [seats, setSeats] = useState(3);
  const [pointIds, setPointIds] = useState<string[]>([]);
  const [price, setPrice] = useState("5,00");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [publishedId, setPublishedId] = useState<string | null>(null);

  const ida = direction !== "FROM_CAMPUS";
  const neighborhood = neighborhoods.find((n) => n.id === neighborhoodId);
  const neighborhoodPoints = points.filter((p) => p.neighborhood_id === neighborhoodId);
  const selectedPoints = pointIds.map((id) => points.find((p) => p.id === id)).filter(Boolean) as Point[];
  const departure = combineDateTime(date, time);
  const priceValue = parsePrice(price);

  // Cada etapa entra no histórico: o "voltar" do celular volta uma etapa, sem perder o que foi preenchido.
  const { step, go } = useWizardSteps(1, () => setError(null));

  function chooseDirection(d: RideDirection) {
    setDirection(d);
    go(2);
  }

  function nextFromTime() {
    if (!departure) return setError("Escolha a data e o horário.");
    if (isPast(departure)) return setError("Escolha um horário no futuro.");
    go(3);
  }

  function nextFromPrice() {
    if (priceValue === null) return setError("Preço inválido. Ex.: 5,00");
    go(7);
  }

  function togglePoint(id: string) {
    // A ordem de seleção vira a ordem da rota.
    setPointIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function submit() {
    if (!direction) return setError("Escolha se é ida ou volta.");
    setError(null);
    startTransition(async () => {
      const res = await createRide({
        vehicleId: vehicle.id,
        neighborhoodId,
        date,
        time,
        seats,
        price,
        pointIds,
        direction,
      });
      if (!res.ok) return setError(res.error);
      setPublishedId(res.data.rideId);
      window.scrollTo({ top: 0 });
    });
  }

  if (publishedId && direction) {
    const other: RideDirection = direction === "TO_CAMPUS" ? "FROM_CAMPUS" : "TO_CAMPUS";
    return (
      <div className="pt-8 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success text-white">
          <IconCheck className="h-12 w-12" />
        </div>
        <h1 className="mt-6 text-2xl font-extrabold">Carona publicada!</h1>
        <p className="mt-2 text-lg font-bold">{directionLabel(direction)}</p>
        <p className="mt-1 text-lg text-muted">
          {departure ? formatDateTime(departure) : ""} · {seats} {seats === 1 ? "vaga" : "vagas"}
        </p>
        <div className="mt-8 space-y-4 text-left">
          <ShareRideButtons
            rideId={publishedId}
            ride={{
              direction,
              departureAt: departure ? departure.toISOString() : "",
              price: priceValue ?? 0,
              availableSeats: seats,
              points: selectedPoints.map((p) => p.name),
            }}
          />
          <NotificationPrompt context="publicado" />
        </div>
        <div className="mt-8 space-y-3">
          <AppButton href={`/oferecer?sentido=${directionParam(other)}`} variant="oferecer">
            {other === "FROM_CAMPUS" ? "OFERECER A VOLTA TAMBÉM" : "OFERECER A IDA TAMBÉM"}
          </AppButton>
          <AppButton href="/minhas-caronas" variant="ghost">
            VER MINHAS CARONAS
          </AppButton>
          <AppButton href="/inicio" variant="ghost">
            VOLTAR AO INÍCIO
          </AppButton>
        </div>
      </div>
    );
  }

  const header = (title: string, subtitle?: string) => (
    <StepHeader
      title={title}
      subtitle={subtitle ?? (step > 1 && direction ? directionLabel(direction) : undefined)}
      step={step}
      totalSteps={TOTAL}
      accent="oferecer"
      backHref={step === 1 ? "/inicio" : undefined}
      onBack={step > 1 ? () => go(step - 1) : undefined}
    />
  );

  return (
    <div key={step} className="step-enter">
      {step === 1 && (
        <>
          {header("Ida ou volta?")}
          <DirectionChoice accent="oferecer" selected={direction} onSelect={chooseDirection} />
        </>
      )}

      {step === 2 && (
        <>
          {header(ida ? "Que horas você sai do bairro?" : "Que horas você sai da UNIFAL?")}
          <div className="space-y-5">
            <Field label="Data" name="date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} required />
            <Field label="Horário de saída" name="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </div>
          <div className="mt-5">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
          <div className="mt-8">
            <AppButton variant="oferecer" onClick={nextFromTime}>
              CONTINUAR
            </AppButton>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          {header(ida ? "De qual bairro você sai?" : "Para qual bairro você volta?")}
          {neighborhoods.length === 0 ? <EmptyState title="Nenhum bairro cadastrado." /> : null}
          <div className="space-y-3">
            {neighborhoods.map((n) => (
              <PickupPointCard
                key={n.id}
                name={n.name}
                accent="oferecer"
                selected={n.id === neighborhoodId}
                onClick={() => {
                  if (n.id !== neighborhoodId) setPointIds([]);
                  setNeighborhoodId(n.id);
                  go(4);
                }}
              />
            ))}
          </div>
        </>
      )}

      {step === 4 && (
        <>
          {header(
            ida ? "Onde você pega os passageiros?" : "Onde você deixa os passageiros?",
            "Toque nos pontos na ordem do caminho.",
          )}
          {neighborhoodPoints.length === 0 ? <EmptyState title="Nenhum ponto neste bairro." /> : null}
          <div className="space-y-3">
            {neighborhoodPoints.map((p) => {
              const order = pointIds.indexOf(p.id);
              return (
                <PickupPointCard
                  key={p.id}
                  name={order >= 0 ? `${order + 1}. ${p.name}` : p.name}
                  accent="oferecer"
                  selected={order >= 0}
                  onClick={() => togglePoint(p.id)}
                />
              );
            })}
          </div>
          <div className="mt-8">
            <AppButton variant="oferecer" disabled={pointIds.length === 0} onClick={() => go(5)}>
              CONTINUAR
            </AppButton>
          </div>
        </>
      )}

      {step === 5 && (
        <>
          {header("Quantas vagas?")}
          <div className="flex items-center justify-center gap-6 py-6">
            <button
              type="button"
              onClick={() => setSeats((s) => Math.max(1, s - 1))}
              disabled={seats <= 1}
              aria-label="Diminuir vagas"
              className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-oferecer text-4xl font-bold text-oferecer disabled:border-border disabled:text-muted disabled:opacity-40"
            >
              −
            </button>
            <output className="w-20 text-center text-6xl font-extrabold" aria-live="polite" aria-label={`${seats} vagas`}>
              {seats}
            </output>
            <button
              type="button"
              onClick={() => setSeats((s) => Math.min(MAX_SEATS, s + 1))}
              disabled={seats >= MAX_SEATS}
              aria-label="Aumentar vagas"
              className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-oferecer text-4xl font-bold text-oferecer disabled:border-border disabled:text-muted disabled:opacity-40"
            >
              +
            </button>
          </div>
          <div className="mt-8">
            <AppButton variant="oferecer" onClick={() => go(6)}>
              CONTINUAR
            </AppButton>
          </div>
        </>
      )}

      {step === 6 && (
        <>
          {header("Quanto por pessoa?", "O pagamento é direto com o passageiro.")}
          <Field
            label="Preço (R$)"
            name="price"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="5,00"
            className="text-2xl font-bold"
          />
          <div className="mt-5">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
          <div className="mt-8">
            <AppButton variant="oferecer" onClick={nextFromPrice}>
              CONTINUAR
            </AppButton>
          </div>
        </>
      )}

      {step === 7 && direction && (
        <>
          {header("Confira sua carona")}
          <dl className="divide-y divide-border rounded-2xl bg-surface">
            {[
              ["Sentido", directionLabel(direction)],
              ["Saída", departure ? formatDateTime(departure) : ""],
              ["Bairro", neighborhood?.name ?? ""],
              ["Rota", routeText(direction, selectedPoints.map((p) => p.name))],
              ["Vagas", String(seats)],
              ["Preço", priceValue !== null ? formatPrice(priceValue) : ""],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-3">
                <dt className="font-semibold text-muted">{k}</dt>
                <dd className="text-right font-bold">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4">
            <VehicleCard vehicle={vehicle} />
          </div>
          <div className="mt-5">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
          <div className="mt-8">
            <AppButton variant="oferecer" size="xl" onClick={submit} disabled={pending} aria-busy={pending}>
              {pending ? "PUBLICANDO..." : "OFERECER CARONA"}
            </AppButton>
          </div>
        </>
      )}
    </div>
  );
}
