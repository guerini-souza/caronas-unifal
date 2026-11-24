# Relatório de testes

**Data da última execução:** 25/09/2026 · **Commit base:** `d3a1c80` · **Ambiente:** Supabase (sa-east-1) + Vercel (gru1)

Legenda: **PASS** = executado e passou · **FAIL** = executado e falhou · **PARTIAL** = testado em parte · **NOT_TESTED** = não executado.

## Resumo

| Tipo | Ferramenta | Resultado |
|---|---|---|
| Unitários | Vitest (`npm run test`) | **PASS — 88/88** |
| Integração com o banco real | `npm run test:concurrency` | **PASS — 85/85** |
| Tipagem | `npm run typecheck` | **PASS** |
| Lint | `npm run lint` | **PASS** |
| Build de produção | `npm run build` | **PASS** |
| Smoke test em produção | `curl` nas rotas publicadas | **PASS** |
| Teste manual no celular | Uso real pelo responsável do projeto | **PARTIAL** (ver abaixo) |
| E2E automatizado (Playwright) | — | **NOT_TESTED** (dependência instalada, testes não escritos) |
| Teste de carga (oferta + busca + reserva simultâneas) | `npm run test:load` | **PASS — 6/6, 0 erros** |

## Unitários (88)

`tests/unit/format.test.ts`, `whatsapp.test.ts`, `safe-next.test.ts`, `admin-helpers.test.ts`, `trip.test.ts`, `push.test.ts`, `service-worker.test.ts`:

- Normalização e validação de telefone brasileiro (celular e fixo, com/sem DDI e zero).
- Normalização de placa (padrão antigo e Mercosul) e máscara `ABC-***4`.
- Conversão de preço (`5`, `5,00`, `R$ 5,50`, `1.000,00`) e rejeição de valores inválidos.
- Data/hora no fuso de São Paulo e períodos manhã/tarde/noite.
- Link `wa.me`: telefone só com dígitos, texto codificado, sem injeção de parâmetros.
- Mensagens de reserva (bom dia/boa tarde/boa noite) e de cancelamento com horário.
- Proteção contra open redirect (`//`, `\`, TAB, quebra de linha, URLs externas e `/..//host`, `/.//host`, `/%2e%2e//host`).
- Painel admin: coordenadas coladas ou link do Google Maps; tipo da foto pelos primeiros bytes (JPEG/PNG/WebP).
- Janela dos botões INICIEI A ROTA / ESTOU NO LOCAL (30 min antes até 60 min depois; igual ao banco).
- Textos das notificações (lembrete com/sem passageiros, rota iniciada ida/volta, chegada ida/volta) e serviços de push aceitos.
- Mensagem de compartilhar a carona, `wa.me` sem número e avisos de rota/chegada pelo WhatsApp.
- Service worker real (`public/sw.js`) de ponta a ponta: notificação chega → toque abre a tela certa (`/minhas-caronas/{id}`, `/reservas`), navega a janela já aberta, e endereços estranhos abrem o início.

## Integração com o Supabase real (85)

Cria 12 usuários confirmados (1 motorista + 10 passageiros + 1 admin de teste), executa e **apaga tudo no final**.

- [x] seed: 6 pontos do Country Clube (Esquinão, Rodelão, VN, Shopping, Jomps, Véu das Noivas)
- [x] RLS: não cria perfil de outro usuário
- [x] RLS: usuário só lê o próprio perfil
- [x] create_ride exige veículo próprio
- [x] RLS: placa de outro usuário não é legível
- [x] RLS: não edita veículo alheio
- [x] RLS: não insere carona direto na tabela
- [x] create_ride rejeita horário passado
- [x] create_ride cria carona OPEN
- [x] lista carona que passa pelo ponto
- [x] carona de IDA não aparece na busca de VOLTA
- [x] carona retorna o sentido na listagem
- [x] create_ride rejeita sentido inválido
- [x] placa mascarada na listagem (ABC-***3)
- [x] mostra só primeiro nome do motorista
- [x] motorista não reserva a própria carona
- [x] rejeita ponto fora da rota
- [x] **concorrência: 10 pedidos simultâneos pela última vaga → 1 reserva (1 sucesso, 9 RIDE_FULL)**
- [x] vaga reduzida para 0 e status FULL
- [x] sem overbooking no banco (1 reserva ativa)
- [x] carona lotada some da busca
- [x] não reserva duas vezes
- [x] não cancela reserva alheia
- [x] RLS: não lê reserva alheia
- [x] motorista vê reservas da própria carona
- [x] passageiro cancela a própria reserva
- [x] vaga devolvida e status OPEN
- [x] reserva CANCELLED_BY_PASSENGER com data
- [x] não cancela duas vezes / não devolve vaga em dobro
- [x] nova reserva após devolução
- [x] passageiro não cancela carona alheia
- [x] motorista cancela carona e recebe afetados
- [x] reserva invalidada (CANCELLED_BY_DRIVER)
- [x] carona CANCELLED com data
- [x] passageiro vê reserva cancelada pelo motorista
- [x] admin: aluno comum não é admin
- [x] admin: aluno não cria bairro / não cria ponto / não edita ponto
- [x] admin: aluno não envia foto / não apaga foto
- [x] admin: aluno não sobrescreve nem move foto; não lê a lista de admins
- [x] admin: sem login não cria ponto, não envia foto, não chama `is_admin`
- [x] ponto oculto e ponto de bairro oculto não aparecem para alunos
- [x] link: prévia funciona sem login, sem nome/placa/telefone, com status e pontos em ordem
- [x] rota: só o motorista inicia; apertar de novo não avisa de novo; fora do horário é recusado
- [x] chegada: só o passageiro da reserva avisa; segunda vez não avisa de novo; fora do horário é recusado
- [x] minhas caronas / reservas mostram rota iniciada e chegada
- [x] lembrete: aluno não aciona o lembrete, não lê o Vault nem dispara o agendamento
- [x] lembrete: pega só a carona devida (não a criada em cima da hora, iniciada ou cancelada), uma vez só
- [x] celulares: registro, recusa de endereço que não é serviço de push, tabela inacessível ao aluno,
      aparelho passa para quem entrou por último, ex-dono não apaga, dono remove ao sair
- [x] celulares: recusa outro serviço do Google; no máximo 5 celulares por conta
- [x] chegada: cancelar e reservar de novo a mesma carona não avisa o motorista de novo
- [x] admin: conta listada em `app_admins` é admin
- [x] admin: cria bairro e ponto (sem foto fica "aguardando dados")
- [x] admin: envia foto; foto é pública para qualquer um
- [x] ponto com endereço + foto fica completo (automático)
- [x] ponto não muda de bairro; foto só com endereço `https`
- [x] bairro desativado não aparece para alunos
- [x] admin: apaga foto

## Teste de carga (produção, 23/09/2026)

`scripts/load-test.mjs`: cria 5 motoristas e 10 passageiros confirmados, dispara as chamadas em paralelo
a partir de um computador em Minas Gerais e **apaga tudo no final**. Os "alunos virtuais" não fazem pausa
entre um toque e outro, então a carga é bem maior que a de alunos reais em mesmo número.

**1) Oferta em massa:** 5 motoristas publicando 20 caronas cada, ao mesmo tempo → 100/100 gravadas,
0 erros, p95 596 ms.

**2) Busca com 100 caronas no banco** (listar caronas do ponto, abrir carona, minhas reservas; 5x cada):

| Alunos virtuais simultâneos | Pedidos | Erros | Vazão | p50 | p95 |
|---|---|---|---|---|---|
| 10 | 150 | 0 | 152/s | 57 ms | 110 ms |
| 25 | 375 | 0 | 372/s | 55 ms | 106 ms |
| 50 | 750 | 0 | 546/s | 74 ms | 140 ms |
| 100 | 1500 | 0 | 517/s | 155 ms | 376 ms |
| 200 | 3000 | 0 | 580/s | 267 ms | 689 ms |

A vazão estabiliza em ~550–730 consultas/s (duas execuções); acima disso só aumenta a espera.

**3) Tudo junto:** 5 motoristas publicando +10 caronas cada enquanto 60 alunos buscam, reservam e
cancelam 25% das reservas (3x cada):

| Operação | Pedidos | Erros | p50 | p95 |
|---|---|---|---|---|
| Ofertar | 50 | 0 | 227 ms | 456 ms |
| Buscar | 180 | 0 | 182 ms | 459 ms |
| Reservar | 180 | 0 (11 "sem vaga/já reservada", resposta esperada) | 131 ms | 256 ms |
| Cancelar reserva | 41 | 0 | 114 ms | 219 ms |

Conferência no banco após a mistura (150 caronas, 169 reservas, 41 cancelamentos → 128 ativas):

- [x] todas as caronas gravadas
- [x] nenhuma carona com mais passageiros que vagas (sem overbooking)
- [x] vagas restantes = vagas totais − reservas ativas, em todas as caronas
- [x] carona sem vaga = LOTADA; com vaga = ABERTA
- [x] ninguém com duas reservas ativas na mesma carona
- [x] nenhum erro inesperado

**4) Site (servidor da Vercel consultando o banco), `/pontos`:** 100 visitantes simultâneos → 500 pedidos,
0 erros, 477/s, p50 111 ms, p95 260 ms. Primeiro acesso após inatividade chegou a ~1 s (servidor "acordando").

**Leitura:** um aluno real gera cerca de 1 consulta a cada 2–3 s enquanto usa o app (telas, pré-carregamento,
busca e reserva). Com ~550 consultas/s, o banco grátis comporta **da ordem de 1.000 alunos usando no mesmo
instante**; o objetivo do projeto (30–50 simultâneos) fica muito abaixo disso. Limites que aparecem antes
estão em [SETUP.md § 7](SETUP.md#7-capacidade-e-limites-dos-planos-grátis).

## Link, rota e notificações em produção (25/09/2026)

Script temporário com contas de teste (apagadas no fim):

| Verificação | Resultado |
|---|---|
| `POST /api/lembretes` sem segredo | **PASS** (401) |
| `GET /api/push/chave` | **PASS** (chave pública de 87 caracteres) |
| `/carona/{id}` sem login: prévia + `og:title` + ENTRAR PARA RESERVAR | **PASS** |
| `/carona/{id}` logado → `/pegar/carona/{id}` | **PASS** (307) |
| Motorista vê INICIEI A ROTA; passageiro vê ESTOU NO LOCAL | **PASS** |
| Agendamento real (pg_cron → pg_net → `/api/lembretes` → claim) marcou o lembrete de uma carona de teste | **PASS** (no minuto seguinte) |
| Chaves do Vault + criptografia do `web-push` contra o serviço do Google (endereço falso) | **PASS** (resposta 410, tratada como celular expirado) |
| Notificação chegando num celular real (Android / iPhone instalado) | **NOT_TESTED** (teste do responsável) |
| Após as correções da auditoria: link de carona cancelada (logado) mostra indisponível; `/verificar-email` repassa o link; sem ponto escolhido pergunta "Onde você vai esperar?" | **PASS** |

## Smoke test em produção

`https://app-caronas-seven.vercel.app`: `/`, `/entrar`, `/cadastro`, `/esqueci-senha`, `/pontos`,
`/manifest.webmanifest`, `/sw.js`, `/brand/icon-512.png` → **200**.
`/inicio`, `/pegar`, `/reservas` sem login → **307 para `/entrar`** (rota protegida).
`/pontos` lista o bairro vindo do banco (conexão Vercel ↔ Supabase OK). Resposta servida de `gru1`.

**Painel admin em produção (24/09/2026)**, com contas de teste criadas e apagadas em seguida:
`/admin` sem login → 307 para `/entrar`; aluno comum → "Página não encontrada", sem dados, sem botão no Perfil
e sem "Painel admin" no título; admin de teste → painel com bairros, lista de pontos, formulário de novo ponto
e botão **PAINEL ADMIN** no Perfil.

## Teste manual no celular (uso real)

| Item | Status | Observação |
|---|---|---|
| Abrir o app / instalar PWA | PASS | Aviso "Adicionar à tela inicial" e ícone novo conferidos pelo usuário |
| Cadastro + confirmação de e-mail | PASS | E-mail da equipe e, após SMTP próprio, e-mail externo |
| Login / perfil | PASS | |
| Cadastro de veículo | PASS | |
| Oferecer carona (wizard completo) | PASS | Carona gravada no banco com 3 pontos em ordem |
| Cancelar carona (motorista) | PASS | Carona ficou `CANCELLED` no banco |
| Buscar a própria carona | PASS após correção | Antes a busca ocultava caronas do próprio motorista |
| Cadastro com e-mail externo (Gmail pessoal) | PASS | Após configurar SMTP próprio |
| Reservar ida e volta **pela interface** com 2 usuários + WhatsApp | PASS | Testado pelo responsável; mensagem do WhatsApp conferida e ajustada |
| Fluidez / tempo de resposta | PASS (percepção do usuário) | Servidor medido em 80–140 ms por tela logada; prefetch + navigation preload |
| Esqueci minha senha | NOT_TESTED | Implementado; não exercitado manualmente |
| Responsividade 360/390/430px, tablet, desktop | PARTIAL | Layout em container de 448px; visto em 1 celular real; demais larguras não verificadas |

## Problemas encontrados e corrigidos

| Problema | Origem | Correção |
|---|---|---|
| Open redirect via `/auth/confirm?next=/..//site` (caminho normalizado para `//site`) | Auditoria de 25/09 | `safeNext` recusa caminho que vira `//` + testes |
| Conta podia cadastrar celulares sem limite e o envio ia para todos de uma vez | Auditoria de 25/09 | Máximo de 5 por conta, hosts exatos, envio em lotes com limite |
| Cancelar e reservar de novo repetia o aviso "está no local" | Auditoria de 25/09 | Banco não avisa de novo na mesma carona; tag por carona + passageiro |
| Service worker aceitava endereço com TAB/quebra de linha | Auditoria de 25/09 | `safeTarget` só abre endereços do próprio app |
| Link de carona cancelada aberto por quem está logado dava 404 | Auditoria de 25/09 | Tela "não está mais disponível" |
| O retorno à carona se perdia ao reenviar o e-mail de confirmação | Auditoria de 25/09 | `next` levado pela tela de confirmação e pelo reenvio |
| Depois da correção do service worker, todo toque em notificação abria o Início | Reauditoria de 25/09 | Endereço validado uma vez só (no toque) + teste de ponta a ponta do service worker |
| Título da aba mostrava "Painel admin" para quem não é admin (conteúdo já bloqueado) | Teste em produção | Páginas do painel sem título próprio |
| Vercel pulou o deploy quando código e docs foram enviados juntos | Deploy do painel | Ignored Build Step compara com o último deploy (`VERCEL_GIT_PREVIOUS_SHA`) |
| Localização digitada errada (`-121.78`) virava outro número | Auditoria do painel admin | Regex recusa número truncado + testes |
| Ponto de bairro oculto abria por link direto | Auditoria do painel admin | Consulta exige bairro ativo |
| Perfil trocaria o bairro sozinho se o bairro fosse ocultado | Auditoria do painel admin | Obriga escolher de novo |
| Open redirect via `?next=/%09/evil.com` | Auditoria | `safeNext` compartilhado rejeita controle/`\`/origem externa + testes |
| `cancel_ride` expunha e-mail de passageiros ao motorista | Auditoria | E-mail buscado só no servidor (service role) |
| Recursão entre políticas RLS de `rides` e `reservations` | Revisão própria | Funções auxiliares `SECURITY DEFINER` |
| Motorista não achava a própria carona | Teste manual | Busca inclui `is_mine` com aviso "Sua carona" |
| Lentidão ao navegar | Teste manual | Funções em `gru1` + `getClaims()` (JWT verificado localmente) |
| URL do Supabase com `/rest/v1/` sobrando no `.env.local` | Configuração | Corrigido e validado com chamada à API |
| "This page couldn't load" ao entrar logo após uma atualização do site | Teste manual | `deploymentId` (recarga automática), telas de erro em PT-BR, sem deploy para commits só de docs |
| Não havia ida/volta; busca misturava sentidos | Teste manual | Coluna `direction`, sentido como 1ª etapa e filtro na busca |
| E-mail de confirmação não saía para outros alunos (Gmail 535) | Teste manual | Senha de app colada em janela anônima; envio confirmado |
| Site "lento" ao usar | Teste manual | Medição: servidor 80–140 ms; causa no cliente. Wizard de pegar no celular, `prefetch` completo das telas principais, navigation preload no service worker, esqueleto de carregamento |
