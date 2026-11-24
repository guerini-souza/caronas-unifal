# Changelog

## 2026-09-25 — Link da carona, rota e notificações

- **Link da carona** (`/carona/{id}`): COMPARTILHAR NO WHATSAPP e Copiar link em "Carona publicada!" e em Minhas caronas;
  prévia sem nome/placa/telefone com cartão no WhatsApp; depois do login ou cadastro (confirmação + primeiro acesso)
  a pessoa cai direto na carona e escolhe o ponto.
- **INICIEI A ROTA** (motorista) e **ESTOU NO LOCAL** (passageiro), de 30 min antes até 1 h depois do horário; avisos no
  celular e botão de WhatsApp para quem não tem notificações; telas atualizam sozinhas durante a carona.
- **Notificações** (Web Push): cartão ATIVAR NOTIFICAÇÕES (Início, Perfil, após publicar/reservar); celular ligado à conta
  logada; sair remove. Lembrete ao motorista **10 min antes** (Supabase `pg_cron` + `pg_net` → `/api/lembretes`),
  tocando abre a carona no INICIEI A ROTA. Segredos no Vault (`npm run setup:push`).
- Banco: migration `20260925000005_trips_push.sql` (colunas de rota/chegada/lembrete, `push_subscriptions`, RPCs, cron).
- Deploy: a Vercel compara com o último deploy para decidir se publica (antes só olhava o último commit).
- Correções da auditoria: open redirect com `/..//site` no link de confirmação; no máximo 5 celulares por conta e só
  serviços de push exatos; aviso de chegada não se repete ao reservar de novo; service worker só abre endereços do app;
  link de carona cancelada mostra "não está mais disponível"; retorno à carona mantido ao reenviar a confirmação.
- Reauditoria: toque na notificação voltou a abrir a tela certa (endereço validado uma vez só); teste de ponta a ponta do
  service worker.

## 2026-09-24 — Painel admin

- `/admin` (botão **PAINEL ADMIN** no Perfil), só para a conta oficial (`caronasunifal@gmail.com`):
  criar/renomear/ocultar bairros; criar/editar/ocultar pontos e mudar a ordem; foto tirada no celular
  (reduzida antes do envio), endereço, observações e localização ("usar minha localização" ou colar do Google Maps).
- Ponto fica "completo" sozinho quando tem endereço e foto; o aviso "Informação aguardando cadastro" some.
- Banco: tabela `app_admins`, função `is_admin()`, políticas de admin, bucket público `pontos` no Storage
  (só admin envia/apaga). Telas dos alunos mostram só bairros e pontos ativos.

## 2026-09-23 (teste de carga)

- `npm run test:load`: oferta em massa (100 caronas ao mesmo tempo), busca com até 200 alunos virtuais
  simultâneos e oferta + busca + reserva + cancelamento juntos, com conferência de vagas no banco.
  Resultado: 0 erros, sem overbooking. Capacidade e limites dos planos grátis em `docs/SETUP.md` § 7.

## 2026-09-23 (noite)

- Desempenho: wizard de "Pegar carona" roda no celular (só a lista consulta o servidor), prefetch completo das telas principais,
  navigation preload no service worker, transições entre etapas e esqueleto de carregamento.
- Mensagens de WhatsApp de ida e de volta reescritas com o texto do responsável.

- **Sentido da carona (IDA → UNIFAL / VOLTA ← UNIFAL)** como primeira escolha para oferecer e para procurar;
  a busca só mostra caronas do sentido escolhido. Na volta, o ponto é onde o passageiro desce.
- Ordem dos fluxos: sentido → dia/horário → bairro → ponto(s). "Oferecer a volta também" após publicar.
- Proteção contra atualização do site com a tela aberta (`deploymentId`), recarga automática e telas de erro em português.
- Commits só de documentação não republicam o site.
- E-mail de confirmação para qualquer aluno via Gmail (SMTP próprio).

## 2026-09-23

- Tela inicial com cartões ilustrados (Pegar, Oferecer, Área dos Bixos), logo "Caronas UNIFAL" e banner em Pontos para bixetes.
- Passageiro escolhe dia e horário; resultados "Perto do seu horário" e "Outros horários neste dia".
- Motorista vê a própria carona na busca ("Sua carona").
- Desempenho: funções na região `gru1` (São Paulo) e verificação local do JWT (`getClaims`).
- Aviso automático "Adicionar à tela inicial?" (nativo no Android, passos no iPhone).
- Fluxo "Esqueci minha senha".
- Privilégios de tabela explícitos (projeto sem exposição automática de tabelas).
- Segurança: correção de open redirect; e-mail de passageiros não sai mais pelo banco; logs só pelo servidor;
  cancelamentos bloqueados após a saída.
- Revisão de UX: alvos de toque, foco visível, botão "voltar" do celular no wizard, rótulos.
- Deploy na Vercel (`app-caronas-seven.vercel.app`) e documentação de configuração das contas.

## 2026-09-22

- Projeto Next.js 16 + Tailwind + Supabase.
- Banco: tabelas, RLS, funções transacionais (criar carona, reservar, cancelar) e seed do Country Clube.
- Telas: abertura/instalação, cadastro, login, perfil, veículo, oferecer, pegar, reservas, minhas caronas, pontos.
- Testes unitários e teste de integração de concorrência/RLS.
- Subagentes do Claude Code (architect, auditor, qa, docs, tcc, designer).
