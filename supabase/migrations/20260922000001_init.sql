-- =====================================================================
-- App de Caronas — schema inicial
-- Tabelas, RLS e funções transacionais (RPC).
-- Todas as mutações de caronas/reservas passam por funções SECURITY DEFINER
-- que validam o usuário e usam lock de linha (FOR UPDATE) contra overbooking.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

create table public.neighborhoods (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(name) between 2 and 80),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.pickup_points (
  id               uuid primary key default gen_random_uuid(),
  neighborhood_id  uuid not null references public.neighborhoods(id),
  name             text not null check (char_length(name) between 1 and 80),
  -- Dados ainda não fornecidos ficam NULL (nunca inventar).
  address          text,
  latitude         numeric(9,6) check (latitude between -90 and 90),
  longitude        numeric(9,6) check (longitude between -180 and 180),
  image_url        text,
  description      text,
  data_status      text not null default 'pending_data'
                   check (data_status in ('pending_data', 'complete')),
  display_order    int not null default 0,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (neighborhood_id, name)
);

create table public.profiles (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references auth.users(id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 2 and 80),
  -- Somente dígitos, com DDI 55: 55 + DDD + número (10 ou 11 dígitos).
  phone            text not null check (phone ~ '^55[0-9]{10,11}$'),
  -- Copiado de auth.users por trigger (não confiável vindo do cliente).
  email            text,
  neighborhood_id  uuid references public.neighborhoods(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.vehicles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  model       text not null check (char_length(btrim(model)) between 2 and 60),
  color       text not null check (char_length(btrim(color)) between 2 and 30),
  -- Placa normalizada: 7 caracteres, padrão antigo (ABC1234) ou Mercosul (ABC1D23).
  plate       text not null check (plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Um veículo ativo por usuário no MVP.
create unique index vehicles_one_active_per_user on public.vehicles (user_id) where active;

create table public.rides (
  id               uuid primary key default gen_random_uuid(),
  driver_id        uuid not null references auth.users(id) on delete cascade,
  vehicle_id       uuid not null references public.vehicles(id),
  neighborhood_id  uuid not null references public.neighborhoods(id),
  departure_at     timestamptz not null,
  total_seats      int not null check (total_seats between 1 and 8),
  available_seats  int not null,
  price            numeric(10,2) not null check (price >= 0 and price <= 1000),
  status           text not null default 'OPEN'
                   check (status in ('OPEN', 'FULL', 'CANCELLED', 'COMPLETED')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  cancelled_at     timestamptz,
  constraint rides_seats_range check (available_seats between 0 and total_seats)
);
create index rides_open_departure on public.rides (departure_at) where status in ('OPEN', 'FULL');
create index rides_driver on public.rides (driver_id);

-- Pontos que a carona percorre, em ordem (base para rotas compartilhadas no futuro).
create table public.ride_pickup_points (
  id               uuid primary key default gen_random_uuid(),
  ride_id          uuid not null references public.rides(id) on delete cascade,
  pickup_point_id  uuid not null references public.pickup_points(id),
  route_order      int not null check (route_order >= 1),
  unique (ride_id, pickup_point_id),
  unique (ride_id, route_order)
);
create index ride_pickup_points_point on public.ride_pickup_points (pickup_point_id);

create table public.reservations (
  id               uuid primary key default gen_random_uuid(),
  ride_id          uuid not null references public.rides(id) on delete cascade,
  passenger_id     uuid not null references auth.users(id) on delete cascade,
  pickup_point_id  uuid not null references public.pickup_points(id),
  status           text not null default 'ACTIVE'
                   check (status in ('ACTIVE', 'CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER', 'COMPLETED')),
  created_at       timestamptz not null default now(),
  cancelled_at     timestamptz
);
-- Impede reserva duplicada ativa do mesmo passageiro na mesma carona.
create unique index reservations_one_active on public.reservations (ride_id, passenger_id) where status = 'ACTIVE';
create index reservations_passenger on public.reservations (passenger_id);

create table public.notification_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,    -- destinatário
  created_by  uuid references auth.users(id) on delete cascade,     -- quem disparou
  type        text not null,          -- ex.: ride_cancelled
  channel     text not null,          -- email | whatsapp_link
  payload     jsonb not null default '{}'::jsonb,
  status      text not null,          -- sent | failed | skipped
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger vehicles_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();
create trigger rides_updated_at before update on public.rides
  for each row execute function public.set_updated_at();

-- E-mail do perfil sempre vem de auth.users; user_id é imutável.
create or replace function public.profiles_sync_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'user_id é imutável';
  end if;
  select u.email into new.email from auth.users u where u.id = new.user_id;
  return new;
end $$;

create trigger profiles_email before insert or update on public.profiles
  for each row execute function public.profiles_sync_email();

create or replace function public.vehicles_guard() returns trigger
language plpgsql as $$
begin
  if new.user_id <> old.user_id then
    raise exception 'user_id é imutável';
  end if;
  return new;
end $$;

create trigger vehicles_guard before update on public.vehicles
  for each row execute function public.vehicles_guard();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

-- Privilégios explícitos (o projeto não expõe tabelas novas automaticamente).
-- O RLS abaixo continua filtrando quais LINHAS cada usuário vê/altera.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.neighborhoods, public.pickup_points to anon, authenticated;
grant select, insert, update on public.profiles, public.vehicles to authenticated;
grant select on public.rides, public.ride_pickup_points, public.reservations to authenticated;
grant select on public.notification_logs to authenticated;
grant all on all tables in schema public to service_role;

alter table public.neighborhoods      enable row level security;
alter table public.pickup_points      enable row level security;
alter table public.profiles           enable row level security;
alter table public.vehicles           enable row level security;
alter table public.rides              enable row level security;
alter table public.ride_pickup_points enable row level security;
alter table public.reservations       enable row level security;
alter table public.notification_logs  enable row level security;

-- Helpers SECURITY DEFINER para evitar recursão entre políticas de rides/reservations.
create or replace function public.is_ride_passenger(p_ride_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reservations x
                 where x.ride_id = p_ride_id and x.passenger_id = auth.uid())
$$;

create or replace function public.is_ride_driver(p_ride_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.rides r
                 where r.id = p_ride_id and r.driver_id = auth.uid())
$$;

-- Bairros e pontos: leitura pública (Pontos para Bixetes). Escrita só pelo painel/admin.
create policy neighborhoods_read on public.neighborhoods
  for select to anon, authenticated using (active);
create policy pickup_points_read on public.pickup_points
  for select to anon, authenticated using (active);

-- Perfil: cada usuário só vê/cria/edita o próprio.
create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Veículo: somente o dono (placa nunca exposta a terceiros por tabela).
create policy vehicles_select_own on public.vehicles
  for select to authenticated using (user_id = (select auth.uid()));
create policy vehicles_insert_own on public.vehicles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy vehicles_update_own on public.vehicles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Caronas: leitura das abertas/lotadas, das próprias e das que reservei.
-- Sem políticas de INSERT/UPDATE/DELETE: mutações só via funções abaixo.
create policy rides_select on public.rides
  for select to authenticated using (
    status in ('OPEN', 'FULL')
    or driver_id = (select auth.uid())
    or public.is_ride_passenger(id)
  );

create policy ride_pickup_points_select on public.ride_pickup_points
  for select to authenticated using (
    exists (select 1 from public.rides r where r.id = ride_pickup_points.ride_id)
  );

-- Reservas: passageiro vê as suas; motorista vê as das suas caronas.
create policy reservations_select on public.reservations
  for select to authenticated using (
    passenger_id = (select auth.uid())
    or public.is_ride_driver(ride_id)
  );

create policy notification_logs_select_own on public.notification_logs
  for select to authenticated using (created_by = (select auth.uid()));
-- Sem política de INSERT: logs são gravados pelo servidor com a service role.

-- ---------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------

-- Garante usuário autenticado, com e-mail verificado e perfil completo.
create or replace function public.assert_ready_user() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if not exists (select 1 from auth.users u where u.id = v_uid and u.email_confirmed_at is not null) then
    raise exception 'EMAIL_NOT_VERIFIED' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = v_uid) then
    raise exception 'PROFILE_REQUIRED' using errcode = 'P0001';
  end if;
  return v_uid;
end $$;

-- Máscara pública da placa: ABC1D23 -> ABC-***3
create or replace function public.mask_plate(p_plate text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_plate is null or char_length(p_plate) < 4 then '***'
    else substr(p_plate, 1, 3) || '-***' || right(p_plate, 1)
  end
$$;

-- Primeiro nome (não expõe nome completo em listagens).
create or replace function public.first_name(p_name text) returns text
language sql immutable set search_path = '' as $$
  select split_part(btrim(coalesce(p_name, '')), ' ', 1)
$$;

-- Pontos da carona em ordem, como JSON [{id,name,route_order}].
create or replace function public.ride_points_json(p_ride_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', pp.id, 'name', pp.name, 'route_order', rpp.route_order)
         order by rpp.route_order), '[]'::jsonb)
  from public.ride_pickup_points rpp
  join public.pickup_points pp on pp.id = rpp.pickup_point_id
  where rpp.ride_id = p_ride_id
$$;

-- ---------------------------------------------------------------------
-- RPC: criar carona (atômico: carona + pontos)
-- ---------------------------------------------------------------------
create or replace function public.create_ride(
  p_vehicle_id        uuid,
  p_neighborhood_id   uuid,
  p_departure_at      timestamptz,
  p_total_seats       int,
  p_price             numeric,
  p_pickup_point_ids  uuid[]
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := public.assert_ready_user();
  v_ride_id uuid;
  v_count   int;
begin
  if not exists (select 1 from public.vehicles v
                 where v.id = p_vehicle_id and v.user_id = v_uid and v.active) then
    raise exception 'VEHICLE_NOT_FOUND';
  end if;
  if not exists (select 1 from public.neighborhoods n where n.id = p_neighborhood_id and n.active) then
    raise exception 'NEIGHBORHOOD_NOT_FOUND';
  end if;
  if p_departure_at is null or p_departure_at <= now() then
    raise exception 'DEPARTURE_IN_PAST';
  end if;
  if p_departure_at > now() + interval '60 days' then
    raise exception 'DEPARTURE_TOO_FAR';
  end if;
  if p_total_seats is null or p_total_seats < 1 or p_total_seats > 8 then
    raise exception 'INVALID_SEATS';
  end if;
  if p_price is null or p_price < 0 or p_price > 1000 then
    raise exception 'INVALID_PRICE';
  end if;
  if p_pickup_point_ids is null or cardinality(p_pickup_point_ids) = 0 then
    raise exception 'POINTS_REQUIRED';
  end if;
  if cardinality(p_pickup_point_ids) <> (select count(distinct x) from unnest(p_pickup_point_ids) x) then
    raise exception 'DUPLICATE_POINTS';
  end if;
  select count(*) into v_count
  from public.pickup_points pp
  where pp.id = any(p_pickup_point_ids) and pp.neighborhood_id = p_neighborhood_id and pp.active;
  if v_count <> cardinality(p_pickup_point_ids) then
    raise exception 'INVALID_POINTS';
  end if;

  insert into public.rides (driver_id, vehicle_id, neighborhood_id, departure_at,
                            total_seats, available_seats, price, status)
  values (v_uid, p_vehicle_id, p_neighborhood_id, p_departure_at,
          p_total_seats, p_total_seats, round(p_price, 2), 'OPEN')
  returning id into v_ride_id;

  insert into public.ride_pickup_points (ride_id, pickup_point_id, route_order)
  select v_ride_id, t.pid, t.ord::int
  from unnest(p_pickup_point_ids) with ordinality as t(pid, ord);

  return v_ride_id;
end $$;

-- ---------------------------------------------------------------------
-- RPC: caronas disponíveis que passam por um ponto
-- ---------------------------------------------------------------------
create or replace function public.list_available_rides(p_pickup_point_id uuid)
returns table (
  ride_id            uuid,
  departure_at       timestamptz,
  price              numeric,
  available_seats    int,
  total_seats        int,
  driver_first_name  text,
  vehicle_model      text,
  vehicle_color      text,
  plate_masked       text,
  points             jsonb,
  already_reserved   boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := public.assert_ready_user();
begin
  return query
  select r.id, r.departure_at, r.price, r.available_seats, r.total_seats,
         public.first_name(p.name), v.model, v.color, public.mask_plate(v.plate),
         public.ride_points_json(r.id),
         exists (select 1 from public.reservations x
                 where x.ride_id = r.id and x.passenger_id = v_uid and x.status = 'ACTIVE')
  from public.rides r
  join public.ride_pickup_points rpp on rpp.ride_id = r.id and rpp.pickup_point_id = p_pickup_point_id
  join public.vehicles v on v.id = r.vehicle_id
  left join public.profiles p on p.user_id = r.driver_id
  where r.status = 'OPEN'
    and r.available_seats > 0
    and r.departure_at > now()
    and r.driver_id <> v_uid
  order by r.departure_at
  limit 100;
end $$;

-- ---------------------------------------------------------------------
-- RPC: resumo de uma carona (para a tela de confirmação)
-- ---------------------------------------------------------------------
create or replace function public.get_ride_summary(p_ride_id uuid)
returns table (
  ride_id            uuid,
  departure_at       timestamptz,
  price              numeric,
  available_seats    int,
  total_seats        int,
  status             text,
  neighborhood_name  text,
  driver_first_name  text,
  vehicle_model      text,
  vehicle_color      text,
  plate_masked       text,
  points             jsonb,
  is_driver          boolean,
  already_reserved   boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := public.assert_ready_user();
begin
  return query
  select r.id, r.departure_at, r.price, r.available_seats, r.total_seats, r.status,
         n.name, public.first_name(p.name), v.model, v.color, public.mask_plate(v.plate),
         public.ride_points_json(r.id),
         r.driver_id = v_uid,
         exists (select 1 from public.reservations x
                 where x.ride_id = r.id and x.passenger_id = v_uid and x.status = 'ACTIVE')
  from public.rides r
  join public.neighborhoods n on n.id = r.neighborhood_id
  join public.vehicles v on v.id = r.vehicle_id
  left join public.profiles p on p.user_id = r.driver_id
  where r.id = p_ride_id
    and (r.status in ('OPEN', 'FULL')
         or r.driver_id = v_uid
         or exists (select 1 from public.reservations x where x.ride_id = r.id and x.passenger_id = v_uid));
end $$;

-- ---------------------------------------------------------------------
-- RPC: reservar vaga (transacional, sem overbooking)
-- ---------------------------------------------------------------------
create or replace function public.reserve_seat(p_ride_id uuid, p_pickup_point_id uuid)
returns table (
  reservation_id      uuid,
  departure_at        timestamptz,
  pickup_point_name   text,
  driver_first_name   text,
  driver_phone        text,
  available_seats     int
)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := public.assert_ready_user();
  v_ride  public.rides%rowtype;
  v_res   uuid;
  v_point text;
begin
  -- Lock da linha da carona: reservas concorrentes na mesma carona são serializadas.
  select * into v_ride from public.rides r where r.id = p_ride_id for update;
  if not found then
    raise exception 'RIDE_NOT_FOUND';
  end if;
  if v_ride.driver_id = v_uid then
    raise exception 'OWN_RIDE';
  end if;
  if v_ride.status <> 'OPEN' or v_ride.available_seats <= 0 then
    raise exception 'RIDE_FULL';
  end if;
  if v_ride.departure_at <= now() then
    raise exception 'RIDE_DEPARTED';
  end if;
  select pp.name into v_point
  from public.ride_pickup_points rpp
  join public.pickup_points pp on pp.id = rpp.pickup_point_id
  where rpp.ride_id = p_ride_id and rpp.pickup_point_id = p_pickup_point_id;
  if v_point is null then
    raise exception 'POINT_NOT_IN_RIDE';
  end if;
  if exists (select 1 from public.reservations x
             where x.ride_id = p_ride_id and x.passenger_id = v_uid and x.status = 'ACTIVE') then
    raise exception 'ALREADY_RESERVED';
  end if;

  insert into public.reservations (ride_id, passenger_id, pickup_point_id, status)
  values (p_ride_id, v_uid, p_pickup_point_id, 'ACTIVE')
  returning id into v_res;

  update public.rides r
     set available_seats = r.available_seats - 1,
         status = case when r.available_seats - 1 = 0 then 'FULL' else r.status end
   where r.id = p_ride_id;

  return query
  select v_res, v_ride.departure_at, v_point, public.first_name(p.name), p.phone,
         v_ride.available_seats - 1
  from (select 1) as one
  left join public.profiles p on p.user_id = v_ride.driver_id;
end $$;

-- ---------------------------------------------------------------------
-- RPC: passageiro cancela a própria reserva (devolve a vaga)
-- ---------------------------------------------------------------------
create or replace function public.cancel_reservation(p_reservation_id uuid)
returns table (
  departure_at       timestamptz,
  driver_first_name  text,
  driver_phone       text,
  available_seats    int
)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := public.assert_ready_user();
  v_ride_id uuid;
  v_ride    public.rides%rowtype;
  v_status  text;
  v_owner   uuid;
begin
  select x.ride_id into v_ride_id from public.reservations x where x.id = p_reservation_id;
  if v_ride_id is null then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;

  -- Mesma ordem de lock do reserve_seat (carona -> reserva) para evitar deadlock.
  select * into v_ride from public.rides r where r.id = v_ride_id for update;
  select x.status, x.passenger_id into v_status, v_owner
  from public.reservations x where x.id = p_reservation_id for update;

  if v_owner <> v_uid then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;
  if v_status <> 'ACTIVE' then
    raise exception 'RESERVATION_NOT_ACTIVE';
  end if;
  if v_ride.departure_at <= now() then
    raise exception 'RIDE_DEPARTED';
  end if;

  update public.reservations x
     set status = 'CANCELLED_BY_PASSENGER', cancelled_at = now()
   where x.id = p_reservation_id;

  if v_ride.status in ('OPEN', 'FULL') then
    update public.rides r
       set available_seats = least(r.available_seats + 1, r.total_seats),
           status = 'OPEN'
     where r.id = v_ride_id;
  end if;

  return query
  select r.departure_at, public.first_name(p.name), p.phone, r.available_seats
  from public.rides r
  left join public.profiles p on p.user_id = r.driver_id
  where r.id = v_ride_id;
end $$;

-- ---------------------------------------------------------------------
-- RPC: motorista cancela a carona (invalida reservas, retorna afetados)
-- ---------------------------------------------------------------------
create or replace function public.cancel_ride(p_ride_id uuid)
returns table (
  reservation_id     uuid,
  passenger_id       uuid,
  passenger_name     text,
  passenger_phone    text,
  pickup_point_name  text,
  departure_at       timestamptz
)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := public.assert_ready_user();
  v_ride public.rides%rowtype;
begin
  select * into v_ride from public.rides r where r.id = p_ride_id for update;
  if not found or v_ride.driver_id <> v_uid then
    raise exception 'RIDE_NOT_FOUND';
  end if;
  if v_ride.status not in ('OPEN', 'FULL') or v_ride.departure_at <= now() then
    raise exception 'RIDE_NOT_ACTIVE';
  end if;

  update public.rides r
     set status = 'CANCELLED', cancelled_at = now()
   where r.id = p_ride_id;

  return query
  with affected as (
    update public.reservations x
       set status = 'CANCELLED_BY_DRIVER', cancelled_at = now()
     where x.ride_id = p_ride_id and x.status = 'ACTIVE'
    returning x.id, x.passenger_id, x.pickup_point_id
  )
  select a.id, a.passenger_id, p.name, p.phone, pp.name, v_ride.departure_at
  from affected a
  left join public.profiles p on p.user_id = a.passenger_id
  left join public.pickup_points pp on pp.id = a.pickup_point_id;
end $$;

-- ---------------------------------------------------------------------
-- RPC: minhas reservas (passageiro)
-- ---------------------------------------------------------------------
create or replace function public.get_my_reservations()
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
  plate_masked       text
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
         v.model, v.color, public.mask_plate(v.plate)
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
-- RPC: minhas caronas (motorista), com passageiros
-- ---------------------------------------------------------------------
create or replace function public.get_my_rides()
returns table (
  ride_id          uuid,
  status           text,
  departure_at     timestamptz,
  price            numeric,
  total_seats      int,
  available_seats  int,
  cancelled_at     timestamptz,
  points           jsonb,
  passengers       jsonb
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
                    'pickup_point', pp.name)
                  order by x.created_at)
           from public.reservations x
           left join public.profiles p on p.user_id = x.passenger_id
           left join public.pickup_points pp on pp.id = x.pickup_point_id
           where x.ride_id = r.id
             and x.status in ('ACTIVE', 'CANCELLED_BY_DRIVER', 'COMPLETED')
         ), '[]'::jsonb)
  from public.rides r
  where r.driver_id = v_uid
  order by (r.status in ('OPEN', 'FULL')) desc, r.departure_at desc
  limit 100;
end $$;

-- ---------------------------------------------------------------------
-- Permissões: funções só para usuários autenticados
-- ---------------------------------------------------------------------
revoke execute on function public.assert_ready_user()                      from public, anon;
revoke execute on function public.ride_points_json(uuid)                   from public, anon;
revoke execute on function public.is_ride_passenger(uuid)                  from public, anon;
revoke execute on function public.is_ride_driver(uuid)                     from public, anon;
revoke execute on function public.create_ride(uuid, uuid, timestamptz, int, numeric, uuid[]) from public, anon;
revoke execute on function public.list_available_rides(uuid)               from public, anon;
revoke execute on function public.get_ride_summary(uuid)                   from public, anon;
revoke execute on function public.reserve_seat(uuid, uuid)                 from public, anon;
revoke execute on function public.cancel_reservation(uuid)                 from public, anon;
revoke execute on function public.cancel_ride(uuid)                        from public, anon;
revoke execute on function public.get_my_reservations()                    from public, anon;
revoke execute on function public.get_my_rides()                           from public, anon;

grant execute on function public.is_ride_passenger(uuid)                  to authenticated;
grant execute on function public.is_ride_driver(uuid)                     to authenticated;
grant execute on function public.create_ride(uuid, uuid, timestamptz, int, numeric, uuid[]) to authenticated;
grant execute on function public.list_available_rides(uuid)               to authenticated;
grant execute on function public.get_ride_summary(uuid)                   to authenticated;
grant execute on function public.reserve_seat(uuid, uuid)                 to authenticated;
grant execute on function public.cancel_reservation(uuid)                 to authenticated;
grant execute on function public.cancel_ride(uuid)                        to authenticated;
grant execute on function public.get_my_reservations()                    to authenticated;
grant execute on function public.get_my_rides()                           to authenticated;
