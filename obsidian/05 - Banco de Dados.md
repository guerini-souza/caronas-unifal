---
tags: banco, postgres, supabase, segurança
data: 2026-09-23
---

# Banco de Dados

## Ambiente

- **Servidor:** Supabase (projeto `mpevswxqlphvakyqbtoa`)
- **Região:** sa-east-1 (São Paulo)
- **BD:** PostgreSQL com RLS ativado
- **Migrations:** `20260922000001_init.sql`, `20260923000002_list_rides_include_mine.sql`

## Modelo (ER)

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

  PROFILES { uuid user_id UK; text name; text phone; text email; uuid neighborhood_id }
  VEHICLES { uuid user_id; text model; text color; text plate; bool active }
  NEIGHBORHOODS { text name UK; bool active }
  PICKUP_POINTS { uuid neighborhood_id; text name; text address; numeric latitude; numeric longitude; text image_url; text description; text data_status }
  RIDES { uuid driver_id; uuid vehicle_id; timestamptz departure_at; int total_seats; int available_seats; numeric price; text status; timestamptz cancelled_at }
  RIDE_PICKUP_POINTS { uuid ride_id; uuid pickup_point_id; int route_order }
  RESERVATIONS { uuid ride_id; uuid passenger_id; uuid pickup_point_id; text status; timestamptz cancelled_at }
  NOTIFICATION_LOGS { uuid user_id; uuid created_by; text type; text channel; jsonb payload; text status }
```

## Status

**Carona:** `OPEN`, `FULL`, `CANCELLED`, `COMPLETED`  
**Reserva:** `ACTIVE`, `CANCELLED_BY_PASSENGER`, `CANCELLED_BY_DRIVER`, `COMPLETED`

`COMPLETED` existe no modelo, mas ainda não há rotina que encerre caronas vencidas.

## Restrições importantes

- Telefone: `^55[0-9]{10,11}$` (normalizado no servidor)
- Placa: `^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$`
- Vagas: entre 1 e 8
- Preço: 0–1000
- Um veículo ativo por usuário
- Uma reserva ativa por passageiro por carona (índice único parcial)

## Segurança (RLS)

| Tabela | Leitura | Escrita |
|---|---|---|
| `neighborhoods`, `pickup_points` | pública (ativos) | só painel/admin |
| `profiles`, `vehicles` | só o dono | só o dono (`user_id` imutável) |
| `rides` | abertas/lotadas, as próprias e as reservadas | **somente via RPC** |
| `ride_pickup_points` | se a carona for visível | **somente via RPC** |
| `reservations` | passageiro ou motorista da carona | **somente via RPC** |
| `notification_logs` | quem criou | só servidor (service role) |

Privilégios de tabela concedidos explicitamente (`grant`); tabelas novas **não expostas automaticamente**.

## Funções (RPC)

| Função | O que faz |
|---|---|
| `create_ride` | Valida veículo, bairro, horário futuro, vagas, preço, pontos |
| `list_available_rides(ponto)` | Caronas OPEN com vaga, futuras, que passam pelo ponto; placa mascarada, 1º nome |
| `reserve_seat(carona, ponto)` | `FOR UPDATE` no banco; bloqueia própria carona, lotada, já saiu, ponto fora da rota |
| `cancel_reservation(reserva)` | Só o dono, só ACTIVE, antes da saída; devolve a vaga |
| `cancel_ride(carona)` | Só o motorista, antes da saída; retorna afetados (nome, telefone, ponto) |
| `get_my_reservations` / `get_my_rides` | Listas do passageiro/motorista |

Todas exigem usuário autenticado, e-mail confirmado e perfil completo.

---

**Veja também:** [[04 - Arquitetura]], [[06 - Fluxos]]
