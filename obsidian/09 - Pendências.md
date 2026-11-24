---
tags: pendências, tarefas, futuros
data: 2026-09-23
---

# Pendências

Listadas **exclusivamente** nos arquivos de documentação. Somente itens reais, **nada inventado**.

## Críticas

### 1. SMTP próprio para confirmação de e-mail

**Status:** BLOCKING

O Supabase Auth padrão só envia confirmação para membros da equipe do projeto. Para permitir que alunos normais confirmem seu e-mail:

- Configurar SMTP próprio (ex.: Gmail do app com senha de app)
- Sem isto: `Verificação de e-mail = PARTIAL`

**Impacto:** Novos usuários não conseguem criar conta e verificar e-mail

### 2. Trocar a chave secreta do Supabase

**Status:** BLOCKING

A `SUPABASE_SERVICE_ROLE_KEY` foi exposta durante a configuração.

**Ação:** Regenerar no painel do Supabase → Project Settings → API Keys

**Impacto:** Segurança crítica

## Importantes

### 3. Dados reais dos 6 pontos do Country Clube

**Status:** PENDING_DATA

Os 6 pontos têm `latitude`, `longitude`, `endereço`, `description` e `image_url` como **NULL** e `data_status = 'pending_data'`.

Pontos:
1. Esquinão
2. Rodelão
3. VN (Vilela Naegele)
4. Shopping
5. Jomps
6. Véu das Noivas

**Ação:** Cadastrar coordenadas GPS, endereços e fotos reais pelo **Painel admin** (`/admin`, conta oficial → Perfil → PAINEL ADMIN) — não precisa mais mexer em código

**Impacto:** "Informação aguardando cadastro" desaparecerá do app; pontos virarão clicáveis com detalhes

### 4. E2E automatizado (Playwright)

**Status:** NOT_TESTED

Dependência instalada, mas testes não foram escritos. Cobertura atual é integração + teste manual.

**Ação:** Escrever testes E2E com Playwright para fluxos completos

### 5. Teste de carga

**Status:** NOT_TESTED

Validar comportamento com 30–50 alunos simultâneos.

**Ferramentas sugeridas:** k6, Artillery

### 6. Responsividade em múltiplas larguras

**Status:** PARTIAL

Layout foi testado em 1 celular real (448px). Faltar verificar:
- 360px (celular pequeno)
- 390px (celular médio)
- 430px (celular grande)
- 768px+ (tablet)
- 1024px+ (desktop)

**Impacto:** Garantir que a PWA funciona bem em qualquer dispositivo

### 7. Resend / domínio próprio

**Status:** OPTIONAL

Atualmente:
- Sem `RESEND_API_KEY`: cancelamentos registram e-mail como `skipped`; aviso é feito só por WhatsApp
- Resend exige domínio verificado para enviar a qualquer destinatário

**Ação:** Configurar Resend com domínio próprio (opcional)

## Preparação para escalabilidade

### Novos bairros

A arquitetura está pronta. Basta:
1. Inserir em `neighborhoods` (ativo ou não)
2. Inserir em `pickup_points` com coordenadas
3. Telas listam do banco automaticamente

### Rotas compartilhadas entre bairros

`ride_pickup_points` já guarda `route_order`. Pontos podem ser compartilhados entre bairros sem mudar o modelo.

### WhatsApp Business/Cloud API

`notification_logs` já registra `channel` e `status`. Pronto para novo provedor sem mudanças estruturais.

---

**Veja também:** [[08 - Resultados]], [[03 - Requisitos]]
