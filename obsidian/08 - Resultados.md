---
tags: resultados, produção, validação
data: 2026-09-23
---

# Resultados

## Status geral

**MVP no ar desde:** 23/09/2026

**URL de produção:** https://app-caronas-seven.vercel.app

**Ambiente:** Vercel (gru1 — São Paulo) + Supabase (sa-east-1 — São Paulo)

## Funcionalidades validadas

### Autenticação e perfil

- [x] Login com e-mail e senha
- [x] Verificação de e-mail (limitado a equipe; SMTP próprio necessário para outros alunos)
- [x] Usuário não verificado sem acesso (bloqueio no Supabase + assert no banco)
- [x] Esqueci minha senha (implementado; NOT_TESTED manualmente)
- [x] Primeiro acesso: nome, telefone/WhatsApp, bairro, e-mail do login
- [x] Perfil editável
- [x] PWA instalável com aviso nativo no Android e instruções no iOS

### Oferecer carona

- [x] Cadastro reutilizável de veículo (modelo, cor, placa)
- [x] Wizard completo: bairro → data/hora → vagas → pontos → preço → resumo
- [x] Carona criada com status OPEN
- [x] Motorista vê a própria carona na busca ("Sua carona")
- [x] Cancelar carona: status CANCELLED, reservas invalidadas, afetados notificados
- [x] Listagem de minhas caronas com passageiros

### Pegar carona

- [x] Wizard completo: bairro → ponto → dia/hora → resultados
- [x] Resultados divididos: "Perto do seu horário" e "Outros horários neste dia"
- [x] Card com detalhes: 1º nome, veículo, cor, preço, vagas, placa mascarada (ABC-***3)
- [x] Reserva transacional sem overbooking (10 pedidos simultâneos = 1 sucesso)
- [x] Integração WhatsApp (link wa.me com mensagem por período)
- [x] Minhas reservas com opção de cancelar
- [x] Cancelamento passageiro: devolve vaga, status ACTIVE → CANCELLED_BY_PASSENGER

### Informações

- [x] Pontos para bixetes com placeholder "Informação aguardando cadastro" (sem dados inventados)
- [x] Seed do banco: Country Clube + 6 pontos (Esquinão, Rodelão, VN, Shopping, Jomps, Véu das Noivas)
- [x] Dados dos pontos com NULL/pending_data (latitude, longitude, endereço)

## Testes

- [x] 50 testes unitários (PASS)
- [x] 32 testes de integração contra o Supabase (PASS)
- [x] TypeScript typecheck (PASS)
- [x] ESLint (PASS)
- [x] Build de produção (PASS)
- [x] Smoke test em produção (PASS: 200 nas rotas públicas, 307 nas protegidas)
- [x] Teste manual no celular (PARTIAL: cadastro, login, oferecer, cancelar OK)

## Segurança validada

- [x] Proteção de rotas (proxy + renovação de sessão)
- [x] Validação server-side (Zod)
- [x] Row Level Security (RLS) no Supabase
- [x] Mutações só por RPC (sem escrita direta nas tabelas)
- [x] `SELECT ... FOR UPDATE` (serialização de concorrência)
- [x] Proteção contra open redirect
- [x] Telefone mascarado; placa completa só para dono do veículo
- [x] E-mail de passageiros só no servidor (service role)

## Performance

- [x] Funções Vercel em `gru1` (mesma região do banco)
- [x] `getClaims()` valida JWT localmente (sem ida ao servidor de Auth a cada clique)
- [x] Resposta de `/pontos` servida de `gru1` dentro de latência esperada

## Dados

**País de operação:** Brasil  
**Fuso:** America/Sao_Paulo (-03:00)  
**Região piloto:** Country Clube, Poços de Caldas, MG

---

**Veja também:** [[07 - Testes]], [[03 - Requisitos]], [[09 - Pendências]]
