---
tags: testes, cobertura, qualidade
data: 2026-09-23
---

# Testes

**Data da última execução:** 23/09/2026 · **Commit base:** `acb8f2e`

Legenda: **PASS** = passou · **PARTIAL** = testado em parte · **NOT_TESTED** = não executado

## Resumo executivo

| Tipo | Ferramenta | Resultado |
|---|---|---|
| Unitários | Vitest | **PASS — 50/50** |
| Integração com o banco real | `npm run test:concurrency` | **PASS — 32/32** |
| Tipagem | TypeScript | **PASS** |
| Lint | ESLint | **PASS** |
| Build produção | `npm run build` | **PASS** |
| Smoke test em produção | curl nas rotas | **PASS** |
| Teste manual no celular | Uso real | **PARTIAL** |
| E2E automatizado (Playwright) | — | **NOT_TESTED** |
| Teste de carga (k6/Artillery) | — | **NOT_TESTED** |

## Testes unitários (50/50)

**Arquivos:** `tests/unit/format.test.ts`, `whatsapp.test.ts`, `safe-next.test.ts`

Cobertura:
- Validação de telefone brasileiro (celular, fixo, com/sem DDI)
- Normalização e máscara de placa (padrão antigo e Mercosul)
- Conversão de preço (formatos variados, rejeição de inválidos)
- Data/hora no fuso de São Paulo e períodos (manhã/tarde/noite)
- Link `wa.me` seguro (sem injeção de parâmetros)
- Mensagens de reserva e cancelamento com horário
- Proteção contra open redirect

## Testes de integração (32/32)

**Comando:** `npm run test:concurrency`

Cria 11 usuários confirmados (1 motorista + 10 passageiros), executa e apaga tudo ao fim.

**Seed:** 6 pontos do Country Clube (Esquinão, Rodelão, VN, Shopping, Jomps, Véu das Noivas)

Cobertura:
- RLS: não cria perfil de outro usuário; usuário só lê o próprio perfil
- `create_ride` exige veículo próprio; rejeita horário passado; cria carona OPEN
- RLS: placa de outro usuário não é legível; não edita veículo alheio
- RLS: não insere carona direto (só via RPC)
- Lista carona que passa pelo ponto; placa mascarada (ABC-***3); só 1º nome
- Motorista não reserva a própria carona; rejeita ponto fora da rota
- **Concorrência:** 10 pedidos simultâneos pela última vaga → 1 sucesso (9 RIDE_FULL)
- Vaga reduzida para 0 e status FULL; carona lotada some da busca
- Sem overbooking no banco (1 reserva ativa máximo)
- Não reserva duas vezes; não cancela reserva alheia
- Motorista vê reservas da própria carona
- Passageiro cancela a própria reserva; vaga devolvida; status OPEN
- Reserva fica `CANCELLED_BY_PASSENGER` com data
- Não cancela duas vezes (sem devolver vaga em dobro)
- Nova reserva após devolução funciona
- Passageiro não cancela carona alheia
- Motorista cancela carona e recebe afetados
- Reserva invalidada (`CANCELLED_BY_DRIVER`); carona fica CANCELLED
- Passageiro vê reserva cancelada pelo motorista

## Smoke test em produção

`https://app-caronas-seven.vercel.app`

**Rotas OK (200):** `/`, `/entrar`, `/cadastro`, `/esqueci-senha`, `/pontos`, `/manifest.webmanifest`, `/sw.js`, `/brand/icon-512.png`

**Proteção de rota OK (307 para `/entrar`):** `/inicio`, `/pegar`, `/reservas` sem login

**Teste funcional:** `/pontos` lista o bairro vindo do banco; resposta servida de `gru1`

## Teste manual no celular

| Item | Status | Observação |
|---|---|---|
| Abrir app / instalar PWA | PASS | Aviso "Adicionar à tela inicial" confirmado |
| Cadastro + confirmação e-mail | PASS | Funciona para e-mail da equipe |
| Login / perfil | PASS | — |
| Cadastro de veículo | PASS | — |
| Oferecer carona (wizard completo) | PASS | Carona gravada com 3 pontos em ordem |
| Cancelar carona (motorista) | PASS | Carona ficou CANCELLED no banco |
| Buscar a própria carona | PASS | Após correção: "Sua carona" marcada |
| Reservar / WhatsApp / cancelar com 2 usuários | NOT_TESTED | Falta 2º usuário real (depende de SMTP) |
| Esqueci minha senha | NOT_TESTED | Implementado; não exercitado manualmente |
| Responsividade (360/390/430px, tablet, desktop) | PARTIAL | Testado em 1 celular real; demais larguras não verificadas |

## Problemas encontrados e corrigidos

| Problema | Correção |
|---|---|
| Open redirect via `?next=/%09/evil.com` | `safeNext` compartilhado rejeita controle/`\`/origem externa |
| `cancel_ride` expunha e-mail de passageiros | E-mail buscado só no servidor (service role) |
| Recursão entre RLS de `rides` e `reservations` | Funções auxiliares `SECURITY DEFINER` |
| Motorista não achava a própria carona | Busca inclui `is_mine` com aviso "Sua carona" |
| Lentidão ao navegar | Funções em `gru1` + `getClaims()` local |

---

**Veja também:** [[03 - Requisitos]], [[08 - Resultados]], [[09 - Pendências]]
