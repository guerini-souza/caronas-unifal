-- Dados iniciais. Endereço, coordenadas, foto e descrição ainda não foram
-- fornecidos: ficam NULL com data_status = 'pending_data' (nunca inventar).

insert into public.neighborhoods (name)
values ('Country Clube')
on conflict (name) do nothing;

insert into public.pickup_points (neighborhood_id, name, display_order, data_status)
select n.id, p.name, p.ord, 'pending_data'
from public.neighborhoods n
cross join (values
  ('Esquinão', 1),
  ('Rodelão', 2),
  ('VN', 3),
  ('Shopping', 4),
  ('Jomps', 5),
  ('Véu das Noivas', 6)
) as p(name, ord)
where n.name = 'Country Clube'
on conflict (neighborhood_id, name) do nothing;
