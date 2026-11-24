# Link da carona, rota e notificações — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link compartilhável da carona pelo WhatsApp, botões INICIEI A ROTA / ESTOU NO LOCAL com aviso no celular e lembrete ao motorista 10 min antes da saída.

**Architecture:** Web Push (VAPID) enviado pelo servidor Next.js com a biblioteca `web-push`; celulares registrados na tabela `push_subscriptions`. O Supabase confere a cada minuto (`pg_cron`) se há carona saindo em ≤10 min e, só nesse caso, chama `/api/lembretes` (`pg_net`) com um segredo. Chaves VAPID, segredo e URL ficam no Vault do Supabase, lidos pelo servidor com a service role. Autorização de rota/chegada no banco (RPCs `SECURITY DEFINER`), como as reservas.

**Tech Stack:** Next.js 16.3 (App Router, Server Actions, Route Handlers), React 19.2, Tailwind 4, Supabase (Postgres, RLS, Vault, pg_cron, pg_net), `web-push` 3.6, Vitest, `pg` (script de setup).

**Spec:** `docs/superpowers/specs/2026-09-25-link-rota-notificacoes-design.md`

## Global Constraints

- ZERO API de LLM. Segredos nunca no Git: VAPID, `cron_secret` e `app_url` só no Vault (`scripts/setup-push-secrets.mjs` gera e grava).
- Next.js 16: antes de usar uma API, conferir `node_modules/next/dist/docs/`; `params`/`searchParams` são `Promise`; tipos `PageProps<"/rota">`/`LayoutProps`.
- Funções do banco: `SECURITY DEFINER`, `set search_path = ''`, nomes qualificados, `revoke ... from public, anon` e `grant` explícito (o projeto não expõe objetos novos automaticamente).
- Janela dos botões: **30 min antes até 60 min depois** do horário (`src/lib/trip.ts` = `start_ride`/`mark_arrived`).
- Lembrete: carona `OPEN`/`FULL`, não iniciada, sem lembrete, saída em `(now, now + 10 min]`, criada ≥ 10 min antes da saída; uma vez só.
- Serviços de push aceitos: `googleapis.com`, `push.services.mozilla.com`, `push.apple.com`, `notify.windows.com` (e subdomínios), só `https`.
- Textos em pt-BR; botões em MAIÚSCULAS; horários no fuso do app (`formatTime`/`formatDateTime`).
- Link público: `/carona/{rideId}`; prévia sem nome do motorista, placa ou telefone.
- Git: commits com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; push só com a conta do app:
  `GH_TOKEN="$(gh auth token --user caronasunifal)" git push origin main` (não trocar a conta ativa do `gh`).

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/trip.ts` (novo) | Fase da carona para os botões (`later`/`soon`/`open`/`closed`) |
| `src/lib/push/endpoint.ts` (novo) | Serviços de push aceitos |
| `src/lib/push/messages.ts` (novo) | Textos das notificações |
| `src/lib/share.ts` (novo) | Caminho do link público |
| `src/lib/whatsapp.ts` | + mensagens de compartilhar, rota iniciada e chegada; `wa.me` sem número |
| `supabase/migrations/20260925000005_trips_push.sql` (novo) | Colunas, `push_subscriptions`, RPCs, cron |
| `scripts/setup-push-secrets.mjs` (novo) | Gera VAPID + segredo e grava no Vault |
| `scripts/concurrency-test.mjs` | + verificações de link, rota, chegada, lembrete e celulares |
| `src/lib/push/config.ts` (novo, server) | Lê config do Vault (cache 10 min) |
| `src/lib/push/send.ts` (novo, server) | Envia push, apaga celulares expirados |
| `src/app/api/push/chave/route.ts` (novo) | Chave pública VAPID |
| `src/app/api/lembretes/route.ts` (novo) | Endpoint do agendamento |
| `public/sw.js` | + `push`, `notificationclick` |
| `src/lib/device.ts` (novo) | Plataforma, app instalado, navegador embutido (extraído de `usePwaInstall`) |
| `src/lib/push/client.ts` (novo) | Estado/ativação de push no navegador |
| `src/app/actions/push.ts` (novo) | Salvar/remover celular |
| `src/components/NotificationPrompt.tsx` (novo) | Cartão ATIVAR NOTIFICAÇÕES |
| `src/components/PushSync.tsx` (novo) | Religa o celular à conta atual; atualiza a tela ao receber push |
| `src/components/LogoutButton.tsx` (novo) | Sair removendo o celular |
| `src/app/carona/[rideId]/page.tsx` (novo) | Link público com prévia e cartão do WhatsApp |
| `src/components/ShareRideButtons.tsx` (novo) | COMPARTILHAR NO WHATSAPP + Copiar link |
| `scripts/make-brand-images.mjs` (novo) | Gera `public/brand/og.png` e `badge-96.png` |
| `src/app/actions/trips.ts` (novo) | `startRoute`, `markArrived` |
| `src/components/AutoRefresh.tsx` (novo) | Atualiza a tela a cada 30 s na janela |
| `src/app/(app)/minhas-caronas/StartRoutePanel.tsx` (novo) | INICIEI A ROTA |
| `src/app/(app)/minhas-caronas/[rideId]/page.tsx` (novo) | Carona do motorista (destino do lembrete) |
| `src/app/(app)/reservas/ArrivalPanel.tsx` (novo) | ESTOU NO LOCAL |

---

### Task 1: Utilitários puros (fase da carona, textos, serviços de push, WhatsApp, link)

**Files:**
- Create: `src/lib/trip.ts`, `src/lib/push/endpoint.ts`, `src/lib/push/messages.ts`, `src/lib/share.ts`
- Modify: `src/lib/whatsapp.ts`, `package.json`
- Test: `tests/unit/trip.test.ts`, `tests/unit/push.test.ts`, `tests/unit/whatsapp.test.ts`

**Interfaces:**
- Produces:
  - `TRIP_OPENS_BEFORE_MIN = 30`, `TRIP_CLOSES_AFTER_MIN = 60`, `type TripPhase = "later" | "soon" | "open" | "closed"`,
    `tripPhase(departureAt: string | Date, now?: Date): TripPhase`, `tripOpensAt(departureAt: string | Date): Date`
  - `isAllowedPushEndpoint(endpoint: string): boolean`
  - `type PushPayload = { title: string; body: string; url: string; tag: string }`,
    `reminderPush(rideId: string, passengerCount: number): PushPayload`,
    `routeStartedPush({ rideId, driverName, direction, departureAt, pointName }): PushPayload`,
    `arrivedPush({ rideId, reservationId, passengerName, direction, pointName }): PushPayload`
  - `rideSharePath(rideId: string): string` → `/carona/{id}`
  - `whatsappShareUrl(text: string): string`, `type ShareableRide`, `rideShareMessage(ride: ShareableRide, link: string): string`,
    `routeStartedMessage(direction, pointName, departureAt, now?): string`, `arrivedMessage(direction, pointName): string`

- [ ] **Step 1: Instalar dependências**

Run: `npm install web-push && npm install -D @types/web-push pg`
Expected: `package.json` com `web-push` em `dependencies` e `@types/web-push`, `pg` em `devDependencies`.

- [ ] **Step 2: Escrever os testes (falham)**

`tests/unit/trip.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TRIP_CLOSES_AFTER_MIN, TRIP_OPENS_BEFORE_MIN, tripOpensAt, tripPhase } from "@/lib/trip";

const departure = "2026-09-25T10:30:00.000Z";
const at = (minutes: number) => new Date(Date.parse(departure) + minutes * 60_000);

describe("tripPhase", () => {
  it("usa 30 min antes e 60 min depois (igual ao banco)", () => {
    expect(TRIP_OPENS_BEFORE_MIN).toBe(30);
    expect(TRIP_CLOSES_AFTER_MIN).toBe(60);
  });

  it("aberto de 30 min antes até 60 min depois", () => {
    expect(tripPhase(departure, at(-30))).toBe("open");
    expect(tripPhase(departure, at(0))).toBe("open");
    expect(tripPhase(departure, at(60))).toBe("open");
  });

  it("encerrado depois de 60 min", () => {
    expect(tripPhase(departure, at(61))).toBe("closed");
  });

  it("'soon' até 12 h antes de abrir; 'later' antes disso", () => {
    expect(tripPhase(departure, at(-31))).toBe("soon");
    expect(tripPhase(departure, at(-30 - 12 * 60))).toBe("soon");
    expect(tripPhase(departure, at(-31 - 12 * 60))).toBe("later");
  });

  it("aceita Date e informa quando abre", () => {
    expect(tripPhase(new Date(departure), at(0))).toBe("open");
    expect(tripOpensAt(departure).toISOString()).toBe("2026-09-25T10:00:00.000Z");
  });
});
```

`tests/unit/push.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint } from "@/lib/push/endpoint";
import { arrivedPush, reminderPush, routeStartedPush } from "@/lib/push/messages";

describe("isAllowedPushEndpoint", () => {
  it("aceita os serviços de push dos navegadores", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc:123")).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/QGx1c3Q")).toBe(true);
    expect(isAllowedPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=abc")).toBe(true);
  });

  it("recusa qualquer outro endereço", () => {
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(isAllowedPushEndpoint("https://evil.com/fcm.googleapis.com/")).toBe(false);
    expect(isAllowedPushEndpoint("https://googleapis.com.evil.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://notgoogleapis.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("não é url")).toBe(false);
    expect(isAllowedPushEndpoint(`https://fcm.googleapis.com/${"a".repeat(1000)}`)).toBe(false);
  });
});

describe("textos das notificações", () => {
  const rideId = "11111111-1111-1111-1111-111111111111";

  it("lembrete com e sem passageiros", () => {
    expect(reminderPush(rideId, 2)).toEqual({
      title: "🚗 Sua carona sai em 10 min",
      body: "2 passageiros esperando. Toque para iniciar a rota.",
      url: `/minhas-caronas/${rideId}`,
      tag: `lembrete-${rideId}`,
    });
    expect(reminderPush(rideId, 1).body).toBe("1 passageiro esperando. Toque para iniciar a rota.");
    expect(reminderPush(rideId, 0).body).toBe("Ninguém reservou ainda. Toque para ver ou compartilhar a carona.");
  });

  it("rota iniciada na ida e na volta (horário de São Paulo)", () => {
    const base = { rideId, driverName: "Pedro", departureAt: "2026-09-25T10:30:00Z", pointName: "Esquinão" };
    expect(routeStartedPush({ ...base, direction: "TO_CAMPUS" })).toEqual({
      title: "🚗 Pedro iniciou a rota",
      body: "Esteja no ponto Esquinão às 07:30.",
      url: "/reservas",
      tag: `rota-${rideId}`,
    });
    expect(routeStartedPush({ ...base, direction: "FROM_CAMPUS" }).body).toBe(
      "Te encontro na UNIFAL às 07:30. Você desce em Esquinão.",
    );
    expect(routeStartedPush({ ...base, driverName: "", direction: "TO_CAMPUS" }).title).toBe("🚗 O motorista iniciou a rota");
  });

  it("chegada do passageiro na ida e na volta", () => {
    const base = { rideId, reservationId: "r1", passengerName: "Ana", pointName: "Shopping" };
    expect(arrivedPush({ ...base, direction: "TO_CAMPUS" })).toEqual({
      title: "📍 Ana está no local",
      body: "Esperando no ponto Shopping.",
      url: `/minhas-caronas/${rideId}`,
      tag: "chegada-r1",
    });
    expect(arrivedPush({ ...base, direction: "FROM_CAMPUS" }).body).toBe("Esperando no local combinado na UNIFAL.");
  });
});
```

Acrescentar ao final de `tests/unit/whatsapp.test.ts` (e incluir `arrivedMessage, rideShareMessage, routeStartedMessage, whatsappShareUrl` no import de `@/lib/whatsapp`, mais `import { formatDateTime, formatPrice } from "@/lib/format";` e `import { rideSharePath } from "@/lib/share";`):

```ts
describe("compartilhar carona", () => {
  it("wa.me sem número (a pessoa escolhe o contato)", () => {
    expect(whatsappShareUrl("a b&c")).toBe("https://wa.me/?text=a%20b%26c");
  });

  it("mensagem com sentido, horário, preço, vagas, pontos, link e aviso de notificações", () => {
    const ride = {
      direction: "TO_CAMPUS" as const,
      departureAt: "2026-09-29T10:30:00Z",
      price: 5,
      availableSeats: 2,
      points: ["Esquinão", "Shop\nping"],
    };
    expect(rideShareMessage(ride, "https://app.test/carona/abc").split("\n")).toEqual([
      "🚗 Carona de ida para a UNIFAL",
      `${formatDateTime("2026-09-29T10:30:00Z")} · ${formatPrice(5)} · 2 vagas`,
      "Pontos: Esquinão → Shop ping",
      "Reserve pelo app e ative as notificações para saber quando eu sair: https://app.test/carona/abc",
    ]);
    expect(rideShareMessage({ ...ride, direction: "FROM_CAMPUS", availableSeats: 1 }, "x").split("\n").slice(0, 2)).toEqual([
      "🚗 Carona de volta da UNIFAL",
      `${formatDateTime("2026-09-29T10:30:00Z")} · ${formatPrice(5)} · 1 vaga`,
    ]);
  });

  it("caminho do link público", () => {
    expect(rideSharePath("abc")).toBe("/carona/abc");
  });
});

describe("avisos de rota e chegada pelo WhatsApp", () => {
  const morning = new Date("2026-09-25T10:00:00Z"); // 07:00 em São Paulo

  it("rota iniciada na ida e na volta", () => {
    expect(routeStartedMessage("TO_CAMPUS", "Esquinão", "2026-09-25T10:30:00Z", morning)).toBe(
      "Olá, bom dia! Iniciei a rota da carona. Chego no ponto Esquinão por volta das 07:30.",
    );
    expect(routeStartedMessage("FROM_CAMPUS", "Esquinão", "2026-09-25T10:30:00Z", morning)).toBe(
      "Olá, bom dia! Iniciei a rota da carona de volta. Te encontro na UNIFAL às 07:30.",
    );
  });

  it("chegada do passageiro", () => {
    expect(arrivedMessage("TO_CAMPUS", "Esquinão")).toBe("Olá! Já estou no ponto Esquinão.");
    expect(arrivedMessage("FROM_CAMPUS", "Esquinão")).toBe("Olá! Já estou no local combinado na UNIFAL.");
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/unit/trip.test.ts tests/unit/push.test.ts tests/unit/whatsapp.test.ts`
Expected: FAIL (módulos `@/lib/trip`, `@/lib/push/*`, `@/lib/share` inexistentes; funções novas não exportadas).

- [ ] **Step 4: Implementar**

`src/lib/trip.ts`:

```ts
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
```

`src/lib/push/endpoint.ts`:

```ts
// Serviços de push dos navegadores (Chrome/Android, Firefox, Safari/iPhone, Edge).
// O servidor só envia para esses endereços; o banco confere a mesma regra (push_subscriptions).
const PUSH_HOSTS = ["googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}
```

`src/lib/push/messages.ts`:

```ts
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

export function arrivedPush(input: {
  rideId: string;
  reservationId: string;
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
    tag: `chegada-${input.reservationId}`,
  };
}
```

`src/lib/share.ts`:

```ts
/** Link público da carona (prévia + reserva), usado no WhatsApp. */
export function rideSharePath(rideId: string) {
  return `/carona/${rideId}`;
}
```

`src/lib/whatsapp.ts` — trocar o import de `@/lib/format` por
`import { formatDateTime, formatPrice, formatTime, greeting, hourInAppTz, normalizePhone, periodOfDay } from "@/lib/format";`
e acrescentar ao final:

```ts
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
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run`
Expected: PASS (todos, incluindo os 59 anteriores).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/trip.ts src/lib/push src/lib/share.ts src/lib/whatsapp.ts tests/unit
git commit -m "feat: trip window, push texts and share/route WhatsApp messages"
```

---

### Task 2: Banco — migration, segredos no Vault e testes de integração

**Files:**
- Create: `supabase/migrations/20260925000005_trips_push.sql`, `scripts/setup-push-secrets.mjs`
- Modify: `scripts/concurrency-test.mjs`, `package.json` (script `setup:push`)

**Interfaces:**
- Produces (RPCs):
  - `save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text) → void` (authenticated)
  - `delete_push_subscription(p_endpoint text) → void` (authenticated)
  - `get_ride_preview(p_ride_id uuid) → (ride_id, direction, departure_at, price, available_seats, total_seats, status, neighborhood_name, points text[] em jsonb)` (anon, authenticated)
  - `start_ride(p_ride_id uuid) → (newly_started bool, started_at, departure_at, direction, driver_first_name, passengers jsonb[{reservation_id, passenger_id, name, phone, pickup_point}])`
  - `mark_arrived(p_reservation_id uuid) → (newly_arrived bool, arrived_at, ride_id, direction, departure_at, pickup_point_name, passenger_first_name, driver_id, driver_first_name, driver_phone)`
  - `claim_departure_reminders(p_only uuid[] default null) → (ride_id, driver_id, departure_at, direction, passenger_count int)` (service_role)
  - `get_push_config() → (vapid_public_key, vapid_private_key, cron_secret)` (service_role)
  - `get_my_rides(p_ride_id uuid default null)` + `started_at`, passageiros com `arrived_at`
  - `get_my_reservations()` + `started_at`, `arrived_at`
  - Erros: `RIDE_NOT_ACTIVE`, `ROUTE_WINDOW`, `ARRIVAL_WINDOW`, `RESERVATION_NOT_FOUND`, `RESERVATION_NOT_ACTIVE`
  - Vault: `app_url`, `cron_secret`, `vapid_public_key`, `vapid_private_key`

- [ ] **Step 1: Escrever as verificações de integração (falham)**

Em `scripts/concurrency-test.mjs`, acrescentar ao final de `main()` (depois de `check("admin: apaga foto", ...)`):

```js
  // ---- Link compartilhado: prévia pública sem dados pessoais ----
  const preview = await anon.rpc("get_ride_preview", { p_ride_id: rideId }).maybeSingle();
  check("link: prévia funciona sem login", !preview.error && preview.data?.ride_id === rideId, preview.error?.message);
  check(
    "link: prévia não expõe nome, placa nem telefone",
    JSON.stringify(Object.keys(preview.data ?? {}).sort()) ===
      JSON.stringify(["available_seats", "departure_at", "direction", "neighborhood_name", "points", "price", "ride_id", "status", "total_seats"]),
  );
  check("link: prévia mostra carona cancelada como indisponível", preview.data?.status === "CANCELLED");
  check("link: prévia traz os pontos em ordem", JSON.stringify(preview.data?.points) === JSON.stringify([points[0].name, points[3].name]));

  // ---- Iniciei a rota / estou no local ----
  const inMinutes = (m) => new Date(Date.now() + m * 60e3).toISOString();
  const newRide = async (minutes) => {
    const { data, error } = await driver.client.rpc("create_ride", {
      p_vehicle_id: vehicle.id, p_neighborhood_id: hood.id, p_departure_at: inMinutes(minutes),
      p_total_seats: 3, p_price: 5, p_pickup_point_ids: [points[0].id, points[2].id], p_direction: "TO_CAMPUS",
    });
    if (error) throw error;
    return data;
  };
  const tripRide = await newRide(20);
  const rider = passengers[4];
  const { data: tripRes, error: tripResErr } = await rider.client.rpc("reserve_seat", { p_ride_id: tripRide, p_pickup_point_id: points[2].id });
  if (tripResErr) throw tripResErr;
  const tripReservation = tripRes[0].reservation_id;

  const riderStart = await rider.client.rpc("start_ride", { p_ride_id: tripRide });
  check("rota: passageiro não inicia a rota do motorista", riderStart.error?.message.includes("RIDE_NOT_FOUND"));
  const start1 = await driver.client.rpc("start_ride", { p_ride_id: tripRide }).single();
  check("rota: motorista inicia (primeira vez avisa)", !start1.error && start1.data.newly_started === true, start1.error?.message);
  check(
    "rota: devolve o passageiro com o ponto dele",
    start1.data?.passengers?.length === 1 &&
      start1.data.passengers[0].passenger_id === rider.id &&
      start1.data.passengers[0].pickup_point === points[2].name,
  );
  const start2 = await driver.client.rpc("start_ride", { p_ride_id: tripRide }).single();
  check("rota: apertar de novo não avisa de novo", start2.data?.newly_started === false && start2.data?.started_at === start1.data?.started_at);
  const farRide = await newRide(180);
  check("rota: fora do horário é recusado", (await driver.client.rpc("start_ride", { p_ride_id: farRide })).error?.message.includes("ROUTE_WINDOW"));

  const strangerArrive = await passengers[5].client.rpc("mark_arrived", { p_reservation_id: tripReservation });
  check("chegada: outra pessoa não usa reserva alheia", strangerArrive.error?.message.includes("RESERVATION_NOT_FOUND"));
  const arrive1 = await rider.client.rpc("mark_arrived", { p_reservation_id: tripReservation }).single();
  check("chegada: passageiro avisa que chegou", !arrive1.error && arrive1.data.newly_arrived === true && arrive1.data.driver_id === driver.id, arrive1.error?.message);
  const arrive2 = await rider.client.rpc("mark_arrived", { p_reservation_id: tripReservation }).single();
  check("chegada: segunda vez não avisa de novo", arrive2.data?.newly_arrived === false && arrive2.data?.arrived_at === arrive1.data?.arrived_at);
  const { data: farRes } = await rider.client.rpc("reserve_seat", { p_ride_id: farRide, p_pickup_point_id: points[0].id });
  check(
    "chegada: fora do horário é recusado",
    (await rider.client.rpc("mark_arrived", { p_reservation_id: farRes[0].reservation_id })).error?.message.includes("ARRIVAL_WINDOW"),
  );

  const { data: myTrip } = await driver.client.rpc("get_my_rides", { p_ride_id: tripRide });
  check("minhas caronas: uma carona com rota e chegada", myTrip?.length === 1 && Boolean(myTrip[0].started_at) && Boolean(myTrip[0].passengers[0]?.arrived_at));
  const { data: riderList } = await rider.client.rpc("get_my_reservations");
  const riderTrip = riderList?.find((r) => r.reservation_id === tripReservation);
  check("reservas: passageiro vê rota iniciada e a própria chegada", Boolean(riderTrip?.started_at) && Boolean(riderTrip?.arrived_at));

  // ---- Lembrete de 10 min (só a service role e o agendamento) ----
  check("lembrete: aluno não aciona o lembrete", Boolean((await rider.client.rpc("claim_departure_reminders")).error));
  check("lembrete: aluno não lê as chaves do Vault", Boolean((await rider.client.rpc("get_push_config")).error));
  check("lembrete: aluno não dispara o agendamento", Boolean((await rider.client.rpc("dispatch_departure_reminders")).error));

  const lastMinute = await newRide(5); // criada em cima da hora: não recebe lembrete
  const dueRide = await newRide(6);
  const startedDue = await newRide(8);
  await driver.client.rpc("start_ride", { p_ride_id: startedDue });
  const cancelledDue = await newRide(7);
  await driver.client.rpc("cancel_ride", { p_ride_id: cancelledDue });
  await admin.from("rides").update({ created_at: new Date(Date.now() - 3600e3).toISOString() }).in("id", [dueRide, startedDue, cancelledDue]);

  const onlyTest = [lastMinute, dueRide, startedDue, cancelledDue];
  const claim1 = await admin.rpc("claim_departure_reminders", { p_only: onlyTest });
  const { data: dueRow } = await admin.from("rides").select("reminder_sent_at").eq("id", dueRide).single();
  // O agendamento real (a cada minuto) pode pegar a carona antes do teste: também vale.
  const byCron = !claim1.error && claim1.data.length === 0 && Boolean(dueRow?.reminder_sent_at);
  check(
    "lembrete: pega só a carona devida (não a criada em cima da hora, iniciada ou cancelada)",
    !claim1.error && (byCron || (claim1.data.length === 1 && claim1.data[0].ride_id === dueRide && claim1.data[0].passenger_count === 0)),
    claim1.error?.message ?? (byCron ? "pega pelo agendamento" : `${claim1.data.length} caronas`),
  );
  const claim2 = await admin.rpc("claim_departure_reminders", { p_only: onlyTest });
  check("lembrete: cada carona só uma vez", !claim2.error && claim2.data.length === 0 && Boolean(dueRow?.reminder_sent_at));

  // ---- Celulares para notificação ----
  const endpoint = `https://fcm.googleapis.com/fcm/send/teste-${run}`;
  const keys = { p_p256dh: "B".repeat(87), p_auth: "A".repeat(22), p_user_agent: "teste" };
  const save1 = await rider.client.rpc("save_push_subscription", { p_endpoint: endpoint, ...keys });
  check("push: aluno registra o celular", !save1.error, save1.error?.message);
  const badHost = await rider.client.rpc("save_push_subscription", { p_endpoint: `https://evil.example.com/${run}`, ...keys });
  check("push: recusa endereço que não é serviço de push", Boolean(badHost.error));
  const readSubs = await rider.client.from("push_subscriptions").select("endpoint");
  check("push: aluno não lê a tabela de celulares", Boolean(readSubs.error) || (readSubs.data ?? []).length === 0);
  const other = passengers[5];
  await other.client.rpc("save_push_subscription", { p_endpoint: endpoint, ...keys });
  const { data: owner } = await admin.from("push_subscriptions").select("user_id").eq("endpoint", endpoint).single();
  check("push: celular passa para quem entrou por último", owner?.user_id === other.id);
  await rider.client.rpc("delete_push_subscription", { p_endpoint: endpoint });
  const { count: still } = await admin.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("endpoint", endpoint);
  check("push: ex-dono não apaga o celular de outra pessoa", still === 1);
  await other.client.rpc("delete_push_subscription", { p_endpoint: endpoint });
  const { count: gone } = await admin.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("endpoint", endpoint);
  check("push: dono remove o celular ao sair", gone === 0);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:concurrency`
Expected: FAIL nas verificações novas (`get_ride_preview`/`start_ride`/... não existem).

- [ ] **Step 3: Escrever a migration**

`supabase/migrations/20260925000005_trips_push.sql`:

```sql
-- =====================================================================
-- Link da carona, "iniciei a rota", "estou no local" e lembrete de 10 min
-- por notificação (Web Push). Segredos no Vault: npm run setup:push.
-- =====================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

alter table public.rides
  add column started_at        timestamptz,
  add column reminder_sent_at  timestamptz;
alter table public.reservations
  add column arrived_at        timestamptz;

-- ---------------------------------------------------------------------
-- Celulares que recebem notificação (um registro por navegador/aparelho)
-- ---------------------------------------------------------------------
create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  endpoint      text not null unique
                check (char_length(endpoint) <= 1000
                       and endpoint ~ '^https://([a-z0-9-]+\.)*(googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)(:[0-9]+)?/'),
  p256dh        text not null check (char_length(p256dh) between 20 and 200),
  auth          text not null check (char_length(auth) between 8 and 100),
  user_agent    text check (char_length(user_agent) <= 300),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
-- Sem políticas e sem grants para anon/authenticated: só as funções abaixo e o service role.
grant all on public.push_subscriptions to service_role;

-- O aparelho fica com quem está logado nele agora (troca de conta no mesmo celular).
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (v_uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        last_seen_at = now();
end $$;

create function public.delete_push_subscription(p_endpoint text)
returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions s where s.endpoint = p_endpoint and s.user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- Prévia pública do link (sem nome do motorista, placa ou telefone)
-- ---------------------------------------------------------------------
create function public.get_ride_preview(p_ride_id uuid)
returns table (
  ride_id            uuid,
  direction          text,
  departure_at       timestamptz,
  price              numeric,
  available_seats    int,
  total_seats        int,
  status             text,
  neighborhood_name  text,
  points             jsonb
)
language sql stable security definer set search_path = '' as $$
  select r.id, r.direction, r.departure_at, r.price, r.available_seats, r.total_seats, r.status, n.name,
         coalesce((select jsonb_agg(pp.name order by rpp.route_order)
                   from public.ride_pickup_points rpp
                   join public.pickup_points pp on pp.id = rpp.pickup_point_id
                   where rpp.ride_id = r.id), '[]'::jsonb)
  from public.rides r
  join public.neighborhoods n on n.id = r.neighborhood_id
  where r.id = p_ride_id;
$$;

-- ---------------------------------------------------------------------
-- INICIEI A ROTA (motorista) — 30 min antes até 60 min depois
-- ---------------------------------------------------------------------
create function public.start_ride(p_ride_id uuid)
returns table (
  newly_started      boolean,
  started_at         timestamptz,
  departure_at       timestamptz,
  direction          text,
  driver_first_name  text,
  passengers         jsonb
)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := public.assert_ready_user();
  v_ride public.rides%rowtype;
  v_new  boolean := false;
begin
  select * into v_ride from public.rides r where r.id = p_ride_id and r.driver_id = v_uid for update;
  if not found then
    raise exception 'RIDE_NOT_FOUND';
  end if;
  if v_ride.status not in ('OPEN', 'FULL') then
    raise exception 'RIDE_NOT_ACTIVE';
  end if;
  if now() < v_ride.departure_at - interval '30 minutes' or now() > v_ride.departure_at + interval '60 minutes' then
    raise exception 'ROUTE_WINDOW';
  end if;
  if v_ride.started_at is null then
    v_ride.started_at := now();
    update public.rides r set started_at = v_ride.started_at where r.id = p_ride_id;
    v_new := true;
  end if;

  return query
  select v_new, v_ride.started_at, v_ride.departure_at, v_ride.direction, public.first_name(dp.name),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'reservation_id', x.id,
                    'passenger_id', x.passenger_id,
                    'name', public.first_name(p.name),
                    'phone', p.phone,
                    'pickup_point', pp.name)
                  order by x.created_at)
           from public.reservations x
           left join public.profiles p on p.user_id = x.passenger_id
           left join public.pickup_points pp on pp.id = x.pickup_point_id
           where x.ride_id = p_ride_id and x.status = 'ACTIVE'
         ), '[]'::jsonb)
  from (select 1) as one
  left join public.profiles dp on dp.user_id = v_uid;
end $$;

-- ---------------------------------------------------------------------
-- ESTOU NO LOCAL (passageiro) — mesma janela
-- ---------------------------------------------------------------------
create function public.mark_arrived(p_reservation_id uuid)
returns table (
  newly_arrived         boolean,
  arrived_at            timestamptz,
  ride_id               uuid,
  direction             text,
  departure_at          timestamptz,
  pickup_point_name     text,
  passenger_first_name  text,
  driver_id             uuid,
  driver_first_name     text,
  driver_phone          text
)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := public.assert_ready_user();
  v_res  public.reservations%rowtype;
  v_ride public.rides%rowtype;
  v_new  boolean := false;
begin
  select * into v_res from public.reservations x
  where x.id = p_reservation_id and x.passenger_id = v_uid for update;
  if not found then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;
  if v_res.status <> 'ACTIVE' then
    raise exception 'RESERVATION_NOT_ACTIVE';
  end if;
  select * into v_ride from public.rides r where r.id = v_res.ride_id;
  if v_ride.status not in ('OPEN', 'FULL') then
    raise exception 'RIDE_NOT_ACTIVE';
  end if;
  if now() < v_ride.departure_at - interval '30 minutes' or now() > v_ride.departure_at + interval '60 minutes' then
    raise exception 'ARRIVAL_WINDOW';
  end if;
  if v_res.arrived_at is null then
    v_res.arrived_at := now();
    update public.reservations x set arrived_at = v_res.arrived_at where x.id = p_reservation_id;
    v_new := true;
  end if;

  return query
  select v_new, v_res.arrived_at, v_ride.id, v_ride.direction, v_ride.departure_at, pp.name,
         public.first_name(me.name), v_ride.driver_id, public.first_name(dp.name), dp.phone
  from (select 1) as one
  left join public.pickup_points pp on pp.id = v_res.pickup_point_id
  left join public.profiles me on me.user_id = v_uid
  left join public.profiles dp on dp.user_id = v_ride.driver_id;
end $$;

-- ---------------------------------------------------------------------
-- Lembrete 10 min antes (pg_cron → pg_net → /api/lembretes)
-- ---------------------------------------------------------------------
create function public.reminder_due(r public.rides)
returns boolean
language sql stable set search_path = '' as $$
  select r.status in ('OPEN', 'FULL')
     and r.reminder_sent_at is null
     and r.started_at is null
     and r.departure_at > now()
     and r.departure_at <= now() + interval '10 minutes'
     and r.created_at <= r.departure_at - interval '10 minutes';
$$;

-- Marca e devolve as caronas devidas (atômico: duas chamadas nunca pegam a mesma).
create function public.claim_departure_reminders(p_only uuid[] default null)
returns table (
  ride_id          uuid,
  driver_id        uuid,
  departure_at     timestamptz,
  direction        text,
  passenger_count  int
)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with due as (
    select r.id
    from public.rides r
    where public.reminder_due(r) and (p_only is null or r.id = any(p_only))
    for update skip locked
  ), claimed as (
    update public.rides r
       set reminder_sent_at = now()
      from due
     where r.id = due.id
    returning r.id, r.driver_id, r.departure_at, r.direction
  )
  select c.id, c.driver_id, c.departure_at, c.direction,
         (select count(*)::int from public.reservations x where x.ride_id = c.id and x.status = 'ACTIVE')
  from claimed c;
end $$;

create function public.get_push_config()
returns table (vapid_public_key text, vapid_private_key text, cron_secret text)
language sql stable security definer set search_path = '' as $$
  select
    (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'vapid_public_key'),
    (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'vapid_private_key'),
    (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'cron_secret');
$$;

-- Roda a cada minuto; só chama a Vercel quando há carona devida.
create function public.dispatch_departure_reminders()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url    text;
  v_secret text;
begin
  if not exists (select 1 from public.rides r where public.reminder_due(r)) then
    return;
  end if;
  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'app_url';
  select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/lembretes',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    timeout_milliseconds := 10000
  );
end $$;

-- ---------------------------------------------------------------------
-- Minhas caronas / minhas reservas: + rota iniciada e chegada
-- ---------------------------------------------------------------------
drop function public.get_my_rides();
create function public.get_my_rides(p_ride_id uuid default null)
returns table (
  ride_id          uuid,
  status           text,
  departure_at     timestamptz,
  price            numeric,
  total_seats      int,
  available_seats  int,
  cancelled_at     timestamptz,
  points           jsonb,
  passengers       jsonb,
  direction        text,
  started_at       timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := public.assert_ready_user();
begin
  return query
  select r.id, r.status, r.departure_at, r.price, r.total_seats, r.available_seats,
         r.cancelled_at, public.ride_points_json(r.id),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'reservation_id', x.id,
                    'status', x.status,
                    'name', p.name,
                    'phone', p.phone,
                    'pickup_point', pp.name,
                    'arrived_at', x.arrived_at)
                  order by x.created_at)
           from public.reservations x
           left join public.profiles p on p.user_id = x.passenger_id
           left join public.pickup_points pp on pp.id = x.pickup_point_id
           where x.ride_id = r.id
             and x.status in ('ACTIVE', 'CANCELLED_BY_DRIVER', 'COMPLETED')
         ), '[]'::jsonb),
         r.direction,
         r.started_at
  from public.rides r
  where r.driver_id = v_uid and (p_ride_id is null or r.id = p_ride_id)
  order by (r.status in ('OPEN', 'FULL')) desc, r.departure_at desc
  limit 100;
end $$;

drop function public.get_my_reservations();
create function public.get_my_reservations()
returns table (
  reservation_id     uuid,
  reservation_status text,
  created_at         timestamptz,
  cancelled_at       timestamptz,
  ride_id            uuid,
  ride_status        text,
  departure_at       timestamptz,
  price              numeric,
  pickup_point_name  text,
  driver_first_name  text,
  driver_phone       text,
  vehicle_model      text,
  vehicle_color      text,
  plate_masked       text,
  direction          text,
  started_at         timestamptz,
  arrived_at         timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := public.assert_ready_user();
begin
  return query
  select x.id, x.status, x.created_at, x.cancelled_at,
         r.id, r.status, r.departure_at, r.price, pp.name,
         public.first_name(p.name),
         -- Telefone do motorista só para reservas ativas (contato via WhatsApp).
         case when x.status = 'ACTIVE' then p.phone end,
         v.model, v.color, public.mask_plate(v.plate),
         r.direction,
         r.started_at,
         x.arrived_at
  from public.reservations x
  join public.rides r on r.id = x.ride_id
  join public.pickup_points pp on pp.id = x.pickup_point_id
  join public.vehicles v on v.id = r.vehicle_id
  left join public.profiles p on p.user_id = r.driver_id
  where x.passenger_id = v_uid
  order by (x.status = 'ACTIVE') desc, r.departure_at desc
  limit 100;
end $$;

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke execute on function public.delete_push_subscription(text)                  from public, anon;
revoke execute on function public.start_ride(uuid)                                from public, anon;
revoke execute on function public.mark_arrived(uuid)                              from public, anon;
revoke execute on function public.get_my_rides(uuid)                              from public, anon;
revoke execute on function public.get_my_reservations()                           from public, anon;
revoke execute on function public.get_ride_preview(uuid)                          from public;
revoke execute on function public.reminder_due(public.rides)                      from public, anon, authenticated;
revoke execute on function public.claim_departure_reminders(uuid[])               from public, anon, authenticated;
revoke execute on function public.get_push_config()                               from public, anon, authenticated;
revoke execute on function public.dispatch_departure_reminders()                  from public, anon, authenticated;

grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text)                  to authenticated;
grant execute on function public.start_ride(uuid)                                to authenticated;
grant execute on function public.mark_arrived(uuid)                              to authenticated;
grant execute on function public.get_my_rides(uuid)                              to authenticated;
grant execute on function public.get_my_reservations()                           to authenticated;
grant execute on function public.get_ride_preview(uuid)                          to anon, authenticated;
grant execute on function public.claim_departure_reminders(uuid[])               to service_role;
grant execute on function public.get_push_config()                               to service_role;

-- ---------------------------------------------------------------------
-- Agendamentos
-- ---------------------------------------------------------------------
select cron.schedule('lembrete-saida-carona', '* * * * *', 'select public.dispatch_departure_reminders()');
select cron.schedule('limpar-historico-cron', '17 4 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);
```

- [ ] **Step 4: Script dos segredos**

`scripts/setup-push-secrets.mjs`:

```js
// Grava no Vault do Supabase os segredos das notificações (uma vez por projeto).
// Uso: npm run setup:push   (lê SUPABASE_DB_URL do .env.local; PUSH_APP_URL troca a URL do app)
// Segredos existentes são mantidos: trocar as chaves VAPID desligaria os celulares já cadastrados.
import { randomBytes } from "node:crypto";
import pg from "pg";
import webpush from "web-push";

const DB_URL = process.env.SUPABASE_DB_URL;
const APP_URL = process.env.PUSH_APP_URL ?? "https://app-caronas-seven.vercel.app";
if (!DB_URL) {
  console.error("Defina SUPABASE_DB_URL no .env.local.");
  process.exit(2);
}

const vapid = webpush.generateVAPIDKeys();
const wanted = {
  app_url: APP_URL,
  cron_secret: randomBytes(32).toString("base64url"),
  vapid_public_key: vapid.publicKey,
  vapid_private_key: vapid.privateKey,
};

// TLS sem verificação de cadeia, como o sslmode=require da CLI do Supabase.
const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const { rows } = await client.query("select name from vault.secrets where name = any($1::text[])", [Object.keys(wanted)]);
  const existing = new Set(rows.map((r) => r.name));
  // As duas chaves VAPID andam juntas: só cria se nenhuma existir.
  const vapidExists = existing.has("vapid_public_key") || existing.has("vapid_private_key");
  for (const [name, value] of Object.entries(wanted)) {
    if (existing.has(name) || (name.startsWith("vapid_") && vapidExists)) {
      console.log(`${name}: já existe (mantido)`);
      continue;
    }
    await client.query("select vault.create_secret($1, $2, $3)", [value, name, `Caronas UNIFAL: ${name}`]);
    console.log(`${name}: criado`);
  }
} finally {
  await client.end();
}
```

Em `package.json` → `scripts`, acrescentar: `"setup:push": "node --env-file=.env.local scripts/setup-push-secrets.mjs"`.

- [ ] **Step 5: Aplicar a migration e criar os segredos**

Run: `DBURL="$(grep '^SUPABASE_DB_URL=' .env.local | cut -d= -f2- | tr -d '\r"')" && npx supabase db push --db-url "$DBURL"`
Expected: `Applying migration 20260925000005_trips_push.sql...` e `Finished supabase db push.`

Run: `npm run setup:push`
Expected: `app_url: criado`, `cron_secret: criado`, `vapid_public_key: criado`, `vapid_private_key: criado` (na segunda execução, todos "já existe").

- [ ] **Step 6: Rodar e ver passar**

Run: `npm run test:concurrency`
Expected: `N/N verificações passaram.` (56 anteriores + as novas).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260925000005_trips_push.sql scripts/setup-push-secrets.mjs scripts/concurrency-test.mjs package.json package-lock.json
git commit -m "feat(db): push subscriptions, route start/arrival RPCs, public preview and 10-min reminder cron"
```

---

### Task 3: Envio das notificações (servidor + service worker)

**Files:**
- Create: `src/lib/push/config.ts`, `src/lib/push/send.ts`, `src/app/api/push/chave/route.ts`, `src/app/api/lembretes/route.ts`
- Modify: `public/sw.js`, `next.config.ts`

**Interfaces:**
- Consumes: `get_push_config`, `claim_departure_reminders` (Task 2); `reminderPush`, `PushPayload` (Task 1)
- Produces: `getPushConfig(): Promise<PushConfig | null>` (`{ publicKey, privateKey, cronSecret }`),
  `sendPush(userIds: string[], payload: PushPayload, ttlSeconds: number): Promise<Set<string>>` (usuários que receberam),
  `GET /api/push/chave` → `{ publicKey }`, `POST /api/lembretes` (header `x-cron-secret`) → `{ rides, sent }`

- [ ] **Step 1: Config e envio (server-only)**

`src/lib/push/config.ts`:

```ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushConfig = { publicKey: string; privateKey: string; cronSecret: string };

type Row = { vapid_public_key: string | null; vapid_private_key: string | null; cron_secret: string | null };

const CACHE_MS = 10 * 60 * 1000;
let cached: { value: PushConfig; at: number } | null = null;

/** Chaves VAPID e segredo do agendamento, guardados no Vault do Supabase (lidos com a service role). */
export async function getPushConfig(): Promise<PushConfig | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.rpc("get_push_config").maybeSingle<Row>();
  if (error || !data?.vapid_public_key || !data.vapid_private_key || !data.cron_secret) return null;
  const value = { publicKey: data.vapid_public_key, privateKey: data.vapid_private_key, cronSecret: data.cron_secret };
  cached = { value, at: Date.now() };
  return value;
}
```

`src/lib/push/send.ts`:

```ts
import "server-only";
import webpush from "web-push";
import { getPushConfig } from "@/lib/push/config";
import type { PushPayload } from "@/lib/push/messages";
import { createAdminClient } from "@/lib/supabase/admin";

const SUBJECT = "mailto:caronasunifal@gmail.com";

type Subscription = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Envia a notificação para todos os celulares de cada usuário.
 * Devolve os usuários que receberam em pelo menos um celular.
 * Celulares que o serviço de push diz não existir mais (404/410) são apagados.
 */
export async function sendPush(userIds: string[], payload: PushPayload, ttlSeconds: number): Promise<Set<string>> {
  const delivered = new Set<string>();
  const ids = [...new Set(userIds)];
  const config = await getPushConfig();
  const admin = createAdminClient();
  if (ids.length === 0 || !config || !admin) return delivered;

  const { data } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", ids);
  const expired: string[] = [];
  const body = JSON.stringify(payload);

  await Promise.all(
    ((data ?? []) as Subscription[]).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          vapidDetails: { subject: SUBJECT, publicKey: config.publicKey, privateKey: config.privateKey },
          TTL: ttlSeconds,
          urgency: "high",
          timeout: 8000,
        });
        delivered.add(s.user_id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(s.id);
      }
    }),
  );
  if (expired.length > 0) await admin.from("push_subscriptions").delete().in("id", expired);
  return delivered;
}
```

- [ ] **Step 2: Rotas**

`src/app/api/push/chave/route.ts`:

```ts
import { getPushConfig } from "@/lib/push/config";

export const dynamic = "force-dynamic";

/** Chave pública VAPID (não é segredo): o navegador usa para assinar as notificações. */
export async function GET() {
  const config = await getPushConfig();
  if (!config) return Response.json({ error: "indisponível" }, { status: 503 });
  return Response.json({ publicKey: config.publicKey }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
```

`src/app/api/lembretes/route.ts`:

```ts
import { timingSafeEqual } from "node:crypto";
import { getPushConfig } from "@/lib/push/config";
import { reminderPush } from "@/lib/push/messages";
import { sendPush } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Due = { ride_id: string; driver_id: string; passenger_count: number };

function sameSecret(given: string | null, expected: string) {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Chamado pelo agendamento do Supabase (pg_cron + pg_net) quando há carona saindo em até 10 min. */
export async function POST(request: Request) {
  const config = await getPushConfig();
  const admin = createAdminClient();
  if (!config || !admin) return Response.json({ error: "indisponível" }, { status: 503 });
  if (!sameSecret(request.headers.get("x-cron-secret"), config.cronSecret)) {
    return Response.json({ error: "não autorizado" }, { status: 401 });
  }

  const { data, error } = await admin.rpc("claim_departure_reminders");
  if (error) return Response.json({ error: "falha ao buscar caronas" }, { status: 500 });
  const due = (data ?? []) as Due[];
  const results = await Promise.all(
    due.map((ride) => sendPush([ride.driver_id], reminderPush(ride.ride_id, ride.passenger_count), 600)),
  );
  return Response.json({ rides: due.length, sent: results.filter((r) => r.size > 0).length });
}
```

`next.config.ts` — dentro de `nextConfig`, acrescentar `serverExternalPackages: ["web-push"],`.

- [ ] **Step 3: Service worker**

Em `public/sw.js`: trocar o comentário do topo para
`// Service worker: instalação PWA, página offline e notificações (Web Push).`,
trocar `const CACHE = "caronas-v3";` por `const CACHE = "caronas-v4";` e acrescentar ao final:

```js
// Notificação enviada pelo servidor (lembrete, rota iniciada, chegada).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const url = safePath(data.url);
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || "Caronas UNIFAL", {
        body: data.body || "",
        icon: "/brand/icon-192.png",
        badge: "/brand/badge-96.png",
        tag: data.tag || undefined,
        renotify: Boolean(data.tag),
        lang: "pt-BR",
        data: { url },
      });
      // App aberto: a tela atualiza sozinha (ex.: "motorista a caminho").
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      windows.forEach((w) => w.postMessage({ type: "push", url }));
    })(),
  );
});

// Toque na notificação: abre (ou traz para frente) o app na tela certa.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(safePath(event.notification.data && event.notification.data.url), self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if (new URL(w.url).origin !== self.location.origin) continue;
        await w.focus();
        try {
          await w.navigate(target);
        } catch {
          await self.clients.openWindow(target);
        }
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});

// Só caminhos internos ("/..."); qualquer outra coisa abre o início.
function safePath(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/inicio";
}
```

- [ ] **Step 4: Verificar compilação**

Run: `npx tsc --noEmit && npx eslint src public/sw.js`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/lib/push/config.ts src/lib/push/send.ts src/app/api next.config.ts public/sw.js
git commit -m "feat: web push delivery, reminder endpoint and service worker notifications"
```

---

### Task 4: Ativar notificações no celular

**Files:**
- Create: `src/lib/device.ts`, `src/lib/push/client.ts`, `src/app/actions/push.ts`, `src/components/NotificationPrompt.tsx`,
  `src/components/PushSync.tsx`, `src/components/LogoutButton.tsx`
- Modify: `src/components/usePwaInstall.ts`, `src/components/icons.tsx`, `src/app/(app)/layout.tsx`,
  `src/app/(app)/inicio/page.tsx`, `src/app/(app)/perfil/page.tsx`

**Interfaces:**
- Consumes: `save_push_subscription`, `delete_push_subscription` (Task 2); `GET /api/push/chave` (Task 3); `isAllowedPushEndpoint` (Task 1)
- Produces:
  - `detectPlatform(): Platform`, `detectInAppBrowser(): boolean`, `isStandalone(): boolean`, `type Platform`
  - `type PushState = "unsupported" | "needs-install" | "needs-update" | "denied" | "off" | "on"`,
    `pushSupported()`, `currentSubscription()`, `getPushState()`, `enablePush(publicKey)`, `subscriptionPayload(sub)`, `fetchPublicKey()`
  - `savePushSubscription(input: { endpoint; p256dh; auth }, userAgent: string): Promise<{ ok: boolean }>`, `removePushSubscription(endpoint: string): Promise<void>`
  - `<NotificationPrompt context="inicio" | "publicado" | "reservado" | "perfil" />`, `<PushSync userId />`, `<LogoutButton />`, `IconBell`

- [ ] **Step 1: Extrair detecção de aparelho**

`src/lib/device.ts`:

```ts
// Detecção de aparelho no navegador (chamar só no cliente).
export type Platform = "ios" | "android" | "other";

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "other";
}

/** Navegador embutido de apps (Instagram, Facebook...), onde não dá para instalar. */
export function detectInAppBrowser(): boolean {
  return /FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|; wv\)/i.test(navigator.userAgent);
}

/** Aberto como app instalado (tela inicial). */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
```

Em `src/components/usePwaInstall.ts`: apagar `type Platform`, `detectPlatform`, `detectInAppBrowser` e `isStandalone` locais e acrescentar no topo:

```ts
import { type Platform, detectInAppBrowser, detectPlatform, isStandalone } from "@/lib/device";

export type { Platform };
```

- [ ] **Step 2: Ícone de sino**

Em `src/components/icons.tsx`, acrescentar:

```tsx
export const IconBell = ({ className }: P) => (
  <svg {...base(className)}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
);
```

- [ ] **Step 3: Push no navegador**

`src/lib/push/client.ts`:

```ts
import { detectPlatform, isStandalone } from "@/lib/device";

// Estado das notificações neste aparelho (chamar só no cliente).
export type PushState = "unsupported" | "needs-install" | "needs-update" | "denied" | "off" | "on";

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) {
    // iPhone: só com o app na tela inicial (iOS 16.4+).
    if (detectPlatform() === "ios") return isStandalone() ? "needs-update" : "needs-install";
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "granted" && (await currentSubscription())) return "on";
  return "off";
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Pede permissão e assina. Chamar direto no toque do botão (exigência do iPhone). */
export async function enablePush(publicKey: string): Promise<PushSubscription> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error(permission === "denied" ? "denied" : "dismissed");
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
}

export function subscriptionPayload(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return { endpoint: subscription.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" };
}

export async function fetchPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push/chave");
    if (!res.ok) return null;
    const { publicKey } = (await res.json()) as { publicKey?: string };
    return publicKey ?? null;
  } catch {
    return null;
  }
}
```

`src/app/actions/push.ts`:

```ts
"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { isAllowedPushEndpoint } from "@/lib/push/endpoint";

const subscriptionSchema = z.object({
  endpoint: z.string().refine(isAllowedPushEndpoint),
  p256dh: z.string().regex(/^[A-Za-z0-9_-]{20,200}={0,2}$/),
  auth: z.string().regex(/^[A-Za-z0-9_-]{8,100}={0,2}$/),
});

/** Liga este celular à conta logada (troca de conta no mesmo aparelho reatribui). */
export async function savePushSubscription(
  input: z.input<typeof subscriptionSchema>,
  userAgent: string,
): Promise<{ ok: boolean }> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.p256dh,
    p_auth: parsed.data.auth,
    p_user_agent: String(userAgent ?? "").slice(0, 300),
  });
  return { ok: !error };
}

/** Ao sair da conta: este celular para de receber os avisos dela. */
export async function removePushSubscription(endpoint: string): Promise<void> {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return;
  const { supabase } = await requireUser();
  await supabase.rpc("delete_push_subscription", { p_endpoint: endpoint });
}
```

- [ ] **Step 4: Componentes**

`src/components/NotificationPrompt.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { savePushSubscription } from "@/app/actions/push";
import { AppButton } from "@/components/AppButton";
import { IconBell } from "@/components/icons";
import { InstallSteps } from "@/components/InstallSteps";
import { ErrorMessage, SuccessMessage } from "@/components/States";
import { detectInAppBrowser } from "@/lib/device";
import { type PushState, enablePush, fetchPublicKey, getPushState, subscriptionPayload } from "@/lib/push/client";

export type PromptContext = "inicio" | "publicado" | "reservado" | "perfil";

const TEXT: Record<PromptContext, string> = {
  inicio: "Receba o lembrete das suas caronas e saiba quando o motorista sair.",
  publicado: "Receba o lembrete 10 minutos antes e saiba quando os passageiros chegarem ao ponto.",
  reservado: "Saiba na hora quando o motorista iniciar a rota.",
  perfil: "Lembrete das suas caronas e avisos de rota e de chegada.",
};

const DISMISS_KEY = "caronas.push-dismissed-at";
const SHOW_AGAIN_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function dismissedRecently() {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < SHOW_AGAIN_AFTER_MS;
  } catch {
    return false;
  }
}

/** Cartão "Ative as notificações". Some quando já estão ativas (no Perfil mostra o status). */
export function NotificationPrompt({ context }: { context: PromptContext }) {
  const [state, setState] = useState<PushState | "loading" | "hidden">("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justEnabled, setJustEnabled] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const current = await getPushState();
      if (!alive) return;
      if (context === "inicio" && current !== "on" && dismissedRecently()) return setState("hidden");
      setState(current);
      // A chave vem antes do toque: no iPhone a permissão precisa ser pedida direto no clique.
      if (current === "off") {
        const key = await fetchPublicKey();
        if (alive) setPublicKey(key);
      }
    })();
    return () => {
      alive = false;
    };
  }, [context]);

  if (state === "loading" || state === "hidden") return null;
  if (state === "on") {
    return context === "perfil" || justEnabled ? <SuccessMessage>Notificações ativadas neste celular.</SuccessMessage> : null;
  }
  if (state === "unsupported") {
    return context === "perfil" ? <p className="text-muted">Este navegador não recebe notificações.</p> : null;
  }
  if (state === "needs-update") {
    return context === "inicio" ? null : (
      <p className="rounded-2xl bg-background p-4 text-base">Para receber notificações, atualize o iPhone para o iOS 16.4 ou mais novo.</p>
    );
  }
  if (state === "denied") {
    return context === "inicio" ? null : (
      <p className="rounded-2xl bg-background p-4 text-base">
        As notificações estão bloqueadas. Para ligar, abra as configurações do navegador (ou do app) e permita <b>Notificações</b> para o Caronas.
      </p>
    );
  }

  async function activate() {
    setError(null);
    if (!publicKey) return setError("Não foi possível ativar agora. Tente de novo em instantes.");
    setBusy(true);
    try {
      const subscription = await enablePush(publicKey);
      const res = await savePushSubscription(subscriptionPayload(subscription), navigator.userAgent);
      if (!res.ok) throw new Error("save");
      setJustEnabled(true);
      setState("on");
    } catch (e) {
      const reason = e instanceof Error ? e.message : "";
      if (reason === "denied") setState("denied");
      else if (reason !== "dismissed") setError("Não foi possível ativar agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setState("hidden");
  }

  return (
    <section className="rounded-2xl border-2 border-pegar bg-pegar-soft p-4" aria-labelledby={`push-${context}`}>
      <div className="flex items-start gap-3">
        <IconBell className="mt-0.5 h-7 w-7 shrink-0 text-pegar" />
        <div>
          <h2 id={`push-${context}`} className="text-lg font-extrabold">
            Ative as notificações
          </h2>
          <p className="mt-1 text-base">{TEXT[context]}</p>
        </div>
      </div>
      {state === "needs-install" ? (
        <div className="mt-3 rounded-xl bg-surface p-3 text-base">
          <p className="mb-2 font-bold">No iPhone, primeiro instale o app:</p>
          <InstallSteps platform="ios" inAppBrowser={detectInAppBrowser()} />
          <p className="mt-2">Depois abra pelo ícone na tela inicial e toque em ATIVAR NOTIFICAÇÕES.</p>
        </div>
      ) : (
        <div className="mt-4">
          <AppButton variant="pegar" onClick={activate} disabled={busy} aria-busy={busy}>
            {busy ? "ATIVANDO..." : "ATIVAR NOTIFICAÇÕES"}
          </AppButton>
        </div>
      )}
      {context === "inicio" ? (
        <div className="mt-3">
          <AppButton variant="ghost" size="md" onClick={dismiss}>
            Agora não
          </AppButton>
        </div>
      ) : null}
      <div className="mt-3">
        <ErrorMessage>{error}</ErrorMessage>
      </div>
    </section>
  );
}
```

`src/components/PushSync.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { savePushSubscription } from "@/app/actions/push";
import { currentSubscription, pushSupported, subscriptionPayload } from "@/lib/push/client";

const SYNC_KEY = "caronas.push-sync";
const SYNC_EVERY_MS = 24 * 60 * 60 * 1000;

/**
 * Mantém este celular ligado à conta logada (1×/dia por conta) e atualiza a tela
 * quando chega uma notificação com o app aberto.
 */
export function PushSync({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!pushSupported()) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "push") router.refresh();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    (async () => {
      if (Notification.permission !== "granted") return;
      const subscription = await currentSubscription();
      if (!subscription) return;
      const mark = `${userId}:${subscription.endpoint}`;
      try {
        const last = JSON.parse(localStorage.getItem(SYNC_KEY) ?? "null") as { mark: string; at: number } | null;
        if (last && last.mark === mark && Date.now() - last.at < SYNC_EVERY_MS) return;
      } catch {}
      const res = await savePushSubscription(subscriptionPayload(subscription), navigator.userAgent);
      if (res.ok) {
        try {
          localStorage.setItem(SYNC_KEY, JSON.stringify({ mark, at: Date.now() }));
        } catch {}
      }
    })().catch(() => {});

    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router, userId]);

  return null;
}
```

`src/components/LogoutButton.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { signOut } from "@/app/actions/auth";
import { removePushSubscription } from "@/app/actions/push";
import { buttonClasses } from "@/components/AppButton";
import { currentSubscription } from "@/lib/push/client";

/** Sair: antes, este celular deixa de receber os avisos da conta (outra pessoa pode usar o aparelho). */
export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  function logout() {
    startTransition(async () => {
      try {
        const subscription = await currentSubscription();
        if (subscription) {
          await removePushSubscription(subscription.endpoint);
          await subscription.unsubscribe();
        }
        localStorage.removeItem("caronas.push-sync");
      } catch {}
      await signOut();
    });
  }

  return (
    <button type="button" onClick={logout} disabled={pending} aria-busy={pending} className={buttonClasses("ghost", "md")}>
      {pending ? "Saindo..." : "Sair"}
    </button>
  );
}
```

- [ ] **Step 5: Colocar nas telas**

`src/app/(app)/layout.tsx`:

```tsx
import { BottomNavigation } from "@/components/BottomNavigation";
import { PushSync } from "@/components/PushSync";
import { createClient } from "@/lib/supabase/server";

// Área logada. A proteção é feita no proxy e novamente em cada página (requireUser/requireProfile).
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  return (
    <>
      <main className="pb-safe-nav px-5 pt-4">{children}</main>
      <BottomNavigation />
      {userId ? <PushSync userId={userId} /> : null}
    </>
  );
}
```

`src/app/(app)/inicio/page.tsx`: importar `import { NotificationPrompt } from "@/components/NotificationPrompt";` e, logo depois do `<h1>`, acrescentar:

```tsx
      <div className="mb-5">
        <NotificationPrompt context="inicio" />
      </div>
```

`src/app/(app)/perfil/page.tsx`: importar `LogoutButton` e `NotificationPrompt`; remover o import de `signOut`;
acrescentar antes do bloco "Sair" a seção

```tsx
      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-extrabold">Notificações</h2>
        <NotificationPrompt context="perfil" />
      </section>
```

e trocar o `<form action={signOut} ...>...</form>` por

```tsx
      <div className="mt-10">
        <LogoutButton />
      </div>
```

(remover `buttonClasses` do import se ficar sem uso).

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit && npx eslint src && npx vitest run`
Expected: sem erros; todos os testes passam.

- [ ] **Step 7: Commit**

```bash
git add src/lib/device.ts src/lib/push/client.ts src/app/actions/push.ts src/components "src/app/(app)/layout.tsx" "src/app/(app)/inicio/page.tsx" "src/app/(app)/perfil/page.tsx"
git commit -m "feat: enable notifications per device, keep device linked to the logged account, logout unlinks"
```

---

### Task 5: Link compartilhável

**Files:**
- Create: `src/app/carona/[rideId]/page.tsx`, `src/components/ShareRideButtons.tsx`, `scripts/make-brand-images.mjs`,
  `public/brand/og.png`, `public/brand/badge-96.png`
- Modify: `src/lib/env.ts`, `src/app/layout.tsx`, `src/lib/types.ts`, `src/lib/auth.ts`,
  `src/app/(app)/pegar/carona/[rideId]/page.tsx`, `src/app/(app)/pegar/carona/[rideId]/ReserveButton.tsx`,
  `src/app/(app)/perfil/page.tsx`, `src/app/cadastro/page.tsx`, `src/app/cadastro/SignUpForm.tsx`, `src/app/actions/auth.ts`,
  `src/app/auth/confirm/route.ts`, `src/app/entrar/page.tsx`, `src/app/(app)/oferecer/OfferWizard.tsx`

**Interfaces:**
- Consumes: `get_ride_preview` (Task 2); `rideSharePath`, `rideShareMessage`, `whatsappShareUrl`, `ShareableRide` (Task 1); `NotificationPrompt` (Task 4)
- Produces: `SITE_URL: string`; `type RidePreview`; `requireProfile(nextPath?: string)`; `<ShareRideButtons rideId ride />`

- [ ] **Step 1: URL do site e metadataBase**

`src/lib/env.ts` — acrescentar:

```ts
/** Endereço público do app (links compartilhados e cartão do WhatsApp). */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://app-caronas-seven.vercel.app")
).replace(/\/$/, "");
```

`src/app/layout.tsx` — importar `SITE_URL` de `@/lib/env` e acrescentar `metadataBase: new URL(SITE_URL),` no objeto `metadata`.

- [ ] **Step 2: Imagens (cartão do link e ícone da notificação)**

`scripts/make-brand-images.mjs`:

```js
// Gera public/brand/og.png (cartão do link no WhatsApp) e public/brand/badge-96.png
// (ícone monocromático da barra de notificações do Android). Uso: node scripts/make-brand-images.mjs
import { readFileSync } from "node:fs";
import sharp from "sharp";

const logo = "src/assets/logo.webp";
const [r, g, b] = await sharp(logo).extract({ left: 4, top: 4, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
const logoPng = await sharp(logo).resize(560, 560).png().toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 3, background: { r, g, b } } })
  .composite([{ input: logoPng, left: 320, top: 35 }])
  .png({ compressionLevel: 9 })
  .toFile("public/brand/og.png");

// Mesmo desenho do IconCar (src/components/icons.tsx), em branco sobre fundo transparente.
const icons = readFileSync("src/components/icons.tsx", "utf8");
const body = icons.match(/CAR_BODY =\s*"([^"]+)"/)[1];
const wheels = [...icons.matchAll(/\{ cx: ([\d.]+), cy: ([\d.]+) \}/g)].map((m) => ({ cx: Number(m[1]), cy: Number(m[2]) }));
const holes = wheels.map(({ cx, cy }) => `<circle cx="${cx}" cy="${cy}" r="3.2" fill="black"/>`).join("");
const tires = wheels
  .map(({ cx, cy }) => `<path fill-rule="evenodd" d="M${cx} ${cy - 2.3}a2.3 2.3 0 1 0 0 4.6a2.3 2.3 0 1 0 0-4.6Zm0 1.5a.8.8 0 1 1 0 1.6a.8.8 0 1 1 0-1.6Z"/>`)
  .join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="white"><defs><mask id="m"><rect width="24" height="24" fill="white"/>${holes}</mask></defs><path fill-rule="evenodd" d="${body}" mask="url(#m)"/>${tires}</svg>`;
await sharp(Buffer.from(svg)).resize(96, 96).png().toFile("public/brand/badge-96.png");
console.log("public/brand/og.png e public/brand/badge-96.png gerados");
```

Run: `node scripts/make-brand-images.mjs`
Expected: `public/brand/og.png e public/brand/badge-96.png gerados` (se `sharp` não estiver em `node_modules`, rodar o mesmo script a partir de uma pasta temporária com `npm i sharp`).

- [ ] **Step 3: Tipo da prévia e requireProfile com retorno**

`src/lib/types.ts` — acrescentar:

```ts
/** Prévia pública do link da carona (sem nome do motorista, placa ou telefone). */
export type RidePreview = {
  ride_id: string;
  direction: RideDirection;
  departure_at: string;
  price: number;
  available_seats: number;
  total_seats: number;
  status: RideStatus;
  neighborhood_name: string;
  points: string[];
};
```

`src/lib/auth.ts` — trocar a função `requireProfile` por:

```ts
/** Usuário pronto para usar o app (perfil completo); senão manda para /perfil (e volta para `nextPath`). */
export async function requireProfile(nextPath?: string) {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, user_id, name, phone, email, neighborhood_id")
    .eq("user_id", user.id)
    .maybeSingle<Profile>();
  if (!profile) redirect(nextPath ? `/perfil?primeiro=1&next=${encodeURIComponent(nextPath)}` : "/perfil?primeiro=1");
  return { supabase, user, profile };
}
```

`src/app/(app)/perfil/page.tsx` — trocar `next={firstAccess || !profile ? "/inicio" : next}` por `next={next}`
(o `next` já é `safeNext(sp.next)` com padrão `/inicio`; assim o primeiro acesso volta para a carona do link).

- [ ] **Step 4: Levar o `next` pelo cadastro e pela confirmação**

`src/app/cadastro/page.tsx`: tornar a página `async`, ler `const sp = await props.searchParams; const next = safeNext(sp.next, "");`
(tipo `PageProps<"/cadastro">`, import de `safeNext`), passar `<SignUpForm next={next} />` e trocar o link "Entrar" para
`href={next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar"}`.

`src/app/cadastro/SignUpForm.tsx`: assinatura `export function SignUpForm({ next }: { next: string })` e, dentro do `<form>`,
`<input type="hidden" name="next" value={next} />`.

`src/app/actions/auth.ts` — em `signUp`, trocar a linha do `options` por:

```ts
  // Depois de confirmar o e-mail: primeiro acesso e, se veio de um link de carona, volta para ela.
  const next = safeNext(formData.get("next"), "");
  const afterConfirm = next ? `/perfil?next=${encodeURIComponent(next)}` : "/perfil";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent(afterConfirm)}` },
  });
```

(removendo a declaração anterior de `supabase` para não duplicar).

`src/app/auth/confirm/route.ts` — trocar `return to("/entrar?confirmado=1");` por
`return to(`/entrar?confirmado=1&next=${encodeURIComponent(next)}`);`.

`src/app/entrar/page.tsx` — trocar o link "Criar conta" para
`href={next !== "/inicio" ? `/cadastro?next=${encodeURIComponent(next)}` : "/cadastro"}`.

- [ ] **Step 5: Página pública do link**

`src/app/carona/[rideId]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { AppButton } from "@/components/AppButton";
import { IconPin } from "@/components/icons";
import { EmptyState } from "@/components/States";
import { directionLabel, routeText } from "@/lib/direction";
import { formatDateTime, formatPrice, isPast } from "@/lib/format";
import { UUID_RE } from "@/lib/queries";
import { rideSharePath } from "@/lib/share";
import { createClient } from "@/lib/supabase/server";
import type { RidePreview } from "@/lib/types";

// Mesmo resultado para os metadados (cartão do WhatsApp) e para a página.
const getPreview = cache(async (rideId: string) => {
  if (!UUID_RE.test(rideId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_ride_preview", { p_ride_id: rideId }).maybeSingle<RidePreview>();
  return data ?? null;
});

function isAvailable(p: RidePreview) {
  return p.status === "OPEN" && p.available_seats > 0 && !isPast(p.departure_at);
}

function seatsText(n: number) {
  return n === 1 ? "1 vaga" : `${n} vagas`;
}

export async function generateMetadata(props: PageProps<"/carona/[rideId]">): Promise<Metadata> {
  const { rideId } = await props.params;
  const p = await getPreview(rideId);
  if (!p) return { title: "Carona" };
  const title = `${directionLabel(p.direction)} · ${formatDateTime(p.departure_at)}`;
  const description = isAvailable(p)
    ? `${p.neighborhood_name} · ${formatPrice(p.price)} · ${seatsText(p.available_seats)}. Toque para reservar no Caronas UNIFAL.`
    : "Essa carona não está mais disponível. Veja outras no Caronas UNIFAL.";
  return {
    title,
    description,
    robots: { index: false },
    openGraph: {
      title,
      description,
      url: rideSharePath(p.ride_id),
      siteName: "Caronas UNIFAL",
      locale: "pt_BR",
      type: "website",
      images: [{ url: "/brand/og.png", width: 1200, height: 630, alt: "Caronas UNIFAL" }],
    },
  };
}

export default async function CaronaCompartilhadaPage(props: PageProps<"/carona/[rideId]">) {
  const { rideId } = await props.params;
  const p = await getPreview(rideId);
  if (!p) notFound();

  // Logado: vai direto para a carona (escolher o ponto e reservar).
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect(`/pegar/carona/${p.ride_id}?voltar=/pegar`);

  const next = encodeURIComponent(rideSharePath(p.ride_id));
  return (
    <main className="px-5 pb-10 pt-6">
      <p className="text-sm font-bold uppercase tracking-wide text-pegar">Carona compartilhada</p>
      <h1 className="mt-1 text-2xl font-extrabold">{directionLabel(p.direction)}</h1>
      <p className="mt-1 text-xl font-bold">{formatDateTime(p.departure_at)}</p>
      <div className="mt-5 space-y-2 rounded-2xl border-2 border-border bg-surface p-4">
        <p className="flex items-start gap-2">
          <IconPin className="mt-0.5 h-5 w-5 shrink-0 text-pegar" />
          {routeText(p.direction, p.points)}
        </p>
        <p className="text-muted">
          {p.neighborhood_name} · {formatPrice(p.price)} · {seatsText(p.available_seats)}
        </p>
      </div>

      {isAvailable(p) ? (
        <>
          <div className="mt-8 space-y-3">
            <AppButton href={`/entrar?next=${next}`} variant="pegar">
              ENTRAR PARA RESERVAR
            </AppButton>
            <AppButton href={`/cadastro?next=${next}`} variant="ghost">
              CRIAR CONTA
            </AppButton>
          </div>
          <p className="mt-6 rounded-2xl bg-pegar-soft px-4 py-3 text-base text-pegar-dark">
            Depois de reservar, ative as notificações no app para saber quando o motorista sair.
          </p>
        </>
      ) : (
        <div className="mt-8">
          <EmptyState
            title="Essa carona não está mais disponível."
            action={
              <AppButton href="/entrar?next=/pegar" variant="pegar">
                VER OUTRAS CARONAS
              </AppButton>
            }
          />
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 6: Escolher o ponto quando vier pelo link**

`src/app/(app)/pegar/carona/[rideId]/page.tsx` — substituir o arquivo por:

```tsx
import { notFound, redirect } from "next/navigation";
import { AppButton } from "@/components/AppButton";
import { PickupPointCard } from "@/components/PickupPointCard";
import { RideCard } from "@/components/RideCard";
import { EmptyState } from "@/components/States";
import { StepHeader } from "@/components/StepHeader";
import { requireProfile } from "@/lib/auth";
import { directionLabel, pointVerb } from "@/lib/direction";
import { formatDateTime, isPast } from "@/lib/format";
import { UUID_RE } from "@/lib/queries";
import { safeNext } from "@/lib/safe-next";
import type { RideSummary } from "@/lib/types";
import { ReserveButton } from "./ReserveButton";

export const dynamic = "force-dynamic";

export default async function CaronaResumoPage(props: PageProps<"/pegar/carona/[rideId]">) {
  const { rideId } = await props.params;
  const sp = await props.searchParams;
  const pontoId = typeof sp.ponto === "string" ? sp.ponto : "";
  if (!UUID_RE.test(rideId) || (pontoId && !UUID_RE.test(pontoId))) notFound();

  // Volta para a lista de onde veio (validado: só caminhos internos do fluxo /pegar).
  const voltar = safeNext(sp.voltar, "/pegar");
  const backHref = voltar.startsWith("/pegar") ? voltar : "/pegar";

  const { supabase } = await requireProfile(`/pegar/carona/${rideId}`);
  const { data } = await supabase.rpc("get_ride_summary", { p_ride_id: rideId }).maybeSingle<RideSummary>();
  if (!data) notFound();
  const point = pontoId ? data.points.find((p) => p.id === pontoId) : undefined;
  if (pontoId && !point) notFound();

  const unavailable = data.status !== "OPEN" || data.available_seats <= 0 || isPast(data.departure_at);
  const pointHref = (id: string) => `/pegar/carona/${data.ride_id}?ponto=${id}&voltar=${encodeURIComponent(backHref)}`;

  // Veio pelo link compartilhado: primeiro escolhe o ponto (se só há um, já segue com ele).
  if (!point && !data.is_driver && !data.already_reserved && !unavailable) {
    if (data.points.length === 1) redirect(pointHref(data.points[0].id));
    return (
      <>
        <StepHeader
          title={pointVerb(data.direction).question}
          subtitle={`${directionLabel(data.direction)} · ${formatDateTime(data.departure_at)}`}
          accent="pegar"
          backHref={backHref}
        />
        <div className="space-y-3">
          {data.points.map((p) => (
            <PickupPointCard key={p.id} name={p.name} href={pointHref(p.id)} accent="pegar" />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <StepHeader
        title="Confirme sua carona"
        subtitle={
          point
            ? `${directionLabel(data.direction)} · você vai ${pointVerb(data.direction).action} ${point.name}`
            : directionLabel(data.direction)
        }
        accent="pegar"
        backHref={backHref}
      />
      <RideCard ride={data} highlightPointId={point?.id} />
      <p className="mt-4 rounded-2xl bg-pegar-soft px-4 py-3 text-base text-pegar-dark">
        O pagamento é combinado direto com o motorista.
      </p>
      <div className="mt-8">
        {data.is_driver ? (
          <EmptyState title="Essa carona é sua." />
        ) : data.already_reserved ? (
          <EmptyState
            title="Você já reservou essa carona."
            action={
              <AppButton href="/reservas" variant="pegar">
                VER MINHAS RESERVAS
              </AppButton>
            }
          />
        ) : unavailable || !point ? (
          <EmptyState
            title="Essa carona não está mais disponível."
            action={
              <AppButton href={backHref} variant="ghost">
                VER OUTRAS CARONAS
              </AppButton>
            }
          />
        ) : (
          <ReserveButton rideId={data.ride_id} pointId={point.id} direction={data.direction} />
        )}
      </div>
    </>
  );
}
```

`ReserveButton.tsx` — importar `NotificationPrompt` e, na tela de sucesso, logo depois do `<div className="mt-6 space-y-3">...</div>`, acrescentar:

```tsx
        <div className="mt-6 text-left">
          <NotificationPrompt context="reservado" />
        </div>
```

- [ ] **Step 7: Botões de compartilhar**

`src/components/ShareRideButtons.tsx`:

```tsx
"use client";

import { useState } from "react";
import { AppButton } from "@/components/AppButton";
import { IconWhatsapp } from "@/components/icons";
import { SITE_URL } from "@/lib/env";
import { rideSharePath } from "@/lib/share";
import { type ShareableRide, rideShareMessage, whatsappShareUrl } from "@/lib/whatsapp";

/** COMPARTILHAR NO WHATSAPP (escolhe contato ou grupo) + Copiar link. */
export function ShareRideButtons({ rideId, ride }: { rideId: string; ride: ShareableRide }) {
  const [copied, setCopied] = useState(false);
  const link = `${SITE_URL}${rideSharePath(rideId)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copie o link da carona:", link);
    }
  }

  return (
    <div className="grid gap-3">
      <AppButton href={whatsappShareUrl(rideShareMessage(ride, link))} external variant="whatsapp" icon={<IconWhatsapp />}>
        COMPARTILHAR NO WHATSAPP
      </AppButton>
      <AppButton variant="ghost" size="md" onClick={copy}>
        {copied ? "Link copiado ✓" : "Copiar link"}
      </AppButton>
    </div>
  );
}
```

`src/app/(app)/oferecer/OfferWizard.tsx`:
- importar `NotificationPrompt` e `ShareRideButtons`;
- trocar `const [done, setDone] = useState(false);` por `const [publishedId, setPublishedId] = useState<string | null>(null);`;
- em `submit`, trocar `setDone(true);` por `setPublishedId(res.data.rideId);`;
- trocar `if (done && direction) {` por `if (publishedId && direction) {`;
- na tela de sucesso, antes de `<div className="mt-8 space-y-3">` (botões existentes), acrescentar:

```tsx
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
```

(O botão em "Minhas caronas" entra na Task 6, junto com as outras mudanças do `RideItem`.)

- [ ] **Step 8: Verificar**

Run: `npx tsc --noEmit && npx eslint src && npx vitest run && npm run build`
Expected: sem erros; build lista a rota `ƒ /carona/[rideId]`.

- [ ] **Step 9: Commit**

```bash
git add scripts/make-brand-images.mjs public/brand src
git commit -m "feat: public ride link with WhatsApp preview, point choice and next through signup"
```

---

### Task 6: INICIEI A ROTA e ESTOU NO LOCAL

**Files:**
- Create: `src/app/actions/trips.ts`, `src/components/AutoRefresh.tsx`, `src/app/(app)/minhas-caronas/StartRoutePanel.tsx`,
  `src/app/(app)/minhas-caronas/[rideId]/page.tsx`, `src/app/(app)/reservas/ArrivalPanel.tsx`
- Modify: `src/lib/types.ts`, `src/lib/errors.ts`, `src/app/(app)/minhas-caronas/RideItem.tsx`, `src/app/(app)/minhas-caronas/page.tsx`,
  `src/app/(app)/reservas/ReservationItem.tsx`, `src/app/(app)/reservas/page.tsx`

**Interfaces:**
- Consumes: `start_ride`, `mark_arrived`, `get_my_rides(p_ride_id)` (Task 2); `sendPush` (Task 3); `routeStartedPush`, `arrivedPush`,
  `routeStartedMessage`, `arrivedMessage`, `tripPhase`, `tripOpensAt` (Task 1); `ShareRideButtons` (Task 5)
- Produces:
  - `startRoute(rideId): Promise<ActionResult<{ startedAt: string; newlyStarted: boolean; passengers: StartedPassenger[] }>>`
  - `type StartedPassenger = { reservationId: string; name: string; point: string; notified: boolean | null; whatsapp: string | null }`
  - `markArrived(reservationId): Promise<ActionResult<{ arrivedAt: string; driverNotified: boolean | null; whatsapp: string | null }>>`
  - `<AutoRefresh active everyMs? />`, `<StartRoutePanel rideId departureAt startedAt hasPassengers />`,
    `<ArrivalPanel reservationId departureAt startedAt arrivedAt />`

- [ ] **Step 1: Tipos e erros**

`src/lib/types.ts`: em `RidePassenger` acrescentar `arrived_at: string | null;`; em `MyRide` acrescentar `started_at: string | null;`;
em `MyReservation` acrescentar `started_at: string | null;` e `arrived_at: string | null;`.

`src/lib/errors.ts` — acrescentar em `MESSAGES`:

```ts
  ROUTE_WINDOW: "Você pode iniciar a rota de 30 minutos antes até 1 hora depois do horário da carona.",
  ARRIVAL_WINDOW: "O aviso de chegada fica disponível de 30 minutos antes até 1 hora depois do horário da carona.",
```

- [ ] **Step 2: Ações**

`src/app/actions/trips.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import type { RideDirection } from "@/lib/direction";
import { friendlyError } from "@/lib/errors";
import { arrivedPush, routeStartedPush } from "@/lib/push/messages";
import { sendPush } from "@/lib/push/send";
import type { ActionResult } from "@/lib/types";
import { arrivedMessage, routeStartedMessage, whatsappUrl } from "@/lib/whatsapp";

type StartRow = {
  newly_started: boolean;
  started_at: string;
  departure_at: string;
  direction: RideDirection;
  driver_first_name: string | null;
  passengers: { reservation_id: string; passenger_id: string; name: string | null; phone: string | null; pickup_point: string }[];
};

export type StartedPassenger = {
  reservationId: string;
  name: string;
  point: string;
  /** true: recebeu no celular · false: sem notificações · null: a rota já tinha sido iniciada. */
  notified: boolean | null;
  whatsapp: string | null;
};

/** INICIEI A ROTA: o banco confere dono e horário; cada passageiro recebe o aviso com o próprio ponto. */
export async function startRoute(
  rideId: string,
): Promise<ActionResult<{ startedAt: string; newlyStarted: boolean; passengers: StartedPassenger[] }>> {
  if (!z.uuid().safeParse(rideId).success) return { ok: false, error: "Carona inválida." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("start_ride", { p_ride_id: rideId }).single<StartRow>();
  if (error || !data) return { ok: false, error: friendlyError(error) };

  const delivered = new Set<string>();
  if (data.newly_started) {
    const results = await Promise.all(
      data.passengers.map((p) =>
        sendPush(
          [p.passenger_id],
          routeStartedPush({
            rideId,
            driverName: data.driver_first_name ?? "",
            direction: data.direction,
            departureAt: data.departure_at,
            pointName: p.pickup_point,
          }),
          1800,
        ),
      ),
    );
    results.forEach((set) => set.forEach((id) => delivered.add(id)));
  }

  revalidatePath("/minhas-caronas", "layout");
  return {
    ok: true,
    data: {
      startedAt: data.started_at,
      newlyStarted: data.newly_started,
      passengers: data.passengers.map((p) => ({
        reservationId: p.reservation_id,
        name: p.name || "Passageiro",
        point: p.pickup_point,
        notified: data.newly_started ? delivered.has(p.passenger_id) : null,
        whatsapp: p.phone ? whatsappUrl(p.phone, routeStartedMessage(data.direction, p.pickup_point, data.departure_at)) : null,
      })),
    },
  };
}

type ArrivedRow = {
  newly_arrived: boolean;
  arrived_at: string;
  ride_id: string;
  direction: RideDirection;
  departure_at: string;
  pickup_point_name: string;
  passenger_first_name: string | null;
  driver_id: string;
  driver_first_name: string | null;
  driver_phone: string | null;
};

/** ESTOU NO LOCAL: o banco confere a reserva e o horário; o motorista recebe o aviso. */
export async function markArrived(
  reservationId: string,
): Promise<ActionResult<{ arrivedAt: string; driverNotified: boolean | null; whatsapp: string | null }>> {
  if (!z.uuid().safeParse(reservationId).success) return { ok: false, error: "Reserva inválida." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("mark_arrived", { p_reservation_id: reservationId }).single<ArrivedRow>();
  if (error || !data) return { ok: false, error: friendlyError(error) };

  let driverNotified: boolean | null = null;
  if (data.newly_arrived) {
    const delivered = await sendPush(
      [data.driver_id],
      arrivedPush({
        rideId: data.ride_id,
        reservationId,
        passengerName: data.passenger_first_name ?? "",
        direction: data.direction,
        pointName: data.pickup_point_name,
      }),
      900,
    );
    driverNotified = delivered.has(data.driver_id);
  }

  revalidatePath("/reservas");
  return {
    ok: true,
    data: {
      arrivedAt: data.arrived_at,
      driverNotified,
      whatsapp: data.driver_phone ? whatsappUrl(data.driver_phone, arrivedMessage(data.direction, data.pickup_point_name)) : null,
    },
  };
}
```

- [ ] **Step 3: Atualização automática**

`src/components/AutoRefresh.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Atualiza a tela a cada 30 s (e ao voltar para o app) enquanto há carona acontecendo. */
export function AutoRefresh({ active, everyMs = 30_000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, everyMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [active, everyMs, router]);

  return null;
}
```

- [ ] **Step 4: Motorista — INICIEI A ROTA**

`src/app/(app)/minhas-caronas/StartRoutePanel.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type StartedPassenger, startRoute } from "@/app/actions/trips";
import { AppButton } from "@/components/AppButton";
import { IconWhatsapp } from "@/components/icons";
import { ErrorMessage, SuccessMessage } from "@/components/States";
import { formatDateTime, formatTime } from "@/lib/format";
import { tripOpensAt, tripPhase } from "@/lib/trip";

type Props = { rideId: string; departureAt: string; startedAt: string | null; hasPassengers: boolean };
type Result = { startedAt: string; newlyStarted: boolean; passengers: StartedPassenger[] };

/** Botão INICIEI A ROTA (30 min antes até 1 h depois) e o resultado do aviso aos passageiros. */
export function StartRoutePanel({ rideId, departureAt, startedAt, hasPassengers }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const phase = tripPhase(departureAt);

  function start() {
    setError(null);
    startTransition(async () => {
      const res = await startRoute(rideId);
      if (!res.ok) return setError(res.error);
      setResult(res.data);
      router.refresh();
    });
  }

  if (result) {
    const missing = result.passengers.filter((p) => p.notified === false);
    return (
      <div className="mt-4 space-y-3">
        <SuccessMessage>
          {result.newlyStarted ? `Rota iniciada às ${formatTime(result.startedAt)}.` : `A rota já tinha sido iniciada às ${formatTime(result.startedAt)}.`}
        </SuccessMessage>
        {result.newlyStarted && result.passengers.length === 0 ? <p className="text-muted">Ninguém reservou esta carona.</p> : null}
        {result.newlyStarted
          ? result.passengers
              .filter((p) => p.notified)
              .map((p) => (
                <p key={p.reservationId} className="font-semibold text-success">
                  ✓ {p.name} avisado no celular
                </p>
              ))
          : null}
        {missing.map((p) => (
          <div key={p.reservationId} className="rounded-xl bg-background p-3">
            <p>
              <b>{p.name}</b> não tem notificações ligadas.
            </p>
            {p.whatsapp ? (
              <div className="mt-2">
                <AppButton href={p.whatsapp} external variant="whatsapp" size="md" icon={<IconWhatsapp />}>
                  AVISAR {p.name.toUpperCase()} NO WHATSAPP
                </AppButton>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (startedAt) {
    return <p className="mt-4 rounded-xl bg-oferecer-soft px-3 py-2 font-bold text-oferecer-dark">🚗 Rota iniciada às {formatTime(startedAt)}</p>;
  }

  if (phase === "open") {
    return (
      <div className="mt-4 space-y-2">
        <AppButton variant="oferecer" size="xl" onClick={start} disabled={pending} aria-busy={pending}>
          {pending ? "AVISANDO..." : "INICIEI A ROTA"}
        </AppButton>
        <p className="text-center text-sm text-muted">
          {hasPassengers ? "Os passageiros recebem o aviso no celular." : "Ninguém reservou ainda, mas você pode iniciar mesmo assim."}
        </p>
        <ErrorMessage>{error}</ErrorMessage>
      </div>
    );
  }

  if (phase === "soon") {
    return <p className="mt-4 text-sm text-muted">O botão INICIEI A ROTA libera {formatDateTime(tripOpensAt(departureAt))}.</p>;
  }
  return null;
}
```

`src/app/(app)/minhas-caronas/RideItem.tsx`:
- importar `formatTime` (junto de `formatDateTime`, `formatPrice`, `isPast`), `ShareRideButtons` e `StartRoutePanel`;
- logo depois do parágrafo da rota (`routeText(...)`), acrescentar:

```tsx
      {active ? (
        <StartRoutePanel
          rideId={ride.ride_id}
          departureAt={ride.departure_at}
          startedAt={ride.started_at}
          hasPassengers={activePassengers.length > 0}
        />
      ) : null}
```

- no item de passageiro, trocar `<span className="block text-sm text-muted">{p.pickup_point}</span>` por:

```tsx
                  <span className="block text-sm text-muted">{p.pickup_point}</span>
                  {p.arrived_at ? (
                    <span className="block text-sm font-bold text-success">no local ✓ {formatTime(p.arrived_at)}</span>
                  ) : null}
```

- antes do bloco do botão CANCELAR CARONA, acrescentar:

```tsx
      {ride.status === "OPEN" && ride.available_seats > 0 && !departed && !affected ? (
        <div className="mt-4">
          <ShareRideButtons
            rideId={ride.ride_id}
            ride={{
              direction: ride.direction,
              departureAt: ride.departure_at,
              price: ride.price,
              availableSeats: ride.available_seats,
              points: ride.points.map((p) => p.name),
            }}
          />
        </div>
      ) : null}
```

`src/app/(app)/minhas-caronas/page.tsx` — importar `AutoRefresh` e `tripPhase`; depois do `const rides = ...`:

```tsx
  const live = rides.some((r) => (r.status === "OPEN" || r.status === "FULL") && tripPhase(r.departure_at) === "open");
```

e, no fim do JSX (antes do `</>` final), `<AutoRefresh active={live} />`.

`src/app/(app)/minhas-caronas/[rideId]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ErrorMessage } from "@/components/States";
import { StepHeader } from "@/components/StepHeader";
import { requireProfile } from "@/lib/auth";
import { UUID_RE } from "@/lib/queries";
import { tripPhase } from "@/lib/trip";
import type { MyRide } from "@/lib/types";
import { RideItem } from "../RideItem";

export const metadata: Metadata = { title: "Sua carona" };
export const dynamic = "force-dynamic";

/** Uma carona do motorista (destino do lembrete de 10 min), com INICIEI A ROTA. */
export default async function MinhaCaronaPage(props: PageProps<"/minhas-caronas/[rideId]">) {
  const { rideId } = await props.params;
  if (!UUID_RE.test(rideId)) notFound();
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.rpc("get_my_rides", { p_ride_id: rideId });
  const ride = ((data ?? []) as MyRide[])[0];
  if (!error && !ride) notFound();

  return (
    <>
      <StepHeader title="Sua carona" backHref="/minhas-caronas" accent="oferecer" />
      {error ? <ErrorMessage>Não foi possível carregar sua carona.</ErrorMessage> : null}
      {ride ? <RideItem ride={ride} /> : null}
      <AutoRefresh active={ride !== undefined && (ride.status === "OPEN" || ride.status === "FULL") && tripPhase(ride.departure_at) === "open"} />
    </>
  );
}
```

- [ ] **Step 5: Passageiro — ESTOU NO LOCAL**

`src/app/(app)/reservas/ArrivalPanel.tsx`:

```tsx
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
            {result?.driverNotified ? `Motorista avisado no celular ✓ (${formatTime(arrived)})` : `Você avisou que chegou às ${formatTime(arrived)}.`}
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
```

`src/app/(app)/reservas/ReservationItem.tsx` — importar `ArrivalPanel` e, logo depois do bloco `<div className="mt-3 space-y-1">...</div>` (ponto e carro), acrescentar:

```tsx
      {active && (r.ride_status === "OPEN" || r.ride_status === "FULL") && cancelWhatsapp === undefined ? (
        <ArrivalPanel reservationId={r.reservation_id} departureAt={r.departure_at} startedAt={r.started_at} arrivedAt={r.arrived_at} />
      ) : null}
```

`src/app/(app)/reservas/page.tsx` — importar `AutoRefresh` e `tripPhase`; depois do `const reservations = ...`:

```tsx
  const live = reservations.some(
    (r) =>
      r.reservation_status === "ACTIVE" &&
      (r.ride_status === "OPEN" || r.ride_status === "FULL") &&
      tripPhase(r.departure_at) === "open",
  );
```

e, no fim do JSX, `<AutoRefresh active={live} />`.

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit && npx eslint src && npx vitest run && npm run build`
Expected: sem erros; build lista `ƒ /minhas-caronas/[rideId]`.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: INICIEI A ROTA and ESTOU NO LOCAL with push, WhatsApp fallback and auto refresh"
```

---

### Task 7: Verificação, publicação, produção, auditoria e documentação

**Files:**
- Modify: `docs/SETUP.md`, `docs/DATABASE.md`, `docs/ARCHITECTURE.md`, `docs/TEST_REPORT.md`, `docs/REQUIREMENTS_CHECKLIST.md`,
  `CHANGELOG.md`, `README.md`, `obsidian/03 - Requisitos.md`, `obsidian/06 - Fluxos.md`

- [ ] **Step 1: Suíte completa local**

Run: `npm run lint && npm run typecheck && npm run test && npm run test:concurrency && npm run build`
Expected: tudo PASS; `N/N verificações passaram.`

- [ ] **Step 2: Publicar**

```bash
GH_TOKEN="$(gh auth token --user caronasunifal)" git push origin main
```

Aguardar o deploy: `GH_TOKEN="$(gh auth token --user caronasunifal)" gh api repos/caronasunifal/app-caronas/commits/$(git rev-parse HEAD)/statuses --jq '.[0].state'`
Expected: `success`.

- [ ] **Step 3: Checagens em produção (script temporário, apagado depois de rodar)**

Criar `./.prod-trips-check.tmp.mjs` na raiz (usa os pacotes do projeto), rodar com
`node --env-file=.env.local ./.prod-trips-check.tmp.mjs` e apagar o arquivo:

```js
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SITE = "https://app-caronas-seven.vercel.app";
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const run = Date.now().toString(36);
const password = `T3ste-${run}-senha!`;
const ids = [];
const ok = (name, cond, extra = "") => console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);

async function user(label, phone) {
  const email = `teste+prod${label}-${run}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  ids.push(data.user.id);
  const jar = new Map();
  const sb = createServerClient(URL, ANON, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) },
  });
  const { error: e } = await sb.auth.signInWithPassword({ email, password });
  if (e) throw e;
  const { data: hood } = await admin.from("neighborhoods").select("id").eq("name", "Country Clube").single();
  await sb.from("profiles").insert({ user_id: data.user.id, name: `Prod ${label}`, phone, neighborhood_id: hood.id });
  return { id: data.user.id, sb, hood: hood.id, cookie: [...jar].map(([n, v]) => `${n}=${v}`).join("; ") };
}
const get = (path, cookie) => fetch(SITE + path, { headers: cookie ? { cookie } : {}, redirect: "manual" });

try {
  ok("lembretes sem segredo → 401", (await fetch(`${SITE}/api/lembretes`, { method: "POST" })).status === 401);
  const key = await (await fetch(`${SITE}/api/push/chave`)).json();
  ok("chave pública VAPID", typeof key.publicKey === "string" && key.publicKey.length === 87);

  const driver = await user("motorista", "5535900000081");
  const rider = await user("aluno", "5535900000082");
  const { data: points } = await admin.from("pickup_points").select("id").eq("neighborhood_id", driver.hood).order("display_order");
  const { data: vehicle } = await driver.sb.from("vehicles").insert({ user_id: driver.id, model: "Onix", color: "Prata", plate: "PRD1A23" }).select("id").single();
  const mk = async (min) =>
    (await driver.sb.rpc("create_ride", {
      p_vehicle_id: vehicle.id, p_neighborhood_id: driver.hood, p_departure_at: new Date(Date.now() + min * 60e3).toISOString(),
      p_total_seats: 3, p_price: 5, p_pickup_point_ids: [points[0].id, points[1].id], p_direction: "TO_CAMPUS",
    })).data;

  const shared = await mk(20);
  const anonPage = await get(`/carona/${shared}`);
  const html = await anonPage.text();
  ok("link sem login → prévia com cartão do WhatsApp", anonPage.status === 200 && html.includes("og:title") && html.includes("ENTRAR PARA RESERVAR"));
  const logged = await get(`/carona/${shared}`, rider.cookie);
  ok("link logado → carona", [307, 308].includes(logged.status) && (logged.headers.get("location") ?? "").includes(`/pegar/carona/${shared}`));
  await rider.sb.rpc("reserve_seat", { p_ride_id: shared, p_pickup_point_id: points[1].id });
  ok("motorista vê INICIEI A ROTA", (await (await get(`/minhas-caronas/${shared}`, driver.cookie)).text()).includes("INICIEI A ROTA"));
  ok("passageiro vê ESTOU NO LOCAL", (await (await get("/reservas", rider.cookie)).text()).includes("ESTOU NO LOCAL"));

  // Agendamento real: pg_cron → pg_net → /api/lembretes → claim.
  const due = await mk(6);
  await admin.from("rides").update({ created_at: new Date(Date.now() - 3600e3).toISOString() }).eq("id", due);
  let sentAt = null;
  for (let i = 0; i < 18 && !sentAt; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    sentAt = (await admin.from("rides").select("reminder_sent_at").eq("id", due).single()).data.reminder_sent_at;
  }
  ok("agendamento marcou o lembrete", Boolean(sentAt), sentAt ?? "não marcou em 90 s");
} finally {
  for (const id of ids) {
    await admin.from("reservations").delete().eq("passenger_id", id);
    await admin.from("rides").delete().eq("driver_id", id);
  }
  for (const id of ids) await admin.auth.admin.deleteUser(id);
  console.log(`${ids.length} contas de teste removidas`);
}
```

Expected: todas as linhas `PASS`.

- [ ] **Step 4: Auditoria independente**

Rodar o agente `auditor` sobre o diff desde o commit do spec (segurança de RLS/RPCs, `/api/lembretes`, `push_subscriptions`,
prévia pública, redirects com `next`, service worker). Corrigir achados e repetir os passos 1–3.

- [ ] **Step 5: Documentação**

- `docs/SETUP.md`: seção "9. Notificações e lembrete" (como funciona; `npm run setup:push`; nomes no Vault; conferir `select jobname, schedule, active from cron.job;`; pausar `select cron.unschedule('lembrete-saida-carona');`; iPhone só instalado; teste manual no Android e iPhone).
- `docs/DATABASE.md`: colunas novas, `push_subscriptions`, tabela de RPCs novas, cron.
- `docs/ARCHITECTURE.md`: diagrama Mermaid do lembrete (o do spec) e rotas `/carona`, `/api/lembretes`, `/api/push/chave`.
- `docs/TEST_REPORT.md`: contagens novas e checagens de produção.
- `docs/REQUIREMENTS_CHECKLIST.md`: itens novos (link, rota, chegada, lembrete) com status real (PARTIAL até o teste no celular).
- `CHANGELOG.md`, `README.md` (funcionalidades e scripts), Obsidian.

- [ ] **Step 6: Commit e push da documentação**

```bash
git add docs CHANGELOG.md README.md obsidian
git commit -m "docs: share link, route/arrival buttons and push reminders"
GH_TOKEN="$(gh auth token --user caronasunifal)" git push origin main
```
