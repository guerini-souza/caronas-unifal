# Guia de configuração — contas do App de Caronas

> Passo a passo de tudo que foi configurado nos serviços web.
> **Nunca escreva senhas, chaves ou tokens neste arquivo.** Os valores ficam só em
> `.env.local` (no computador, ignorado pelo Git) e nas variáveis de ambiente da Vercel.

Contas usadas: todas criadas **exclusivamente para o app** (GitHub, Supabase, Vercel).

---

## 1. GitHub (código-fonte)

**Status:** ✅ concluído (23/09/2026)

1. Logado na conta do app em github.com → **+** (canto superior) → **New repository**.
2. Nome: `app-caronas` · Visibilidade: **Private**.
3. **Não** marcar README, .gitignore nem license (o projeto já tem) → **Create repository**.
4. Conectar o computador à conta do app (terminal):
   ```bash
   gh auth login
   ```
   Respostas: `GitHub.com` → `HTTPS` → `Yes` (autenticar o Git) → `Login with a web browser`.
   Copie o código de 8 letras, abra o link e cole, **no navegador logado na conta do app**.
5. Conferir qual conta está ativa:
   ```bash
   gh auth status
   ```
6. Enviar o código (feito pelo Claude):
   ```bash
   gh auth setup-git
   git remote add origin https://github.com/caronasunifal/app-caronas.git
   git push -u origin main
   ```

| Item | Valor (não secreto) |
|---|---|
| Conta GitHub do app | `caronasunifal` |
| Repositório | https://github.com/caronasunifal/app-caronas (privado) |
| Branch principal | `main` |

---

## 2. Supabase (banco, login e e-mail de verificação)

**Status:** ✅ banco criado, testado e URLs de login configuradas (23/09/2026)

1. supabase.com (conta do app) → **New project**, com estas opções:
   - Organization: a da conta do app (plano FREE)
   - GitHub: **não conectar** (as migrations são aplicadas pela CLI)
   - Project name: `app-caronas`
   - Database password: **Generate a password**, guardada fora do repositório
   - Region: South America (São Paulo), ou "Americas"
   - Security: ✅ Enable Data API · ⬜ Automatically expose new tables · ✅ Enable automatic RLS
2. Como as tabelas não são expostas automaticamente, a migration concede privilégios
   explícitos por tabela (`grant ...`), e o RLS filtra as linhas.
3. Chaves: **Project Settings → API Keys**
   - *Publishable key* → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - *Secret key* → `SUPABASE_SERVICE_ROLE_KEY`
4. Conexão do banco: botão **Connect → Session pooler** (funciona em redes só IPv4) → `SUPABASE_DB_URL`
   (trocar `[YOUR-PASSWORD]` pela senha do banco). A conexão *Direct* exige IPv6 e falhou numa rede sem IPv6.
5. Criar tabelas + dados iniciais (feito pelo Claude):
   ```bash
   npx supabase db push --db-url "$SUPABASE_DB_URL" --include-seed
   ```
6. Teste contra o banco real (cria usuários de teste e apaga no final):
   ```bash
   npm run test:concurrency
   ```
   Resultado em 24/09/2026: **56/56 verificações passaram** (inclui permissões do painel admin).

| Item | Valor (não secreto) |
|---|---|
| Project ref | `mpevswxqlphvakyqbtoa` |
| Project URL | https://mpevswxqlphvakyqbtoa.supabase.co |
| Confirmação de e-mail | ativada (padrão) |

7. **Authentication → URL Configuration** (✅ feito): *Site URL* = `https://app-caronas-seven.vercel.app`,
   *Redirect URLs* = `https://app-caronas-seven.vercel.app/**`.

## 3. Vercel (hospedagem)

**Status:** ✅ no ar (23/09/2026)

1. vercel.com (conta do app) → **Add New… → Project** → **GitHub** → autorizar a conta
   `caronasunifal` (somente o repositório `app-caronas`) → **Import**.
2. Em **Environment Variables**, apagar as variáveis de exemplo detectadas (valores vazios)
   e colar as 5 variáveis reais (a Vercel separa nome e valor sozinha):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NEXT_PUBLIC_APP_TIMEZONE`, `NEXT_PUBLIC_APP_UTC_OFFSET`.
3. **Create Project**. Cada `git push` na branch `main` publica uma nova versão automaticamente.
4. `vercel.json` fixa as funções na região **gru1 (São Paulo)**, a mesma do banco.

| Item | Valor (não secreto) |
|---|---|
| Time Vercel | Caronas UNiFAL (Hobby, grátis) |
| URL do app | https://app-caronas-seven.vercel.app |

Verificação após o deploy: páginas públicas respondem 200, `/pontos` lista o bairro vindo do
banco, e `/inicio` sem login redireciona para `/entrar`.

## 4. E-mail de confirmação/senha para todos os alunos (SMTP próprio)

**Status:** ✅ configurado e testado (23/09/2026) — cadastro de teste recebeu o e-mail de confirmação

O SMTP padrão do Supabase só envia e-mails para membros da equipe do projeto. Solução gratuita:
Gmail do app como remetente.

1. Conta Google `caronasunifal@gmail.com` → **Segurança** → ativar **Verificação em duas etapas**.
2. https://myaccount.google.com/apppasswords → nome `Supabase Caronas` → **Criar** → copiar a senha de
   16 letras (guardada fora do repositório; não reaproveitar em outro lugar).
3. Supabase → **Authentication → Emails → SMTP Settings** → **Enable custom SMTP**:

| Campo | Valor |
|---|---|
| Sender email / Username | `caronasunifal@gmail.com` |
| Sender name | `Caronas UNIFAL` |
| Host / Port | `smtp.gmail.com` / `465` |
| Password | senha de app (16 letras, sem espaços) |
| Minimum interval per user | 60 s (padrão) |

**Problema encontrado:** o log de Auth (Supabase → Logs → Auth) mostrava
`535 5.7.8 Username and Password not accepted`. A senha de app era válida (testada direto no Gmail),
mas o campo *Password* do Supabase estava com outro valor (preenchimento automático do navegador).
**Solução:** colar a senha de app numa **janela anônima** (Ctrl+Shift+N) e salvar.

Limites: Gmail ≈ 500 e-mails/dia; Supabase com SMTP próprio: 30 e-mails/hora (ajustável em
Authentication → Rate Limits). O aviso "provider designed for personal email" é esperado.

## 5. Troca da chave secreta do Supabase

**Status:** pendente — a chave secreta foi exposta durante a configuração. Gerar uma nova em
Project Settings → API Keys, atualizar `.env.local` e a variável na Vercel, e revogar a antiga.

## 6. Resend (e-mail de aviso de cancelamento — opcional)

**Status:** não configurado. Sem ele, o aviso de cancelamento é feito pelo WhatsApp e o e-mail
fica registrado como `skipped`. Para enviar a qualquer aluno, o Resend exige domínio próprio verificado.

---

## 7. Capacidade e limites dos planos grátis

Medido em 23/09/2026 com `npm run test:load` (detalhes em [TEST_REPORT.md](TEST_REPORT.md)):
ofertas, buscas e reservas simultâneas sem erro e sem overbooking; o banco grátis responde ~550 consultas/s,
o que equivale a **cerca de 1.000 alunos usando no mesmo instante**. Na prática, o que limita antes são as cotas abaixo:

| Limite | Plano grátis | Quando pesa | O que fazer |
|---|---|---|---|
| E-mails de confirmação/senha (Supabase) | 30 por hora | Dia de divulgação, muitos cadastros juntos | Authentication → Rate Limits → *emails sent*: subir (ex.: 100/h) |
| E-mails pelo Gmail | ≈ 500 por dia | Mesmo caso acima | Se passar disso: Resend ou outro provedor SMTP |
| Cadastros/logins por IP (Supabase) | 30 a cada 5 min | Login passa pelo servidor da Vercel: muitos alunos podem contar como o mesmo IP | Rate Limits → *sign-ups and sign-ins*: subir (ex.: 150) |
| Renovação de sessão por IP (Supabase) | 150 a cada 5 min | Pico da manhã, todos abrindo o app juntos | Rate Limits → *token refreshes*: subir (ex.: 1.800) |
| Projeto parado (Supabase) | Pausa após **7 dias sem uso** | Férias | Supabase → projeto → **Restore** (dados não se perdem) |
| Usuários ativos (Supabase) | 50.000 por mês | — | Folga enorme |
| Banco (Supabase) | 500 MB | — | Caronas e reservas ocupam poucos KB |
| Funções (Vercel Hobby) | 1 milhão de chamadas e 4 h de CPU por mês | Centenas de alunos usando todo dia | Acompanhar em Vercel → Usage |
| Uso comercial (Vercel Hobby) | Proibido | Se o app passar a cobrar ou ter anúncios | Plano Pro |

Com limite estourado, o app mostra "Muitas tentativas. Aguarde alguns minutos." (não quebra).

**Aplicado em 23/09/2026** (Supabase → Authentication → Rate Limits): e-mails **100/h**,
sign-ups e sign-ins **150/5 min**, token verifications **150/5 min**, token refreshes **1.800/5 min**.
Demais campos no padrão.

## 8. Painel admin (bairros, pontos e fotos)

Quem usa: a conta **caronasunifal@gmail.com** logada no app → **Perfil** → **PAINEL ADMIN**.

- **Novo bairro:** Painel admin → "Novo bairro" → nome → CRIAR BAIRRO.
- **Novo ponto:** abrir o bairro → NOVO PONTO → nome, foto, endereço, observações, localização → SALVAR PONTO.
- **Foto:** "TIRAR OU ESCOLHER FOTO" abre a câmera ou a galeria; a foto é reduzida no celular antes de enviar.
- **Localização:** estando no ponto, "USAR MINHA LOCALIZAÇÃO"; ou no Google Maps segurar o dedo no local,
  copiar os números (ex.: `-21.7876, -46.5613`) e colar.
- **Ordem:** setas ↑ ↓ ao lado de cada ponto (é a ordem que os alunos veem).
- **Tirar do app:** desmarcar "Mostrar este ponto/bairro no app" (não apaga; caronas antigas continuam funcionando).
- O aviso "Informação aguardando cadastro" some quando o ponto tem **endereço e foto**.

**Adicionar outro admin** (Supabase → SQL Editor):

```sql
insert into public.app_admins (email) values ('outro-email@exemplo.com');
```

A pessoa precisa ter conta no app com esse e-mail confirmado. Para remover: `delete from public.app_admins where email = '...';`

## 9. Notificações, lembrete de 10 min e link da carona

**Status:** ✅ no ar (25/09/2026). Falta o teste com celulares de verdade (Android e iPhone com o app instalado).

**Como funciona**
- Cada aluno toca em **ATIVAR NOTIFICAÇÕES** (Início, Perfil, depois de publicar ou reservar). O celular fica
  registrado para a conta logada; ao **Sair**, o celular deixa de receber os avisos daquela conta.
- **iPhone:** só funciona com o app **instalado na tela inicial** (iOS 16.4 ou mais novo). Android: navegador ou app instalado.
- **Lembrete:** a cada minuto o Supabase confere se há carona saindo em até 10 min; se houver, chama o app
  (`/api/lembretes`) e o motorista recebe "Sua carona sai em 10 min". Tocar abre a carona no botão **INICIEI A ROTA**.
- **INICIEI A ROTA** (motorista) e **ESTOU NO LOCAL** (passageiro) ficam liberados de 30 min antes até 1 h depois do horário.
  Quem não tem notificações recebe o aviso pelo WhatsApp (botão com a mensagem pronta).
- **Link da carona:** botão **COMPARTILHAR NO WHATSAPP** (e **Copiar link**) em "Carona publicada!" e em Minhas caronas.
  Link: `https://app-caronas-seven.vercel.app/carona/<id>`. Sem login mostra a prévia (sem nome, placa ou telefone);
  depois do login/cadastro volta direto para a carona.

**Configuração (feita pelo Claude, uma vez)**
1. Migration `20260925000005_trips_push.sql` (ativa `pg_cron` e `pg_net`, cria tabelas, funções e o agendamento).
2. Segredos no **Vault** do Supabase: `npm run setup:push` (gera chaves VAPID e o segredo do agendamento; não
   sobrescreve os existentes). Nomes: `app_url`, `cron_secret`, `vapid_public_key`, `vapid_private_key`.
   Para verificar o certificado do banco, baixe-o em Supabase → Database → Settings → SSL e rode com
   `SUPABASE_CA_CERT=<caminho do arquivo>`; sem ele a conexão é cifrada, mas não verifica o servidor (aviso na tela).
3. Migration `20260925000006_push_hardening.sql` (correções da auditoria: 5 celulares por conta, serviços exatos).
   **Nada foi configurado na Vercel.**

**Conferir e manter (Supabase → SQL Editor)**
```sql
select jobname, schedule, active from cron.job;                          -- agendamentos
select name, created_at from vault.secrets;                              -- nomes dos segredos (sem valores)
select status_code, created from net._http_response order by created desc limit 5;  -- últimas chamadas ao app
select cron.unschedule('lembrete-saida-carona');                         -- pausar o lembrete (se precisar)
```
Trocar o segredo do agendamento: `select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), '<novo valor>');`
(a Vercel lê do Vault; em até 10 minutos passa a valer). **Não** troque as chaves VAPID sem necessidade: todos
os celulares precisariam ativar as notificações de novo.

## Variáveis de ambiente (nomes — sem valores)

| Variável | Onde pegar | Onde colocar |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Data API (sem o `/rest/v1/` do final) | `.env.local` e Vercel |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API Keys → Publishable key | `.env.local` e Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys → Secret key — **secreta** | `.env.local` e Vercel (nunca no código) |
| `SUPABASE_DB_URL` | Supabase → Connect → Direct → URI | só `.env.local` (aplicar migrations) |
| `NEXT_PUBLIC_SITE_URL` | URL final da Vercel | `.env.local` e Vercel |
| `RESEND_API_KEY` / `EMAIL_FROM` | Resend → API Keys | Vercel (opcional) |
