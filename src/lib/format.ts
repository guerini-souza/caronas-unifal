import { APP_TIMEZONE, APP_UTC_OFFSET } from "@/lib/env";

/**
 * Normaliza telefone brasileiro para o formato E.164 sem "+": 55 + DDD + número.
 * Aceita "(35) 99999-1234", "+55 35 99999-1234", "035999991234" etc.
 * Retorna null se inválido.
 */
export function normalizePhone(input: string): string | null {
  let digits = (input ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Prefixo de operadora/zero de longa distância: 0 + DDD
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 12 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!/^55[1-9][0-9][0-9]{8,9}$/.test(digits)) return null;
  // Celular (9 dígitos) deve começar com 9.
  if (digits.length === 13 && digits[4] !== "9") return null;
  return digits;
}

/** Exibe 5535999991234 como (35) 99999-1234 */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

/** Normaliza placa (ABC-1234 / abc1d23) para 7 caracteres maiúsculos. */
export function normalizePlate(input: string): string | null {
  const p = (input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(p) ? p : null;
}

/** Máscara pública: ABC1D23 -> ABC-***3 (mesma regra do banco). */
export function maskPlate(plate: string): string {
  const p = (plate ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (p.length < 4) return "***";
  return `${p.slice(0, 3)}-***${p.slice(-1)}`;
}

/** Converte "5", "5,00", "R$ 5,50", "5.50" em número (2 casas). null se inválido. */
export function parsePrice(input: string): number | null {
  let s = (input ?? "").replace(/R\$\s?/i, "").trim();
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Math.round(Number(s) * 100) / 100;
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? n : null;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatPrice(value: number | string): string {
  return brl.format(Number(value));
}

/** "HH:MM" no fuso do app. */
export function formatTime(iso: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** "qua., 23/09" no fuso do app. */
export function formatDay(iso: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string | Date): string {
  return `${formatDay(iso)} às ${formatTime(iso)}`;
}

/** Hora (0-23) no fuso do app. */
export function hourInAppTz(date: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hour: "numeric",
    hourCycle: "h23",
  }).format(date);
  return Number(h) % 24;
}

/** Data de hoje (YYYY-MM-DD) no fuso do app — valor padrão do seletor de data. */
export function todayInAppTz(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Junta data (YYYY-MM-DD) e hora (HH:MM) do fuso do app em um Date. */
export function combineDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00${APP_UTC_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type Period = "morning" | "afternoon" | "night";

/** Manhã 05:00–11:59, tarde 12:00–17:59, noite 18:00–04:59. */
export function periodOfDay(hour: number): Period {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "night";
}

export function greeting(period: Period): string {
  return { morning: "bom dia", afternoon: "boa tarde", night: "boa noite" }[period];
}

/** "HH:MM" (24h) no fuso do app — usado em campos de horário. */
export function timeInAppTz(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** Datas de hoje/amanhã e um horário sugerido (próxima meia hora) no fuso do app. */
export function searchDefaults(now: Date = new Date()) {
  const next = new Date(Math.ceil(now.getTime() / (30 * 60 * 1000)) * 30 * 60 * 1000);
  return {
    today: todayInAppTz(now),
    tomorrow: todayInAppTz(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
    time: timeInAppTz(next),
  };
}

/** true se o horário já passou. */
export function isPast(iso: string | Date): boolean {
  return new Date(iso).getTime() <= Date.now();
}
