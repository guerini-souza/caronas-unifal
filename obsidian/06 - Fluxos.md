---
tags: fluxos, sequência, ações, wizards
data: 2026-09-23
---

# Fluxos

## Fluxo principal: Motorista → Carona → Pontos → Reserva → Passageiro

```mermaid
sequenceDiagram
  actor M as Motorista
  actor P as Passageiro
  participant App as App (Next.js)
  participant DB as Supabase (RPC)
  participant W as WhatsApp

  M->>App: OFERECER CARONA (veículo, bairro, data/hora, vagas, pontos, preço)
  App->>DB: create_ride(...) — valida dono do veículo, pontos do bairro, horário futuro
  DB-->>App: carona OPEN
  P->>App: PEGAR CARONA → bairro → ponto → dia/horário
  App->>DB: list_available_rides(ponto)
  DB-->>App: caronas (placa mascarada, 1º nome)
  P->>App: CONFIRMAR CARONA
  App->>DB: reserve_seat(carona, ponto) — FOR UPDATE, vagas-1, FULL se 0
  DB-->>App: reserva ACTIVE + telefone do motorista
  App->>W: wa.me/55DDD...?text=Olá, bom dia! ... ponto X
  P->>App: CANCELAR CARONA
  App->>DB: cancel_reservation — vaga +1, CANCELLED_BY_PASSENGER
  M->>App: cancelar carona
  App->>DB: cancel_ride — CANCELLED, reservas CANCELLED_BY_DRIVER, lista afetados
  App->>W: link de aviso para cada passageiro
```

## Wizard: Oferecer carona

1. **Veículo** — seleciona da lista (ou cadastra novo)
2. **Bairro** — lista de bairros ativos (hoje: Country Clube)
3. **Data/Hora** — seletor; valida horário futuro até 60 dias
4. **Vagas** — spinner de 1 a 8
5. **Pontos** — seleciona pontos do bairro em ordem; não pode repetir
6. **Preço** — valor em reais (0–1000)
7. **Resumo** — revisa tudo e confirma (grava na RPC `create_ride`)

## Wizard: Pegar carona

1. **Bairro** — seleciona bairro de destino
2. **Ponto de espera** — lista de pontos do bairro
3. **Dia/Horário** — seletor
4. **Resultados** — "Perto do seu horário" (±1 hora) e "Outros horários neste dia"
   - Card: 1º nome motorista, veículo, cor, preço, vagas, placa mascarada (ABC-***3)
   - Própria carona marcada como "Sua carona" (não reserva a si mesmo)
5. **Confirmação** — resume a carona e abre WhatsApp com mensagem automática por período (bom dia/boa tarde/boa noite)

## Mensagens automáticas

Saudação conforme o horário (bom dia até 12h, boa tarde até 18h, boa noite depois):

- **Reserva (ida):** "Olá, {bom dia}! Acabei de reservar uma carona de ida para a UNIFAL com você. Irei esperar no ponto {ponto}."
- **Reserva (volta):** "Olá, {bom dia}! Acabei de reservar uma carona de volta com você. Onde posso te encontrar? Irei descer no ponto {ponto}."
- **Rota iniciada (WhatsApp de reserva):** "Olá, {bom dia}! Iniciei a rota da carona. Chego no ponto {ponto} por volta das {hora}."
- **Chegada (WhatsApp de reserva):** "Olá! Já estou no ponto {ponto}."

## Link da carona, rota e chegada

```mermaid
flowchart TD
  A[Motorista publica carona] --> B[COMPARTILHAR NO WHATSAPP]
  B --> C[Colega abre /carona/id]
  C -->|sem login| D[Prévia + ENTRAR / CRIAR CONTA]
  D --> E[Login ou cadastro + confirmação + primeiro acesso]
  C -->|logado| F[Escolhe o ponto e reserva]
  E --> F
  F --> G[ATIVAR NOTIFICAÇÕES]
  H[pg_cron: carona sai em 10 min] --> I[Notificação ao motorista]
  I --> J[INICIEI A ROTA]
  J --> K[Passageiros avisados no celular ou WhatsApp]
  K --> L[ESTOU NO LOCAL]
  L --> M[Motorista avisado: no local ✓]
```

- Botões liberados de **30 min antes até 1 h depois** do horário; cada aviso é enviado **uma vez só**.
- Quem não tem notificações (ex.: iPhone sem o app instalado) recebe pelo WhatsApp, com a mensagem pronta.

## Cancelamentos

**Passageiro cancela:**
- Só se reserva está `ACTIVE`
- Devolve a vaga (status volta a `OPEN` se for a última)
- Motivo: `CANCELLED_BY_PASSENGER`

**Motorista cancela:**
- Só se carona ainda não saiu
- Todas as reservas viram `CANCELLED_BY_DRIVER`
- Avisa passageiros por WhatsApp e e-mail (se configurado)

---

**Veja também:** [[04 - Arquitetura]], [[05 - Banco de Dados]], [[07 - Testes]]
