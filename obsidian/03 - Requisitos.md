---
tags: requisitos, checklist, validação
data: 2026-09-23
---

# Requisitos

## Status geral

**PASS: 27 · PARTIAL: 5 · NOT_TESTED: 3 · FAIL: 0**

Nenhum requisito crítico em FAIL.

## Funcionais

| Requisito | Status | Notas |
|---|---|---|
| Login com e-mail e senha | PASS | Supabase Auth |
| Verificação de e-mail | PARTIAL | Funciona para equipe; outros alunos dependem de SMTP próprio |
| Usuário não verificado sem acesso | PASS | Assert no banco |
| Esqueci minha senha | PASS | Implementado; NOT_TESTED manualmente |
| Primeiro acesso: nome, telefone, bairro | PASS | Teste manual |
| Tela inicial (PEGAR, OFERECER, PONTOS) | PASS | Produção |
| Veículo reutilizável | PASS | Integração |
| Wizard oferecer completo | PASS | Teste manual |
| Carona com status OPEN | PASS | Banco |
| Wizard pegar completo | PASS | Integração + manual |
| Card com detalhes (preço, vagas, placa mascarada) | PASS | Produção |
| Reserva transacional sem overbooking | PASS | 10 pedidos simultâneos → 1 sucesso |
| WhatsApp wa.me com mensagem por período | PARTIAL | Links testados; abertura real no celular não verificada |
| Pagamento fora do app | PASS | Sem gateway |
| Minhas reservas + CANCELAR | PASS | Integração |
| Cancelamento motorista (afetados, WhatsApp) | PASS | Integração + manual |
| E-mail de cancelamento | PARTIAL | Implementado; sem credenciais Resend → "skipped" |
| Pontos para bixetes | PASS | "Informação aguardando cadastro" (sem dados inventados) |
| Painel admin (conta oficial) | PARTIAL | Bairros, pontos, foto, endereço, localização; permissões testadas na integração, falta uso real |
| Link da carona pelo WhatsApp | PARTIAL | Prévia pública sem dados pessoais; testado em produção; falta abrir no celular |
| INICIEI A ROTA / ESTOU NO LOCAL | PARTIAL | Permissões e janela testadas na integração; falta uso real |
| Lembrete 10 min antes (notificação) | PARTIAL | Agendamento real disparou; falta receber num celular |

## Não-funcionais

| Requisito | Status | Notas |
|---|---|---|
| PWA instalável | PASS | Manifest, ícones, service worker, aviso no celular |
| Mobile (1 celular real) | PARTIAL | 1 teste; layout 360/390/430/tablet/desktop não verificados |
| Segurança (RLS, validação, secrets) | PASS | Proteção de rotas, RLS integração OK |
| Responsividade | PARTIAL | Testada em 1 dispositivo; outras larguras não verificadas |
| Build e deploy | PASS | Vercel, cada push publica automaticamente |
| Seed do banco (Country Clube + 6 pontos) | PASS | Dados NULL/pending_data |
| Arquitetura para escalabilidade | PASS | Modelo preparado para novos bairros |

## Testes

| Tipo | Resultado | Notas |
|---|---|---|
| Unitários (50) | PASS | telefone, placa, preço, fuso, WhatsApp, open-redirect |
| Integração (32) | PASS | RLS, reservas, concorrência, cancelamentos |
| Tipagem | PASS | TypeScript |
| Lint | PASS | ESLint |
| Build produção | PASS | `npm run build` |
| Smoke test produção | PASS | Rotas 200, banco conectado |
| Teste manual celular | PARTIAL | Cadastro, login, oferecer, cancelar OK; 2º usuário pendente (SMTP) |
| E2E Playwright | NOT_TESTED | Dependência instalada, testes não escritos |
| Teste de carga | NOT_TESTED | Não feito |

---

**Veja também:** [[07 - Testes]], [[08 - Resultados]], [[09 - Pendências]]
