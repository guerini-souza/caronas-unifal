# Plano do projeto

## Método

Ciclo obrigatório em cada funcionalidade:

```text
IMPLEMENTAR → EXECUTAR → TESTAR → AUDITAR → CORRIGIR → RETESTAR
```

Equipe de agentes do Claude Code (`.claude/agents/`): **architect** (arquitetura, banco, segurança),
**designer** (UX/UI), **qa** (testes), **auditor** (revisão independente, somente leitura),
**docs** (documentação) e **tcc** (texto acadêmico). Nenhuma API de LLM externa é usada.

## Etapas

| # | Etapa | Status |
|---|---|---|
| 1 | Configuração dos agentes e regras (`CLAUDE.md`) | Concluída |
| 2 | Projeto Next.js + Tailwind + Supabase | Concluída |
| 3 | Banco: tabelas, RLS, funções transacionais, seed | Concluída |
| 4 | Autenticação, confirmação de e-mail, "esqueci minha senha" | Concluída (SMTP próprio pendente) |
| 5 | Perfil e veículo | Concluída |
| 6 | Oferecer carona (wizard) | Concluída |
| 7 | Pegar carona com escolha de dia/horário | Concluída |
| 8 | Reserva sem overbooking + WhatsApp | Concluída (teste manual com 2 usuários pendente) |
| 9 | Cancelamentos (passageiro e motorista) | Concluída |
| 10 | Pontos para bixetes | Concluída (dados reais pendentes) |
| 11 | PWA (manifest, ícones, service worker, aviso de instalação) | Concluída |
| 12 | Revisão de design e auditoria de segurança | Concluída; achados corrigidos |
| 13 | Testes (unitários + integração no banco real) | Concluída; E2E e carga pendentes |
| 14 | Contas web dedicadas (GitHub, Supabase, Vercel) e deploy | Concluída |
| 15 | Documentação (README, docs, Obsidian, TCC) | Concluída |
| 16 | SMTP próprio (Gmail do app) | **Próxima** |
| 17 | Trocar chave secreta do Supabase | **Próxima** |

## Próximas evoluções (depois do MVP)

- Cadastro dos dados reais dos pontos (endereço, foto, coordenadas) e mapa.
- Novos bairros e rotas compartilhadas por pontos em comum.
- Testes E2E (Playwright) e teste de carga para 30–50 alunos simultâneos.
- Encerramento automático de caronas vencidas (`COMPLETED`).
- Domínio próprio e e-mail de aviso via Resend com domínio verificado.
- Integração oficial com WhatsApp Business/Cloud API (se houver orçamento).
