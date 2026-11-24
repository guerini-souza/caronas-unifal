-- =====================================================================
-- Sentido da carona: IDA (bairro → UNIFAL) ou VOLTA (UNIFAL → bairro).
-- Na IDA os pontos da rota são onde o passageiro ESPERA;
-- na VOLTA são onde o passageiro DESCE. A busca sempre filtra pelo sentido.
-- =====================================================================

alter table public.rides
  add column direction text not null default 'TO_CAMPUS'
  check (direction in ('TO_CAMPUS', 'FROM_CAMPUS'));

create index rides_open_direction_departure on public.rides (direction, departure_at)
  where status in ('OPEN', 'FULL');

-- Funções cuja assinatura/retorno muda precisam ser recriadas.
drop function if exists public.create_ride(uuid, uuid, timestamptz, int, numeric, uuid[]);
drop function if exists public.list_available_rides(uuid);
drop function if exists public.get_ride_summary(uuid);
drop function if exists public.reserve_seat(uuid, uuid);
drop function if exists public.get_my_reservations();
drop function if exists public.get_my_rides();

-- ---------------------------------------------------------------------
-- create_ride: agora com o sentido
-- ---------------------------------------------------------------------
create function public.create_ride(
  p_vehicle_id        uuid,
  p_neighborhood_id   uuid,
  p_departure_at      timestamptz,
  p_total_seats       int,
  p_price             numeric,
  p_pickup_point_ids  uuid[],
  p_direction         text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := public.assert_ready_user();
  v_ride_id uuid;
  v_count   int;
begin
  if p_direction is null or p_direction not in ('TO_CAMPUS', 'FROM_CAMPUS') then
    raise exception 'INVALID_DIRECTION';
  end if;
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
                            total_seats, available_seats, price, status, direction)
  values (v_uid, p_vehicle_id, p_neighborhood_id, p_departure_at,
          p_total_seats, p_total_seats, round(p_price, 2), 'OPEN', p_direction)
  returning id into v_ride_id;

  insert into public.ride_pickup_points (ride_id, pickup_point_id, route_order)
  select v_ride_id, t.pid, t.ord::int
  from unnest(p_pickup_point_ids) with ordinality as t(pid, ord);

  return v_ride_id;
end $$;

-- ---------------------------------------------------------------------
-- list_available_rides: filtra pelo sentido
-- ---------------------------------------------------------------------
create function public.list_available_rides(p_pickup_point_id uuid, p_direction text)
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
  already_reserved   boolean,
  is_mine            boolean,
  direction          text
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
                 where x.ride_id = r.id and x.passenger_id = v_uid and x.status = 'ACTIVE'),
         r.driver_id = v_uid,
         r.direction
  from public.rides r
  join public.ride_pickup_points rpp on rpp.ride_id = r.id and rpp.pickup_point_id = p_pickup_point_id
  join public.vehicles v on v.id = r.vehicle_id
  left join public.profiles p on p.user_id = r.driver_id
  where r.status = 'OPEN'
    and r.available_seats > 0
    and r.departure_at > now()
    and r.direction = p_direction
  order by r.departure_at
  limit 200;
end $$;

-- ---------------------------------------------------------------------
-- get_ride_summary: + sentido
-- ---------------------------------------------------------------------
create function public.get_ride_summary(p_ride_id uuid)
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
  already_reserved   boolean,
  direction          text
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
                 where x.ride_id = r.id and x.passenger_id = v_uid and x.status = 'ACTIVE'),
         r.direction
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
-- reserve_seat: mesma lógica transacional, + sentido no retorno
-- ---------------------------------------------------------------------
create function public.reserve_seat(p_ride_id uuid, p_pickup_point_id uuid)
returns table (
  reservation_id      uuid,
  departure_at        timestamptz,
  pickup_point_name   text,
  driver_first_name   text,
  driver_phone        text,
  available_seats     int,
  direction           text
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
         v_ride.available_seats - 1, v_ride.direction
  from (select 1) as one
  left join public.profiles p on p.user_id = v_ride.driver_id;
end $$;

-- ---------------------------------------------------------------------
-- get_my_reservations: + sentido
-- ---------------------------------------------------------------------
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
  direction          text
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
         r.direction
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
-- get_my_rides: + sentido
-- ---------------------------------------------------------------------
create function public.get_my_rides()
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
  direction        text
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
         ), '[]'::jsonb),
         r.direction
  from public.rides r
  where r.driver_id = v_uid
  order by (r.status in ('OPEN', 'FULL')) desc, r.departure_at desc
  limit 100;
end $$;

-- ---------------------------------------------------------------------
-- Permissões (as funções foram recriadas)
-- ---------------------------------------------------------------------
revoke execute on function public.create_ride(uuid, uuid, timestamptz, int, numeric, uuid[], text) from public, anon;
revoke execute on function public.list_available_rides(uuid, text) from public, anon;
revoke execute on function public.get_ride_summary(uuid)            from public, anon;
revoke execute on function public.reserve_seat(uuid, uuid)          from public, anon;
revoke execute on function public.get_my_reservations()             from public, anon;
revoke execute on function public.get_my_rides()                    from public, anon;

grant execute on function public.create_ride(uuid, uuid, timestamptz, int, numeric, uuid[], text) to authenticated;
grant execute on function public.list_available_rides(uuid, text) to authenticated;
grant execute on function public.get_ride_summary(uuid)            to authenticated;
grant execute on function public.reserve_seat(uuid, uuid)          to authenticated;
grant execute on function public.get_my_reservations()             to authenticated;
grant execute on function public.get_my_rides()                    to authenticated;
