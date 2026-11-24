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
