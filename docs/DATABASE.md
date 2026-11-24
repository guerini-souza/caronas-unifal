# Banco de dados

PostgreSQL no Supabase (projeto `mpevswxqlphvakyqbtoa`, região sa-east-1).
Migrations: `20260922000001_init.sql`, `20260923000002_list_rides_include_mine.sql`, `20260923000003_ride_direction.sql`,
`20260924000004_admin_panel.sql`, `20260925000005_trips_push.sql`, `20260925000006_push_hardening.sql`.

## Modelo

```mermaid
erDiagram
  AUTH_USERS ||--o| PROFILES : "tem"
  AUTH_USERS ||--o{ VEHICLES : "possui"
  AUTH_USERS ||--o{ RIDES : "dirige"
  AUTH_USERS ||--o{ RESERVATIONS : "reserva"
  NEIGHBORHOODS ||--o{ PICKUP_POINTS : "contém"
  NEIGHBORHOODS ||--o{ RIDES : "origem"
  VEHICLES ||--o{ RIDES : "usado em"
  RIDES ||--o{ RIDE_PICKUP_POINTS : "passa por"
  PICKUP_POINTS ||--o{ RIDE_PICKUP_POINTS : ""
  RIDES ||--o{ RESERVATIONS : ""
  PICKUP_POINTS ||--o{ RESERVATIONS : "espera em"
  AUTH_USERS ||--o{ PUSH_SUBSCRIPTIONS : "celulares"

  PROFILES { uuid user_id UK; text name; text phone; text email; uuid neighborhood_id }
  VEHICLES { uuid user_id; text model; text color; text plate; bool active }
  NEIGHBORHOODS { text name UK; bool active }
  PICKUP_POINTS { uuid neighborhood_id; text name; text address; numeric latitude; numeric longitude; text image_url; text description; text data_status }
  RIDES { uuid driver_id; uuid vehicle_id; text direction; timestamptz departure_at; int total_seats; int available_seats; numeric price; text status; timestamptz cancelled_at; timestamptz started_at; timestamptz reminder_sent_at }
  RIDE_PICKUP_POINTS { uuid ride_id; uuid pickup_point_id; int route_order }
  RESERVATIONS { uuid ride_id; uuid passenger_id; uuid pickup_point_id; text status; timestamptz cancelled_at; timestamptz arrived_at }
  PUSH_SUBSCRIPTIONS { uuid user_id; text endpoint UK; text p256dh; text auth; text user_agent }
  NOTIFICATION_LOGS { uuid user_id; uuid created_by; text type; text channel; jsonb payload; text status }
```

Tabelas seguem a estrutura sugerida no requisito; adaptações:

| Adaptação | Motivo |
|---|---|
| `profiles.email` (copiado de `auth.users` por trigger) | Enviar aviso de cancelamento; nunca vem do cliente. |
| `pickup_points.display_order` | Ordem de exibição dos pontos. |
| `rides.updated_at` | Auditoria. |
| `notification_logs.created_by` | Saber quem disparou o aviso. |

## Sentido

`rides.direction`: `TO_CAMPUS` (ida: bairro → UNIFAL; pontos = onde o passageiro espera) ou
`FROM_CAMPUS` (volta: UNIFAL → bairro; pontos = onde o passageiro desce). `list_available_rides(ponto, sentido)`
só retorna caronas do sentido pedido.

## Status

- Carona: `OPEN`, `FULL`, `CANCELLED`, `COMPLETED`
- Reserva: `ACTIVE`, `CANCELLED_BY_PASSENGER`, `CANCELLED_BY_DRIVER`, `COMPLETED`

`COMPLETED` existe no modelo, mas ainda não há rotina que encerre caronas vencidas (a interface
mostra "Já saiu" pelo horário).

## Restrições importantes

- Telefone `^55[0-9]{10,11}$` (normalizado no servidor), placa `^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$`.
- `rides.available_seats between 0 and total_seats`, `total_seats between 1 and 8`, preço 0–1000.
- Um veículo ativo por usuário; uma reserva ativa por passageiro por carona (índices únicos parciais).

## Segurança (RLS)

| Tabela | Leitura | Escrita |
|---|---|---|
| `neighborhoods`, `pickup_points` | pública (ativos); admin vê todos | só admin (`is_admin()`), sem DELETE; colunas liberadas por `grant` |
| `app_admins` | ninguém pela API | só SQL/service role |
| Storage `pontos` (fotos) | pública (URL) | só admin envia/apaga |
| `profiles`, `vehicles` | só o dono | só o dono (`user_id` imutável) |
| `rides` | abertas/lotadas, as próprias e as reservadas | **somente via RPC** |
| `ride_pickup_points` | se a carona for visível | somente via RPC |
| `reservations` | passageiro dono ou motorista da carona | **somente via RPC** |
| `notification_logs` | quem criou | somente servidor (service role) |

Privilégios de tabela são concedidos explicitamente (`grant`), pois o projeto não expõe tabelas novas automaticamente.

## Painel admin

- `app_admins(email)`: e-mails com acesso ao painel. Inicial: `caronasunifal@gmail.com`.
- `is_admin()`: verdadeiro se o usuário logado tem e-mail **confirmado** em `auth.users` listado em `app_admins`
  (não confia no token). Usada nas políticas como `(select public.is_admin())`.
- Ponto não muda de bairro (sem `grant update` em `neighborhood_id`); não há DELETE — ocultar (`active = false`)
  preserva caronas e reservas que usam o ponto.
- Trigger `pickup_points_data_status`: `complete` quando há endereço **e** foto; senão `pending_data`.
- `image_url` só aceita `https://`. Fotos no bucket público `pontos` (até 1 MB, JPEG/PNG/WebP), nome aleatório;
  a foto antiga é apagada ao trocar.

## Link, rota, chegada e lembrete (migration 5)

- `rides.started_at` (INICIEI A ROTA), `rides.reminder_sent_at` (lembrete enviado), `reservations.arrived_at` (ESTOU NO LOCAL).
- `push_subscriptions`: um registro por navegador/celular, **no máximo 5 por conta** (os usados há mais tempo saem);
  RLS ligado e `revoke all` para anon/authenticated (só funções `SECURITY DEFINER` e service role). Endpoint só
  `https` dos serviços exatos: `fcm.googleapis.com`, `android.googleapis.com`, `updates.push.services.mozilla.com`,
  `web.push.apple.com` e `*.notify.windows.com` (migration 6).
- `mark_arrived` não avisa de novo se o passageiro já tinha avisado nessa carona com outra reserva (cancelou e reservou de novo).
- Janela dos botões: **30 min antes até 60 min depois** do horário (`ROUTE_WINDOW` / `ARRIVAL_WINDOW`).
- Lembrete: `pg_cron` roda `dispatch_departure_reminders()` a cada minuto; se houver carona devida
  (`reminder_due`: aberta/lotada, não iniciada, sem lembrete, saída em até 10 min, criada ≥10 min antes),
  chama `app_url/api/lembretes` via `pg_net` com `x-cron-secret`. A rota chama `claim_departure_reminders()`,
  que marca e devolve as caronas numa única instrução (`FOR UPDATE SKIP LOCKED`): nunca duplica.
- Segredos no **Vault**: `app_url`, `cron_secret`, `vapid_public_key`, `vapid_private_key` (`npm run setup:push`).
- Job diário `limpar-historico-cron` apaga o histórico do cron com mais de 7 dias.

| Função | Quem chama | O que faz |
|---|---|---|
| `save_push_subscription` / `delete_push_subscription` | aluno logado | Liga/desliga o celular da conta (o aparelho fica com quem entrou por último) |
| `get_ride_preview(carona)` | qualquer um (anon) | Prévia do link: sentido, saída, preço, vagas, status, bairro, pontos — sem nome, placa ou telefone |
| `start_ride(carona)` | motorista dono | Marca `started_at` uma vez; devolve os passageiros ativos para o aviso |
| `mark_arrived(reserva)` | passageiro dono | Marca `arrived_at` uma vez; devolve o motorista para o aviso |
| `claim_departure_reminders(p_only)` | só service role | Marca e devolve as caronas devidas (`p_only` restringe, usado nos testes) |
| `get_push_config()` | só service role | Lê chaves VAPID e `cron_secret` do Vault |
| `dispatch_departure_reminders()` | só pg_cron | Chama a Vercel apenas quando há lembrete a enviar |

`get_my_rides(p_ride_id)` passou a aceitar uma carona específica e devolve `started_at` e `arrived_at` dos passageiros;
`get_my_reservations()` devolve `started_at` e `arrived_at`.

## Funções (RPC)

| Função | O que faz |
|---|---|
| `create_ride` | Valida veículo do usuário, bairro, horário futuro (até 60 dias), vagas 1–8, preço, pontos do bairro sem repetição; cria carona `OPEN` + pontos em ordem. |
| `list_available_rides(ponto)` | Caronas `OPEN`, com vaga, futuras, que passam pelo ponto; placa mascarada e 1º nome; marca `is_mine`/`already_reserved`. |
| `get_ride_summary(carona)` | Resumo para a tela de confirmação. |
| `reserve_seat(carona, ponto)` | `FOR UPDATE` na carona; bloqueia própria carona, lotada, já saiu, ponto fora da rota e duplicidade; vagas −1 e `FULL` em 0. |
| `cancel_reservation(reserva)` | Só o dono, só `ACTIVE`, antes da saída; devolve a vaga (sem passar do total) e volta a `OPEN`. |
| `cancel_ride(carona)` | Só o motorista, antes da saída; `CANCELLED` e reservas `CANCELLED_BY_DRIVER`; devolve afetados (nome, telefone, ponto). |
| `get_my_reservations` / `get_my_rides` | Listas do passageiro / motorista. Telefone do motorista só em reserva ativa. |

Todas exigem usuário autenticado, com e-mail confirmado e perfil (`assert_ready_user`).
