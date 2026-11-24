-- =====================================================================
-- Correções da auditoria de 25/09/2026 (notificações):
--  * no máximo 5 celulares por conta (os mais antigos saem);
--  * só os endereços exatos dos serviços de push dos navegadores;
--  * aviso de chegada não se repete ao cancelar e reservar de novo a mesma carona;
--  * tabela de celulares explicitamente fechada para anon/authenticated.
-- =====================================================================

revoke all on public.push_subscriptions from anon, authenticated;

alter table public.push_subscriptions drop constraint push_subscriptions_endpoint_check;
delete from public.push_subscriptions
 where endpoint !~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|([a-z0-9-]+\.)+notify\.windows\.com)(:[0-9]+)?/';
alter table public.push_subscriptions add constraint push_subscriptions_endpoint_host check (
  char_length(endpoint) <= 1000
  and endpoint ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|([a-z0-9-]+\.)+notify\.windows\.com)(:[0-9]+)?/'
);

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
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
  -- No máximo 5 celulares por conta: os usados há mais tempo saem.
  delete from public.push_subscriptions s
   where s.user_id = v_uid
     and s.id not in (select k.id from public.push_subscriptions k
                      where k.user_id = v_uid
                      order by k.last_seen_at desc, k.created_at desc
                      limit 5);
end $$;

create or replace function public.mark_arrived(p_reservation_id uuid)
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
    -- Só avisa se o passageiro ainda não tinha avisado nesta carona (cancelar e reservar de novo não repete).
    v_new := not exists (select 1 from public.reservations x
                         where x.ride_id = v_res.ride_id and x.passenger_id = v_uid
                           and x.id <> v_res.id and x.arrived_at is not null);
  end if;

  return query
  select v_new, v_res.arrived_at, v_ride.id, v_ride.direction, v_ride.departure_at, pp.name,
         public.first_name(me.name), v_ride.driver_id, public.first_name(dp.name), dp.phone
  from (select 1) as one
  left join public.pickup_points pp on pp.id = v_res.pickup_point_id
  left join public.profiles me on me.user_id = v_uid
  left join public.profiles dp on dp.user_id = v_ride.driver_id;
end $$;
