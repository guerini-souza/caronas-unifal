// Teste de integração contra o Supabase (nuvem): concorrência, vagas, RLS e painel admin.
// Uso: node --env-file=.env.local scripts/concurrency-test.mjs
// Cria usuários de teste confirmados (service role), executa e remove tudo no final.
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

const PASSENGERS = Number(process.env.PASSENGERS ?? 10);
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const run = Date.now().toString(36);
const password = `T3ste-${run}-senha!`;
const created = [];
const createdHoods = [];
let adminEmail = null;
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

async function makeUser(label, phoneSuffix) {
  const email = `teste+${label}-${run}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  created.push(data.user.id);
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, email, client, phone: `55359${String(phoneSuffix).padStart(8, "0")}` };
}

async function main() {
  const { data: hood } = await admin.from("neighborhoods").select("id").eq("name", "Country Clube").single();
  const { data: points } = await admin
    .from("pickup_points").select("id, name").eq("neighborhood_id", hood.id).order("display_order");
  // Começou com 6 pontos; o painel admin pode cadastrar mais (em nov/2026 eram 10).
  check("Country Clube com pelo menos 6 pontos", points.length >= 6, `${points.length} pontos`);

  const driver = await makeUser("motorista", 1);
  const passengers = await Promise.all(Array.from({ length: PASSENGERS }, (_, i) => makeUser(`p${i}`, i + 2)));

  // Perfil sem ser dono não pode ser criado
  const spoof = await passengers[0].client.from("profiles").insert({
    user_id: driver.id, name: "Falso", phone: "5535999999999", neighborhood_id: hood.id,
  });
  check("RLS: não cria perfil de outro usuário", Boolean(spoof.error));

  for (const [i, u] of [driver, ...passengers].entries()) {
    const { error } = await u.client.from("profiles").insert({
      user_id: u.id, name: `Teste ${i} Sobrenome`, phone: u.phone, neighborhood_id: hood.id,
    });
    if (error) throw error;
  }

  const { data: others } = await passengers[0].client.from("profiles").select("id");
  check("RLS: usuário só lê o próprio perfil", others.length === 1);

  // Reserva antes de existir carona: create_ride exige veículo
  const noVehicle = await driver.client.rpc("create_ride", {
    p_vehicle_id: "00000000-0000-0000-0000-000000000000", p_neighborhood_id: hood.id,
    p_departure_at: new Date(Date.now() + 3600e3).toISOString(), p_total_seats: 1, p_price: 5,
    p_pickup_point_ids: [points[0].id], p_direction: "TO_CAMPUS",
  });
  check("create_ride exige veículo próprio", noVehicle.error?.message.includes("VEHICLE_NOT_FOUND"));

  const { data: vehicle, error: ve } = await driver.client
    .from("vehicles").insert({ user_id: driver.id, model: "Onix", color: "Prata", plate: "ABC1D23" })
    .select("id").single();
  if (ve) throw ve;

  const { data: foreignVehicles } = await passengers[0].client.from("vehicles").select("id, plate");
  check("RLS: placa de outro usuário não é legível", foreignVehicles.length === 0);

  const upd = await passengers[0].client.from("vehicles").update({ plate: "XXX0000" }).eq("id", vehicle.id).select();
  check("RLS: não edita veículo alheio", (upd.data ?? []).length === 0);

  const direct = await passengers[0].client.from("rides").insert({
    driver_id: passengers[0].id, vehicle_id: vehicle.id, neighborhood_id: hood.id,
    departure_at: new Date(Date.now() + 3600e3).toISOString(), total_seats: 8, available_seats: 8, price: 1,
  });
  check("RLS: não insere carona direto na tabela", Boolean(direct.error));

  const past = await driver.client.rpc("create_ride", {
    p_vehicle_id: vehicle.id, p_neighborhood_id: hood.id,
    p_departure_at: new Date(Date.now() - 60e3).toISOString(), p_total_seats: 1, p_price: 5,
    p_pickup_point_ids: [points[0].id], p_direction: "TO_CAMPUS",
  });
  check("create_ride rejeita horário passado", past.error?.message.includes("DEPARTURE_IN_PAST"));

  // Carona com 1 vaga
  const { data: rideId, error: re } = await driver.client.rpc("create_ride", {
    p_vehicle_id: vehicle.id, p_neighborhood_id: hood.id,
    p_departure_at: new Date(Date.now() + 3600e3).toISOString(), p_total_seats: 1, p_price: 5.5,
    p_pickup_point_ids: [points[0].id, points[3].id], p_direction: "TO_CAMPUS",
  });
  if (re) throw re;
  check("create_ride cria carona OPEN", typeof rideId === "string");

  const { data: list } = await passengers[0].client.rpc("list_available_rides", { p_pickup_point_id: points[3].id, p_direction: "TO_CAMPUS" });
  const listed = list.find((r) => r.ride_id === rideId);
  check("lista carona que passa pelo ponto", Boolean(listed));
  const { data: wrongDir } = await passengers[0].client.rpc("list_available_rides", { p_pickup_point_id: points[3].id, p_direction: "FROM_CAMPUS" });
  check("carona de IDA não aparece na busca de VOLTA", !wrongDir.some((r) => r.ride_id === rideId));
  check("carona volta com sentido na listagem", listed?.direction === "TO_CAMPUS");
  const badDir = await driver.client.rpc("create_ride", {
    p_vehicle_id: vehicle.id, p_neighborhood_id: hood.id,
    p_departure_at: new Date(Date.now() + 3600e3).toISOString(), p_total_seats: 1, p_price: 5,
    p_pickup_point_ids: [points[0].id], p_direction: "LADO",
  });
  check("create_ride rejeita sentido inválido", badDir.error?.message.includes("INVALID_DIRECTION"));
  check("placa mascarada na listagem", listed?.plate_masked === "ABC-***3", listed?.plate_masked);
  check("mostra só primeiro nome do motorista", listed?.driver_first_name === "Teste", listed?.driver_first_name);

  const own = await driver.client.rpc("reserve_seat", { p_ride_id: rideId, p_pickup_point_id: points[0].id });
  check("motorista não reserva a própria carona", own.error?.message.includes("OWN_RIDE"));

  const wrongPoint = await passengers[0].client.rpc("reserve_seat", { p_ride_id: rideId, p_pickup_point_id: points[1].id });
  check("rejeita ponto fora da rota", wrongPoint.error?.message.includes("POINT_NOT_IN_RIDE"));

  // ---- Concorrência: N passageiros disputam 1 vaga ao mesmo tempo ----
  const attempts = await Promise.all(
    passengers.map((p) => p.client.rpc("reserve_seat", { p_ride_id: rideId, p_pickup_point_id: points[0].id })),
  );
  const ok = attempts.filter((a) => !a.error);
  const full = attempts.filter((a) => a.error?.message.includes("RIDE_FULL"));
  check(`concorrência: ${PASSENGERS} pedidos simultâneos -> 1 reserva`, ok.length === 1, `${ok.length} sucesso, ${full.length} RIDE_FULL`);

  const { data: rideAfter } = await admin.from("rides").select("available_seats, status").eq("id", rideId).single();
  check("vaga reduzida para 0 e status FULL", rideAfter.available_seats === 0 && rideAfter.status === "FULL", JSON.stringify(rideAfter));

  const { count: activeCount } = await admin
    .from("reservations").select("id", { count: "exact", head: true }).eq("ride_id", rideId).eq("status", "ACTIVE");
  check("sem overbooking no banco", activeCount === 1, `ativas=${activeCount}`);

  const winnerIdx = attempts.findIndex((a) => !a.error);
  const winner = passengers[winnerIdx];
  const loser = passengers[(winnerIdx + 1) % PASSENGERS];
  const reservationId = ok[0].data[0].reservation_id;

  const listFull = await loser.client.rpc("list_available_rides", { p_pickup_point_id: points[0].id, p_direction: "TO_CAMPUS" });
  check("carona lotada some da busca", !listFull.data.some((r) => r.ride_id === rideId));

  const dup = await winner.client.rpc("reserve_seat", { p_ride_id: rideId, p_pickup_point_id: points[0].id });
  check("não reserva duas vezes", Boolean(dup.error));

  const foreignCancel = await loser.client.rpc("cancel_reservation", { p_reservation_id: reservationId });
  check("não cancela reserva alheia", foreignCancel.error?.message.includes("RESERVATION_NOT_FOUND"));

  const foreignRes = await loser.client.from("reservations").select("id").eq("id", reservationId);
  check("RLS: não lê reserva alheia", foreignRes.data.length === 0);

  const driverSees = await driver.client.from("reservations").select("id").eq("ride_id", rideId);
  check("motorista vê reservas da própria carona", driverSees.data.length === 1);

  // ---- Cancelamento pelo passageiro devolve a vaga ----
  const cancel = await winner.client.rpc("cancel_reservation", { p_reservation_id: reservationId });
  check("passageiro cancela a própria reserva", !cancel.error, cancel.error?.message);
  const { data: rideBack } = await admin.from("rides").select("available_seats, status").eq("id", rideId).single();
  check("vaga devolvida e status OPEN", rideBack.available_seats === 1 && rideBack.status === "OPEN", JSON.stringify(rideBack));
  const { data: resRow } = await admin.from("reservations").select("status, cancelled_at").eq("id", reservationId).single();
  check("reserva CANCELLED_BY_PASSENGER com data", resRow.status === "CANCELLED_BY_PASSENGER" && Boolean(resRow.cancelled_at));

  const again = await winner.client.rpc("cancel_reservation", { p_reservation_id: reservationId });
  check("não cancela duas vezes / não devolve vaga em dobro", again.error?.message.includes("RESERVATION_NOT_ACTIVE"));

  // ---- Cancelamento pelo motorista ----
  const r2 = await loser.client.rpc("reserve_seat", { p_ride_id: rideId, p_pickup_point_id: points[3].id });
  check("nova reserva após devolução", !r2.error, r2.error?.message);

  const foreignRideCancel = await loser.client.rpc("cancel_ride", { p_ride_id: rideId });
  check("passageiro não cancela carona alheia", foreignRideCancel.error?.message.includes("RIDE_NOT_FOUND"));

  const rc = await driver.client.rpc("cancel_ride", { p_ride_id: rideId });
  check("motorista cancela carona e recebe afetados", !rc.error && rc.data.length === 1 && rc.data[0].passenger_phone === loser.phone);
  const { data: resAfter } = await admin.from("reservations").select("status").eq("ride_id", rideId).eq("passenger_id", loser.id).eq("status", "CANCELLED_BY_DRIVER");
  check("reserva invalidada (CANCELLED_BY_DRIVER)", resAfter.length === 1);
  const { data: rideCancelled } = await admin.from("rides").select("status, cancelled_at").eq("id", rideId).single();
  check("carona CANCELLED com data", rideCancelled.status === "CANCELLED" && Boolean(rideCancelled.cancelled_at));

  const myRes = await loser.client.rpc("get_my_reservations");
  check("passageiro vê reserva cancelada pelo motorista", myRes.data.some((r) => r.reservation_status === "CANCELLED_BY_DRIVER"));

  // ---- Painel admin: só a conta da tabela app_admins edita bairros, pontos e fotos ----
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const intruder = passengers[1].client;
  const notAdmin = await intruder.rpc("is_admin");
  check("admin: aluno comum não é admin", notAdmin.data === false);
  const hackHood = await intruder.from("neighborhoods").insert({ name: `Invasor ${run}` });
  check("admin: aluno não cria bairro", Boolean(hackHood.error));
  const hackPoint = await intruder.from("pickup_points").insert({ neighborhood_id: hood.id, name: `Invasor ${run}` });
  check("admin: aluno não cria ponto", Boolean(hackPoint.error));
  const hackEdit = await intruder.from("pickup_points").update({ description: "hack" }).eq("id", points[0].id).select();
  check("admin: aluno não edita ponto", (hackEdit.data ?? []).length === 0);
  const hackUpload = await intruder.storage.from("pontos").upload(`teste-${run}.jpg`, jpeg, { contentType: "image/jpeg" });
  check("admin: aluno não envia foto", Boolean(hackUpload.error));
  const readAdmins = await intruder.from("app_admins").select("email");
  check("admin: aluno não lê a lista de admins", Boolean(readAdmins.error) || (readAdmins.data ?? []).length === 0);
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const anonPoint = await anon.from("pickup_points").insert({ neighborhood_id: hood.id, name: `Anon ${run}` });
  const anonUpload = await anon.storage.from("pontos").upload(`anon-${run}.jpg`, jpeg, { contentType: "image/jpeg" });
  const anonAdmin = await anon.rpc("is_admin");
  check("admin: sem login não cria ponto, não envia foto, não chama is_admin", Boolean(anonPoint.error && anonUpload.error && anonAdmin.error));

  adminEmail = `teste+admin-${run}@example.com`;
  await admin.from("app_admins").insert({ email: adminEmail });
  const adm = await makeUser("admin", 99);
  check("admin: conta listada em app_admins é admin", (await adm.client.rpc("is_admin")).data === true);
  const { data: newHood, error: nhErr } = await adm.client
    .from("neighborhoods").insert({ name: `Bairro Teste ${run}`, active: false }).select("id").single();
  check("admin: cria bairro", !nhErr, nhErr?.message);
  if (newHood) createdHoods.push(newHood.id);
  const { data: newPoint, error: npErr } = await adm.client
    .from("pickup_points").insert({ neighborhood_id: newHood?.id, name: "Ponto Teste", address: "Rua Teste, 1", display_order: 1 })
    .select("id, data_status").single();
  check("admin: cria ponto (sem foto fica aguardando dados)", !npErr && newPoint?.data_status === "pending_data", npErr?.message);
  const path = `teste-${run}.jpg`;
  const up = await adm.client.storage.from("pontos").upload(path, jpeg, { contentType: "image/jpeg" });
  check("admin: envia foto", !up.error, up.error?.message);
  const publicUrl = adm.client.storage.from("pontos").getPublicUrl(path).data.publicUrl;
  const photoRes = await fetch(publicUrl);
  check("foto é pública para qualquer um", photoRes.ok, String(photoRes.status));
  const { data: done } = await adm.client
    .from("pickup_points").update({ image_url: publicUrl }).eq("id", newPoint?.id).select("data_status").single();
  check("ponto com endereço + foto fica completo", done?.data_status === "complete");
  const moveHood = await adm.client.from("pickup_points").update({ neighborhood_id: hood.id }).eq("id", newPoint?.id);
  check("admin: ponto não muda de bairro", Boolean(moveHood.error));
  const badUrl = await adm.client.from("pickup_points").update({ image_url: "javascript:alert(1)" }).eq("id", newPoint?.id);
  check("foto só com endereço https", Boolean(badUrl.error));
  const hackUpsert = await intruder.storage.from("pontos").upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
  const hackMove = await intruder.storage.from("pontos").move(path, `movida-${run}.jpg`);
  check("admin: aluno não sobrescreve nem move foto", Boolean(hackUpsert.error && hackMove.error));
  const { data: hiddenPoint } = await adm.client
    .from("pickup_points").insert({ neighborhood_id: hood.id, name: `Oculto ${run}`, active: false, display_order: 99 })
    .select("id").single();
  const { data: seeHidden } = await intruder.from("pickup_points").select("id").eq("id", hiddenPoint?.id);
  check("ponto oculto não aparece para alunos", Boolean(hiddenPoint) && (seeHidden ?? []).length === 0);
  if (hiddenPoint) await admin.from("pickup_points").delete().eq("id", hiddenPoint.id);
  const { data: viaHiddenHood } = await intruder
    .from("pickup_points").select("id, neighborhoods!inner(active)").eq("id", newPoint?.id).eq("neighborhoods.active", true);
  check("ponto de bairro oculto não abre para alunos", (viaHiddenHood ?? []).length === 0);
  const hackDelete = await intruder.storage.from("pontos").remove([path]);
  const stillThere = await fetch(publicUrl);
  check("admin: aluno não apaga foto", (hackDelete.data ?? []).length === 0 && stillThere.ok);
  const { data: hiddenForStudents } = await intruder.from("neighborhoods").select("id").eq("id", newHood?.id);
  check("bairro desativado não aparece para alunos", (hiddenForStudents ?? []).length === 0);
  const rm = await adm.client.storage.from("pontos").remove([path]);
  check("admin: apaga foto", !rm.error && (rm.data ?? []).length === 1, rm.error?.message);

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
  await rider.client.rpc("cancel_reservation", { p_reservation_id: tripReservation });
  const { data: rebooked, error: rebookErr } = await rider.client.rpc("reserve_seat", { p_ride_id: tripRide, p_pickup_point_id: points[2].id });
  if (rebookErr) throw rebookErr;
  const arrive3 = await rider.client.rpc("mark_arrived", { p_reservation_id: rebooked[0].reservation_id }).single();
  check("chegada: cancelar e reservar de novo não avisa de novo", !arrive3.error && arrive3.data.newly_arrived === false, arrive3.error?.message);

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
  const otherGoogle = await rider.client.rpc("save_push_subscription", { p_endpoint: `https://storage.googleapis.com/${run}`, ...keys });
  check("push: recusa outro serviço do Google", Boolean(otherGoogle.error));
  for (let i = 0; i < 7; i++) {
    await rider.client.rpc("save_push_subscription", { p_endpoint: `https://fcm.googleapis.com/fcm/send/teste-${run}-${i}`, ...keys });
  }
  const { count: kept } = await admin.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", rider.id);
  check("push: no máximo 5 celulares por conta", kept === 5, `${kept} celulares`);
}

try {
  await main();
} catch (e) {
  check("execução sem exceção", false, e?.message ?? String(e));
} finally {
  // Remove usuários de teste (cascata apaga perfis, veículos, caronas e reservas).
  for (const id of created) {
    await admin.from("notification_logs").delete().eq("created_by", id);
    await admin.from("reservations").delete().eq("passenger_id", id);
    await admin.from("rides").delete().eq("driver_id", id);
  }
  for (const id of createdHoods) {
    await admin.from("pickup_points").delete().eq("neighborhood_id", id);
    await admin.from("neighborhoods").delete().eq("id", id);
  }
  if (adminEmail) await admin.from("app_admins").delete().eq("email", adminEmail);
  for (const id of created) await admin.auth.admin.deleteUser(id);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} verificações passaram.`);
  process.exit(failed ? 1 : 0);
}
