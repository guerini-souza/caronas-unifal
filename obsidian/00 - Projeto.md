---
tags: projeto, overview, caronas
data: 2026-09-23
---

# Caronas UNIFAL

Web App/PWA de caronas universitárias. Organiza um processo que hoje acontece de forma informal.

**Status:** MVP no ar (https://app-caronas-seven.vercel.app)

## Descrição

- **Motorista:** publica horário, vagas, pontos e preço
- **Passageiro:** escolhe bairro, ponto e horário, reserva a vaga, comunica pelo WhatsApp
- **Bairro inicial:** Country Clube, Poços de Caldas
- **Segurança:** transações no banco, sem overbooking

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Backend | Server Actions + Proxy do Next.js (Zod) |
| Banco/Auth | Supabase (PostgreSQL, Auth, RLS, RPC) |
| E-mail | Resend (opcional) |
| Hospedagem | Vercel (gru1 — São Paulo) |
| Testes | Vitest + script de integração |

## Índice de notas

- [[01 - Problema]] — contexto do problema
- [[02 - Objetivos]] — metas do projeto
- [[03 - Requisitos]] — funcionais e não funcionais
- [[04 - Arquitetura]] — diagrama e decisões
- [[05 - Banco de Dados]] — modelo e segurança
- [[06 - Fluxos]] — sequência de ações
- [[07 - Testes]] — números e cobertura
- [[08 - Resultados]] — o que está validado
- [[09 - Pendências]] — itens não concluídos
