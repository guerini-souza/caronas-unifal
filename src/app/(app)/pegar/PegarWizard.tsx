"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { searchRides } from "@/app/actions/search";
import { AppButton } from "@/components/AppButton";
import { DirectionChoice } from "@/components/DirectionChoice";
import { Field } from "@/components/Field";
import { PickupPointCard } from "@/components/PickupPointCard";
import { RideCard } from "@/components/RideCard";
import { RideCardSkeleton } from "@/components/Skeleton";
import { EmptyState, ErrorMessage } from "@/components/States";
import { StepHeader } from "@/components/StepHeader";
import { useWizardSteps } from "@/components/useWizardSteps";
import { type RideDirection, directionLabel, pointVerb } from "@/lib/direction";
import { combineDateTime, formatDay, todayInAppTz } from "@/lib/format";
import type { AvailableRide, Neighborhood, PickupPoint } from "@/lib/types";

type Point = Pick<PickupPoint, "id" | "neighborhood_id" | "name">;
type Props = {
  neighborhoods: Neighborhood[];
  points: Point[];
  today: string;
  tomorrow: string;
  suggestedTime: string;
};

type Saved = {
  step: number;
  direction: RideDirection | null;
  date: string;
  time: string;
  bairroId: string;
  pontoId: string;
  savedAt: number;
};

const TOTAL = 5;
const NEAR_MS = 60 * 60 * 1000; // até 1h antes/depois conta como "perto"
const KEY = "caronas.pegar.v1";
const KEEP_MS = 60 * 60 * 1000; // lembra a busca por 1h

/** Lê a última busca (para voltar da tela da carona direto para a lista). */
function restore(today: string): Saved | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Saved | null;
    if (!s || Date.now() - s.savedAt > KEEP_MS || s.date < today) return null;
    return s;
  } catch {
    return null;
  }
}

/**
 * Fluxo "Pegar carona" 100% no celular (etapas instantâneas):
 * 1 sentido → 2 dia/horário → 3 bairro → 4 ponto → 5 caronas (única etapa que consulta o servidor).
 */
export function PegarWizard({ neighborhoods, points, today, tomorrow, suggestedTime }: Props) {
  const [saved] = useState(() => restore(today));
  const [direction, setDirection] = useState<RideDirection | null>(saved?.direction ?? null);
  const [date, setDate] = useState(saved?.date ?? today);
  const [time, setTime] = useState(saved?.time ?? suggestedTime);
  const [otherDay, setOtherDay] = useState(Boolean(saved && saved.date !== today && saved.date !== tomorrow));
  const [bairroId, setBairroId] = useState(saved?.bairroId ?? (neighborhoods.length === 1 ? neighborhoods[0].id : ""));
  const [pontoId, setPontoId] = useState(saved?.pontoId ?? "");
  const [results, setResults] = useState<{ key: string; rides: AvailableRide[]; error?: string } | null>(null);
  const [loading, startLoading] = useTransition();
  const { step, go } = useWizardSteps(saved?.step ?? 1);

  const chosen = combineDateTime(date, time);
  const ida = direction !== "FROM_CAMPUS";
  const label = direction ? directionLabel(direction) : "";
  const bairro = neighborhoods.find((n) => n.id === bairroId);
  const bairroPoints = points.filter((p) => p.neighborhood_id === bairroId);
  const point = points.find((p) => p.id === pontoId);
  const searchKey = `${pontoId}|${direction}`;

  // Guarda o progresso para restaurar ao voltar da tela da carona.
  useEffect(() => {
    try {
      const s: Saved = { step, direction, date, time, bairroId, pontoId, savedAt: Date.now() };
      sessionStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      // sem armazenamento: segue sem restaurar
    }
  }, [step, direction, date, time, bairroId, pontoId]);

  // Etapa 5: busca as caronas (vagas mudam a todo momento, então sempre busca de novo).
  useEffect(() => {
    if (step !== 5 || !pontoId || !direction) return;
    startLoading(async () => {
      const res = await searchRides(pontoId, direction);
      setResults(res.ok ? { key: searchKey, rides: res.data } : { key: searchKey, rides: [], error: res.error });
    });
  }, [step, pontoId, direction, searchKey]);

  const groups = useMemo(() => {
    const rides = results?.key === searchKey ? results.rides : [];
    const sameDay = rides.filter((r) => todayInAppTz(new Date(r.departure_at)) === date);
    const near = chosen
      ? sameDay.filter((r) => Math.abs(new Date(r.departure_at).getTime() - chosen.getTime()) <= NEAR_MS)
      : [];
    return {
      sameDay,
      near,
      later: sameDay.filter((r) => !near.includes(r)),
      otherDays: rides.filter((r) => !sameDay.includes(r)).slice(0, 5),
    };
  }, [results, searchKey, date, chosen]);

  const header = (title: string, subtitle?: string) => (
    <StepHeader
      title={title}
      subtitle={subtitle}
      step={step}
      totalSteps={TOTAL}
      accent="pegar"
      backHref={step === 1 ? "/inicio" : undefined}
      onBack={step > 1 ? () => go(step - 1) : undefined}
    />
  );

  const chip = (active: boolean) =>
    `flex min-h-14 items-center justify-center rounded-2xl border-2 px-4 text-lg font-bold transition ${
      active ? "border-pegar bg-pegar-soft text-pegar-dark" : "border-border bg-surface"
    }`;

  const card = (r: AvailableRide) => (
    <RideCard key={r.ride_id} ride={r} highlightPointId={pontoId} href={`/pegar/carona/${r.ride_id}?ponto=${pontoId}&voltar=/pegar`} />
  );

  const showingResults = results?.key === searchKey && !loading;

  return (
    <div key={step} className="step-enter">
      {step === 1 && (
        <>
          {header("Ida ou volta?")}
          <DirectionChoice
            accent="pegar"
            selected={direction}
            onSelect={(d) => {
              setDirection(d);
              go(2);
            }}
          />
        </>
      )}

      {step === 2 && (
        <>
          {header("Quando você quer sair?", label)}
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-base font-bold">Dia</p>
              <div className="grid grid-cols-3 gap-3">
                <button type="button" className={chip(!otherDay && date === today)} aria-pressed={!otherDay && date === today}
                  onClick={() => { setOtherDay(false); setDate(today); }}>
                  Hoje
                </button>
                <button type="button" className={chip(!otherDay && date === tomorrow)} aria-pressed={!otherDay && date === tomorrow}
                  onClick={() => { setOtherDay(false); setDate(tomorrow); }}>
                  Amanhã
                </button>
                <button type="button" className={chip(otherDay)} aria-pressed={otherDay} onClick={() => setOtherDay(true)}>
                  Outro
                </button>
              </div>
              {otherDay ? (
                <div className="mt-3">
                  <Field label="Escolha a data" name="data" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              ) : null}
            </div>
            <Field
              label={ida ? "Que horas você quer sair do bairro?" : "Que horas você quer sair da UNIFAL?"}
              name="hora"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              hint="Mostramos as caronas perto desse horário."
              className="text-2xl font-bold"
            />
            <AppButton variant="pegar" onClick={() => go(3)} disabled={!chosen}>
              CONTINUAR
            </AppButton>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          {header(ida ? "De qual bairro você sai?" : "Para qual bairro você volta?", chosen ? `${label} · ${formatDay(chosen)}, ${time}` : label)}
          {neighborhoods.length === 0 ? <EmptyState title="Nenhum bairro cadastrado." /> : null}
          <div className="space-y-3">
            {neighborhoods.map((n) => (
              <PickupPointCard
                key={n.id}
                name={n.name}
                accent="pegar"
                onClick={() => {
                  if (n.id !== bairroId) setPontoId("");
                  setBairroId(n.id);
                  go(4);
                }}
              />
            ))}
          </div>
        </>
      )}

      {step === 4 && direction && (
        <>
          {header(pointVerb(direction).question, `${label} · ${bairro?.name ?? ""}`)}
          {bairroPoints.length === 0 ? <EmptyState title="Nenhum ponto neste bairro." /> : null}
          <div className="space-y-3">
            {bairroPoints.map((p) => (
              <PickupPointCard
                key={p.id}
                name={p.name}
                accent="pegar"
                onClick={() => {
                  setPontoId(p.id);
                  go(5);
                }}
              />
            ))}
          </div>
        </>
      )}

      {step === 5 && direction && (
        <>
          {header(
            "Caronas disponíveis",
            `${label} · ${ida ? "esperando em" : "descendo em"} ${point?.name ?? ""}${chosen ? ` · ${formatDay(chosen)} perto das ${time}` : ""}`,
          )}
          <button
            type="button"
            onClick={() => go(2)}
            className="-mt-3 mb-5 inline-flex min-h-11 items-center font-bold text-pegar underline underline-offset-4"
          >
            Mudar dia ou horário
          </button>

          {!showingResults ? (
            <div className="space-y-4" role="status" aria-label="Buscando caronas">
              <RideCardSkeleton />
              <RideCardSkeleton />
            </div>
          ) : results?.error ? (
            <ErrorMessage>{results.error}</ErrorMessage>
          ) : (
            <>
              {groups.sameDay.length === 0 ? (
                <EmptyState
                  title={ida ? "Nenhuma carona de ida neste dia no momento." : "Nenhuma carona de volta neste dia no momento."}
                  description="Tente outro dia, outro ponto ou volte mais tarde."
                  action={
                    <AppButton onClick={() => go(4)} variant="ghost">
                      ESCOLHER OUTRO PONTO
                    </AppButton>
                  }
                />
              ) : null}

              {groups.near.length > 0 ? (
                <section className="space-y-4">
                  <h2 className="text-lg font-extrabold">Perto do seu horário</h2>
                  {groups.near.map(card)}
                </section>
              ) : groups.sameDay.length > 0 ? (
                <p className="mb-4 rounded-2xl bg-pegar-soft px-4 py-3 font-semibold text-pegar-dark">
                  Nenhuma carona perto das {time}. Veja outros horários neste dia:
                </p>
              ) : null}

              {groups.later.length > 0 ? (
                <section className="mt-8 space-y-4">
                  {groups.near.length > 0 ? <h2 className="text-lg font-extrabold">Outros horários neste dia</h2> : null}
                  {groups.later.map(card)}
                </section>
              ) : null}

              {groups.sameDay.length === 0 && groups.otherDays.length > 0 ? (
                <section className="mt-8 space-y-4">
                  <h2 className="text-lg font-extrabold">Próximas caronas em outros dias</h2>
                  {groups.otherDays.map(card)}
                </section>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}
