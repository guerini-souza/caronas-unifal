// Teste de carga leve contra o Supabase e o site em produção.
// Uso: npm run test:load   (lê .env.local; LOAD_SITE_URL troca o site)
// Cria usuários de teste confirmados, simula motoristas ofertando e alunos buscando/reservando
// ao mesmo tempo, confere que nenhuma carona passou do limite de vagas e remove tudo no final.
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE = (process.env.LOAD_SITE_URL ?? "https://app-caronas-seven.vercel.app").replace(/\/$/, "");
if (!URL || !ANON || !SERVICE) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

const DRIVERS = 5;
const PASSENGERS = 10; // contas reais; os alunos virtuais se revezam entre elas
const OFFERS_EACH = 20; // fase 1: caronas por motorista, todas ao mesmo tempo
const MIXED_OFFERS_EACH = 10; // fase 3: caronas novas por motorista durante as buscas
const MIXED_STUDENTS = 60; // fase 3: alunos virtuais buscando e reservando
const MIXED_ROUNDS = 3;
const SEARCH_LEVELS = [10, 25, 50, 100, 200];
const SITE_LEVELS = [10, 25, 50, 100];
const ROUNDS = 5;
// Para a escalada se o nível ficar ruim: mais de 5% de erro ou p95 acima de 5 s.
const MAX_ERROR_RATE = 0.05;
const MAX_P95_MS = 5000;
// Respostas normais de disputa por vaga (não são falhas do sistema).
const BUSINESS = ["RIDE_FULL", "ALREADY_RESERVED", "RESERVATION_NOT_ACTIVE"];

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const run = Date.now().toString(36);
const password = `T3ste-${run}-senha!`;
const created = [];
const checks = [];

function check(name, ok, detail = "") {
  checks.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

async function makeUser(label, phoneSuffix, hoodId) {
  const email = `teste+carga-${label}-${run}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  created.push(data.user.id);
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  const { error: e3 } = await client.from("profiles").insert({
    user_id: data.user.id, name: `Carga ${label}`, phone: `55359${String(phoneSuffix).padStart(8, "0")}`, neighborhood_id: hoodId,
  });
  if (e3) throw e3;
  return { id: data.user.id, client };
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function rpc(client, fn, args) {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw error;
  return data;
}

function bucket() {
  return { lat: [], business: 0, errors: 0, samples: new Set(), started: performance.now(), wall: 0 };
}

/** Mede a chamada; separa respostas de negócio (vaga esgotada) de falhas reais. */
async function timed(b, fn) {
  const t = performance.now();
  try {
    const r = await fn();
    b.lat.push(performance.now() - t);
    return r;
  } catch (e) {
    const msg = e?.message ?? String(e);
    if (BUSINESS.some((code) => msg.includes(code))) {
      b.business++;
      b.lat.push(performance.now() - t);
    } else {
      b.errors++;
      b.samples.add(msg.slice(0, 100));
    }
    return null;
  }
}

function stats(b) {
  const sorted = [...b.lat].sort((x, y) => x - y);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
  const total = b.lat.length + b.errors;
  return { total, errors: b.errors, business: b.business, rps: total / (b.wall / 1000), p50: q(0.5), p95: q(0.95), max: sorted.at(-1) ?? 0 };
}

function print(label, b) {
  const s = stats(b);
  const ms = (v) => `${Math.round(v)} ms`.padStart(8);
  const extra = s.business ? `  (${s.business} sem vaga/repetida)` : "";
  console.log(
    `${label.padEnd(22)} ${String(s.total).padStart(5)} pedidos  ${String(s.errors).padStart(3)} erros  ` +
      `${s.rps.toFixed(0).padStart(4)}/s  p50 ${ms(s.p50)}  p95 ${ms(s.p95)}  máx ${ms(s.max)}${extra}`,
  );
  for (const m of b.samples) console.log(`    erro: ${m}`);
  return s;
}

/** N trabalhadores em paralelo; cada um repete ROUNDS vezes a sequência de chamadas. */
async function level(concurrency, task) {
  const b = bucket();
  await Promise.all(
    Array.from({ length: concurrency }, async (_, worker) => {
      for (let round = 0; round < ROUNDS; round++) {
        for (const call of task(worker)) await timed(b, call);
      }
    }),
  );
  b.wall = performance.now() - b.started;
  return b;
}

const tooBad = (s) => s.errors / s.total > MAX_ERROR_RATE || s.p95 > MAX_P95_MS;

async function main() {
  const { data: hood } = await admin.from("neighborhoods").select("id").eq("name", "Country Clube").single();
  const { data: points } = await admin
    .from("pickup_points").select("id").eq("neighborhood_id", hood.id).order("display_order");
  const pointIds = points.map((p) => p.id);

  const drivers = [];
  for (let i = 0; i < DRIVERS; i++) {
    const d = await makeUser(`m${i}`, 80 + i, hood.id);
    const { data: v, error } = await d.client
      .from("vehicles").insert({ user_id: d.id, model: "Onix", color: "Prata", plate: `CRG${i}A23` })
      .select("id").single();
    if (error) throw error;
    drivers.push({ ...d, vehicleId: v.id });
  }
  const passengers = [];
  for (let i = 0; i < PASSENGERS; i++) passengers.push(await makeUser(`p${i}`, 90 + i, hood.id));

  // Carona aleatória: sentido, horário nas próximas 12 h, 1 a 4 vagas, 1 a 3 pontos em ordem.
  const offer = (d) => () => {
    const route = [...pointIds].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 3));
    return rpc(d.client, "create_ride", {
      p_vehicle_id: d.vehicleId, p_neighborhood_id: hood.id,
      p_departure_at: new Date(Date.now() + (1 + Math.random() * 11) * 3600e3).toISOString(),
      p_total_seats: 1 + Math.floor(Math.random() * 4), p_price: 5,
      p_pickup_point_ids: route, p_direction: Math.random() < 0.5 ? "TO_CAMPUS" : "FROM_CAMPUS",
    });
  };

  // ---- Fase 1: muitos motoristas ofertando ao mesmo tempo ----
  console.log(`\n1) Oferta: ${DRIVERS} motoristas publicando ${OFFERS_EACH} caronas cada, tudo ao mesmo tempo`);
  const offers = bucket();
  const rideIds = (await Promise.all(drivers.flatMap((d) => Array.from({ length: OFFERS_EACH }, () => timed(offers, offer(d))))))
    .filter(Boolean);
  offers.wall = performance.now() - offers.started;
  print(`${DRIVERS * OFFERS_EACH} ofertas`, offers);
  const { count: ridesInDb } = await admin
    .from("rides").select("id", { count: "exact", head: true }).in("driver_id", drivers.map((d) => d.id));
  check("todas as caronas ofertadas foram gravadas", ridesInDb === DRIVERS * OFFERS_EACH, `${ridesInDb} no banco`);

  // ---- Fase 2: busca com o banco já cheio de caronas ----
  console.log(`\n2) Busca: cada aluno virtual faz ${ROUNDS}x listar caronas, abrir carona e ver as próprias reservas`);
  const searchFlow = (worker) => {
    const { client } = passengers[worker % passengers.length];
    return [
      () => rpc(client, "list_available_rides", { p_pickup_point_id: pick(pointIds), p_direction: pick(["TO_CAMPUS", "FROM_CAMPUS"]) }),
      () => rpc(client, "get_ride_summary", { p_ride_id: pick(rideIds) }),
      () => rpc(client, "get_my_reservations"),
    ];
  };
  for (const n of SEARCH_LEVELS) {
    if (tooBad(print(`${n} ao mesmo tempo`, await level(n, searchFlow)))) break;
  }

  // ---- Fase 3: oferta, busca e reserva ao mesmo tempo ----
  console.log(
    `\n3) Tudo junto: ${DRIVERS} motoristas publicando +${MIXED_OFFERS_EACH} caronas cada enquanto ` +
      `${MIXED_STUDENTS} alunos buscam, reservam e às vezes cancelam (${MIXED_ROUNDS}x cada)`,
  );
  const mixOffer = bucket();
  const mixSearch = bucket();
  const mixReserve = bucket();
  const mixCancel = bucket();
  let reserved = 0;
  await Promise.all([
    ...drivers.flatMap((d) => Array.from({ length: MIXED_OFFERS_EACH }, () => timed(mixOffer, offer(d)))),
    ...Array.from({ length: MIXED_STUDENTS }, async (_, i) => {
      const { client } = passengers[i % passengers.length];
      for (let round = 0; round < MIXED_ROUNDS; round++) {
        const point = pick(pointIds);
        const list = await timed(mixSearch, () =>
          rpc(client, "list_available_rides", { p_pickup_point_id: point, p_direction: pick(["TO_CAMPUS", "FROM_CAMPUS"]) }),
        );
        const options = (list ?? []).filter((r) => r.available_seats > 0 && !r.already_reserved && !r.is_mine);
        if (options.length === 0) continue;
        const res = await timed(mixReserve, () =>
          rpc(client, "reserve_seat", { p_ride_id: pick(options).ride_id, p_pickup_point_id: point }),
        );
        if (!res) continue;
        reserved++;
        if (Math.random() < 0.25) {
          await timed(mixCancel, () => rpc(client, "cancel_reservation", { p_reservation_id: res[0].reservation_id }));
        }
      }
    }),
  ]);
  for (const b of [mixOffer, mixSearch, mixReserve, mixCancel]) b.wall = performance.now() - b.started;
  print("ofertar", mixOffer);
  print("buscar", mixSearch);
  print("reservar", mixReserve);
  print("cancelar reserva", mixCancel);
  console.log(`    ${reserved} reservas feitas durante a mistura`);

  // ---- Integridade: nenhuma carona com mais passageiros que vagas ----
  const { data: rides } = await admin
    .from("rides").select("id, total_seats, available_seats, status").in("driver_id", drivers.map((d) => d.id));
  const { data: active } = await admin
    .from("reservations").select("ride_id, passenger_id").eq("status", "ACTIVE").in("passenger_id", passengers.map((p) => p.id));
  const perRide = new Map();
  for (const r of active) perRide.set(r.ride_id, (perRide.get(r.ride_id) ?? 0) + 1);
  const over = rides.filter((r) => (perRide.get(r.id) ?? 0) > r.total_seats);
  const wrongCount = rides.filter((r) => r.available_seats !== r.total_seats - (perRide.get(r.id) ?? 0));
  const wrongStatus = rides.filter((r) => (r.available_seats === 0) !== (r.status === "FULL"));
  const pairs = new Set(active.map((r) => `${r.ride_id}:${r.passenger_id}`));
  console.log("");
  check("todas as caronas da mistura gravadas", rides.length === DRIVERS * (OFFERS_EACH + MIXED_OFFERS_EACH), `${rides.length} caronas`);
  check("nenhuma carona com mais passageiros que vagas (sem overbooking)", over.length === 0, `${active.length} reservas ativas`);
  check("vagas restantes batem com as reservas", wrongCount.length === 0, `${wrongCount.length} divergentes`);
  check("carona sem vaga fica LOTADA, com vaga fica ABERTA", wrongStatus.length === 0, `${wrongStatus.length} divergentes`);
  check("ninguém com duas reservas na mesma carona", pairs.size === active.length);
  const unexpected = [offers, mixOffer, mixSearch, mixReserve, mixCancel].reduce((n, b) => n + b.errors, 0);
  check("oferta e reserva sem erro inesperado", unexpected === 0, `${unexpected} erros`);

  // ---- Fase 4: site (servidor da Vercel consultando o banco) ----
  const page = () => [
    async () => {
      const res = await fetch(`${SITE}/pontos`, { headers: { "cache-control": "no-cache" } });
      await res.arrayBuffer();
      if (!res.ok) throw new Error(String(res.status));
    },
  ];
  console.log(`\n4) Site: cada visitante virtual abre ${ROUNDS}x ${SITE}/pontos`);
  for (const n of SITE_LEVELS) {
    if (tooBad(print(`${n} ao mesmo tempo`, await level(n, page)))) break;
  }
}

try {
  await main();
} catch (e) {
  check("execução sem exceção", false, e?.message ?? String(e));
} finally {
  for (const id of created) {
    await admin.from("reservations").delete().eq("passenger_id", id);
    await admin.from("rides").delete().eq("driver_id", id);
  }
  for (const id of created) await admin.auth.admin.deleteUser(id);
  console.log(`\n${created.length} usuários de teste removidos.`);
  process.exit(checks.every(Boolean) ? 0 : 1);
}
