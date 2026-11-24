-- A busca passa a incluir as caronas do próprio motorista (marcadas com is_mine),
-- para ele conferir como a carona aparece. A reserva da própria carona continua
-- bloqueada em reserve_seat (OWN_RIDE).

drop function if exists public.list_available_rides(uuid);

create function public.list_available_rides(p_pickup_point_id uuid)
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
  is_mine            boolean
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
         r.driver_id = v_uid
  from public.rides r
  join public.ride_pickup_points rpp on rpp.ride_id = r.id and rpp.pickup_point_id = p_pickup_point_id
  join public.vehicles v on v.id = r.vehicle_id
  left join public.profiles p on p.user_id = r.driver_id
  where r.status = 'OPEN'
    and r.available_seats > 0
    and r.departure_at > now()
  order by r.departure_at
  limit 200;
end $$;

revoke execute on function public.list_available_rides(uuid) from public, anon;
grant execute on function public.list_available_rides(uuid) to authenticated;
