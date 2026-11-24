-- =====================================================================
-- Painel de administração: a conta oficial cadastra bairros, pontos e fotos.
-- =====================================================================

-- Admins por e-mail: a conta pode ser criada depois. O e-mail é conferido em
-- auth.users (e precisa estar confirmado), não no token.
create table public.app_admins (
  email       text primary key check (email = lower(email)),
  created_at  timestamptz not null default now()
);
alter table public.app_admins enable row level security;
-- Sem políticas e sem grants para anon/authenticated: só o banco e o service role leem.
grant all on public.app_admins to service_role;

insert into public.app_admins (email) values ('caronasunifal@gmail.com')
on conflict (email) do nothing;

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from auth.users u
    join public.app_admins a on a.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- Bairros e pontos: admin vê todos (inclusive desativados), cria e edita.
-- Não há DELETE: desativar preserva caronas e reservas que usam o ponto.
-- ---------------------------------------------------------------------
create policy neighborhoods_admin_select on public.neighborhoods
  for select to authenticated using ((select public.is_admin()));
create policy neighborhoods_admin_insert on public.neighborhoods
  for insert to authenticated with check ((select public.is_admin()));
create policy neighborhoods_admin_update on public.neighborhoods
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy pickup_points_admin_select on public.pickup_points
  for select to authenticated using ((select public.is_admin()));
create policy pickup_points_admin_insert on public.pickup_points
  for insert to authenticated with check ((select public.is_admin()));
create policy pickup_points_admin_update on public.pickup_points
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Colunas editáveis (o ponto não muda de bairro; data_status é calculado).
grant insert (name, active) on public.neighborhoods to authenticated;
grant update (name, active) on public.neighborhoods to authenticated;
grant insert (neighborhood_id, name, address, latitude, longitude, image_url, description, display_order, active)
  on public.pickup_points to authenticated;
grant update (name, address, latitude, longitude, image_url, description, display_order, active)
  on public.pickup_points to authenticated;

alter table public.pickup_points
  add constraint pickup_points_image_https check (image_url is null or image_url ~ '^https://');

-- Ponto "completo" quando tem endereço e foto; senão o app mostra
-- "Informação aguardando cadastro".
create function public.pickup_points_set_data_status()
returns trigger
language plpgsql set search_path = '' as $$
begin
  new.data_status := case
    when nullif(btrim(new.address), '') is not null and new.image_url is not null then 'complete'
    else 'pending_data'
  end;
  return new;
end $$;

create trigger pickup_points_data_status
  before insert or update on public.pickup_points
  for each row execute function public.pickup_points_set_data_status();

-- ---------------------------------------------------------------------
-- Fotos dos pontos: bucket público (qualquer um vê), só admin envia/apaga.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pontos', 'pontos', true, 1048576, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy pontos_admin_select on storage.objects
  for select to authenticated using (bucket_id = 'pontos' and (select public.is_admin()));
create policy pontos_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'pontos' and (select public.is_admin()));
create policy pontos_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'pontos' and (select public.is_admin()));
