# App de Caronas — Regras do Projeto

## Regra absoluta — ZERO API de LLM
- Não usar Anthropic API, OpenAI API, Agent SDK externo, Bedrock, Vertex AI ou qualquer chave de API de LLM.
- Proibido criar `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, chamadas HTTP para LLMs ou scripts externos de orquestração.
- A equipe multiagente usa **somente** os subagentes nativos do Claude Code em `.claude/agents/`.
- O agente principal/orquestrador deve rodar preferencialmente em **Claude Opus 5.5**.

## Equipe de subagentes

| Agente | Função | Modelo |
|---|---|---|
| `architect` | Arquitetura, Next.js/TS, Supabase/PostgreSQL, auth, RLS, segurança, regras de negócio, concorrência, reservas/vagas, integrações, debugging complexo | Claude Opus 5.5 |
| `auditor` | Auditoria independente e somente leitura (PASS / FAIL / PARTIAL / NOT_TESTED) | Claude Opus 5.5 |
| `qa` | Execução, build/lint, testes unitários/integração, Playwright/E2E, mobile/PWA | Claude Sonnet 5 |
| `designer` | UX/UI, mobile-first, Tailwind, acessibilidade, estados visuais, PWA | Claude Sonnet 5 |
| `docs` | README, docs técnicos, Obsidian, Mermaid, changelog, commits | Claude Haiku 4.5 |
| `tcc` | Redação acadêmica do TCC baseada no que foi implementado | Claude Opus 5.5 |

## Fluxo para funcionalidades grandes
```text
ARCHITECT → IMPLEMENTAÇÃO → DESIGNER → REVISÃO VISUAL → QA → TESTES → AUDITOR → VALIDAÇÃO
```

Se houver falha:
```text
QA / AUDITOR → ARCHITECT → CORREÇÃO → QA → RETESTE → AUDITOR
```

Após aprovação:
```text
DOCS → DOCUMENTAÇÃO → TCC
```

## Quando usar subagentes
- Use subagentes quando as tarefas puderem rodar em paralelo, precisarem de contexto isolado ou forem realmente independentes.
- Para tarefas simples, alterações em um único arquivo ou operações sequenciais, trabalhe diretamente.
- Evite dois agentes editando os mesmos arquivos ao mesmo tempo.
- `qa` retorna `ESCALATE_TO_ARCHITECT` após duas falhas ou em problemas de arquitetura, RLS, auth, banco, concorrência ou segurança.
- `designer` não altera banco, migrations, auth, RLS, APIs críticas, reservas, concorrência ou regras de negócio — devolve ao `architect`.
- `auditor` não corrige código; apenas aponta problemas.

## Regra de qualidade
```text
IMPLEMENTAR → EXECUTAR → TESTAR → AUDITAR → CORRIGIR → RETESTAR
```

Uma feature só é `DONE` quando:
1. existe;
2. compila;
3. foi executada;
4. passou por testes relevantes;
5. não possui bloqueador crítico na auditoria;
6. teve a documentação pertinente atualizada.

## Git e segredos
- Nunca versionar secrets (`.env*` está no `.gitignore`).
- Não apagar histórico existente.

@AGENTS.md
