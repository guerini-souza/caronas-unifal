> **Trabalho de Conclusão de Curso** — Bacharelado Interdisciplinar em Ciência e Tecnologia, UNIFAL-MG, campus Poços de Caldas (2026):  
> *Transformando a experiência estudantil: soluções digitais para mobilidade e automação de agenda acadêmica*.  
> **Autores:** Vitor Garcia Guerini e Pedro Affonso de Souza · **Orientadora:** Profa. Marina Gomes Murta Moreno.  
> Outro aplicativo do trabalho: [agenda-semestre](https://github.com/guerini-souza/agenda-semestre) (agenda acadêmica).  
> Proposta original do aplicativo: [`documentos/ideia-do-aplicativo-v0.2`](documentos/ideia-do-aplicativo-v0.2/LEIA-ME.md).  
> Cópia do código na versão usada no TCC (17/11/2026), sem senhas, chaves nem dados pessoais
> (os valores de configuração ficam fora do repositório; os arquivos `.env.example` mostram só os nomes).

# Caronas UNIFAL

Web App/PWA de caronas universitárias. Organiza um processo que hoje acontece de forma
informal: quem **oferece** carona publica horário, vagas, pontos e preço; quem **pega**
carona escolhe bairro, ponto e horário, reserva a vaga e fala com o motorista pelo WhatsApp.
Bairro inicial: **Country Clube** (Poços de Caldas).

**Produção:** https://app-caronas-seven.vercel.app

> Status: MVP no ar. Veja o que foi validado em [docs/REQUIREMENTS_CHECKLIST.md](docs/REQUIREMENTS_CHECKLIST.md)
> e [docs/TEST_REPORT.md](docs/TEST_REPORT.md). Pendências reais no fim deste arquivo.

## Funcionalidades

- Cadastro e login com e-mail + senha, confirmação de e-mail e "Esqueci minha senha".
- Primeiro acesso: nome, WhatsApp e bairro.
- **Oferecer carona** (wizard): ida/volta → data/hora → bairro → pontos da rota (em ordem) → vagas → preço → resumo (veículo cadastrado uma vez).
- **Pegar carona** (wizard): ida/volta → dia e horário → bairro → ponto → caronas perto do horário.
- Reserva **sem overbooking** (transação com lock no banco) e abertura do WhatsApp (`wa.me`) com mensagem de bom dia/boa tarde/boa noite.
- **Minhas reservas**: cancelar (devolve a vaga) e avisar o motorista no WhatsApp.
- **Minhas caronas**: passageiros, cancelar carona, lista de afetados com WhatsApp e e-mail (se configurado).
- **Link da carona** para o WhatsApp (`/carona/{id}`): prévia sem dados pessoais e cartão no WhatsApp; depois do login
  (ou do cadastro) a pessoa cai direto na carona para escolher o ponto e reservar.
- **INICIEI A ROTA** (motorista) e **ESTOU NO LOCAL** (passageiro), de 30 min antes até 1 h depois do horário, com aviso
  no celular e WhatsApp de reserva para quem não tem notificações.
- **Notificações** (Web Push): lembrete ao motorista 10 min antes da saída (agendado no Supabase), rota iniciada e chegada.
- **Pontos para bixetes**: bairro → ponto → detalhes ("Informação aguardando cadastro" enquanto não há dados reais).
- **Painel admin** (`/admin`, só a conta oficial): bairros e pontos, foto tirada no celular, endereço, observações,
  localização no mapa, ordem e ocultar/mostrar.
- PWA instalável: manifest, ícones, service worker, botão **INSTALAR APP** e aviso automático "Adicionar à tela inicial?".

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Backend | Server Actions + Proxy do Next.js (validação com Zod) |
| Banco/Auth | Supabase (PostgreSQL, Auth, Row Level Security, funções RPC) |
| E-mail de aviso | Resend (opcional, abstração em `src/lib/notifications/email.ts`) |
| Hospedagem | Vercel (região `gru1` — São Paulo) |
| Testes | Vitest (unitários) + script de integração contra o Supabase |

Arquitetura: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Banco: [docs/DATABASE.md](docs/DATABASE.md) ·
Configuração das contas: [docs/SETUP.md](docs/SETUP.md)

## Instalação (desenvolvimento)

Requisitos: Node.js 20+ e npm.

```bash
npm install
```

Crie `.env.local` a partir de `.env.example` e preencha (nunca versione esse arquivo).

## Variáveis de ambiente

| Variável | Uso | Onde |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | `.env.local` e Vercel |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (publishable) | `.env.local` e Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave secreta — só servidor (e-mails de aviso, logs, testes) | `.env.local` e Vercel |
| `SUPABASE_DB_URL` | Conexão do banco para aplicar migrations | só `.env.local` |
| `NEXT_PUBLIC_APP_TIMEZONE` / `NEXT_PUBLIC_APP_UTC_OFFSET` | Fuso das caronas (`America/Sao_Paulo`, `-03:00`) | `.env.local` e Vercel |
| `NEXT_PUBLIC_SITE_URL` | URL pública para links de e-mail (opcional; sem ela usa o host da requisição) | Vercel |
| `RESEND_API_KEY` / `EMAIL_FROM` | Envio de e-mail de cancelamento (opcional) | Vercel |

## Banco (Supabase)

Migrations em `supabase/migrations/` e dados iniciais em `supabase/seed.sql`
(bairro Country Clube e 6 pontos, com endereço/foto/coordenadas **NULL** e `data_status = pending_data`).

```bash
npx supabase db push --db-url "$SUPABASE_DB_URL" --include-seed
```

No painel do Supabase: **Authentication → URL Configuration** com *Site URL* = URL da Vercel e
*Redirect URLs* = `https://<app>.vercel.app/**`. "Confirm email" permanece ativado.

## Execução

```bash
npm run dev      # desenvolvimento (http://localhost:3000)
npm run build    # build de produção
npm run start    # servir o build
```

## Testes

```bash
npm run test              # 88 testes unitários (telefone, placa, preço, fuso, WhatsApp, anti open-redirect, coordenadas, fotos, notificações, janela da rota, service worker)
npm run test:concurrency  # 85 verificações contra o Supabase real (RLS, reservas, concorrência, cancelamentos, painel admin, link, rota, chegada, lembrete, celulares)
npm run test:load         # teste de carga: oferta + busca + reserva simultâneas
npm run setup:push        # (uma vez) grava no Vault as chaves das notificações e o segredo do agendamento
npm run lint
npm run typecheck
```

O teste de integração cria usuários de teste confirmados com a chave secreta e **apaga tudo no final**.

## Deploy

Cada `git push` na branch `main` do repositório `caronasunifal/app-caronas` publica na Vercel.
A região das funções é fixada em São Paulo por `vercel.json` (`"regions": ["gru1"]`).

## Resend (opcional)

Sem `RESEND_API_KEY`, o cancelamento pelo motorista registra o e-mail como `skipped` e o aviso
é feito pelo WhatsApp. Para enviar a qualquer destinatário, o Resend exige um domínio verificado.

## Pendências reais

- **E-mail de confirmação para outros alunos:** o SMTP padrão do Supabase só envia para membros da equipe
  do projeto. É preciso configurar SMTP próprio (ex.: Gmail do app com senha de app).
- **Trocar a chave secreta do Supabase** (foi exposta durante a configuração).
- Endereços, fotos, coordenadas e descrições dos 6 pontos (hoje `pending_data`).
- Domínio próprio (opcional) e credenciais do Resend (opcional).
