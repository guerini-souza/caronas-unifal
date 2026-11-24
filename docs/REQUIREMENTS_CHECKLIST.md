# Checklist de requisitos

Atualizado em 23/09/2026. Evidências em [TEST_REPORT.md](TEST_REPORT.md).
**PASS** só quando executado; o resto é PARTIAL/NOT_TESTED/FAIL.

## Check final

| Item | Status | Evidência |
|---|---|---|
| Aplicação inicia | PASS | Produção respondendo 200 |
| Build | PASS | `npm run build` |
| Login | PASS | Teste manual no celular |
| Verificação de e-mail | PASS | SMTP próprio (Gmail do app); cadastro com e-mail externo confirmado |
| Perfil | PASS | Teste manual |
| Veículo | PASS | Teste manual + integração |
| Oferecer carona | PASS | Teste manual + integração |
| Seleção de pontos | PASS | Teste manual (3 pontos em ordem) + integração |
| Buscar carona | PASS | Integração + teste manual após correção |
| Reserva | PASS | Integração + teste manual com 2 usuários (ida e volta) |
| Controle de vagas | PASS | Integração: 10 pedidos simultâneos → 1 reserva; devolução de vaga |
| WhatsApp | PASS | Testes unitários + abertura real no celular com mensagem de ida/volta |
| Cancelamento passageiro | PASS | Integração |
| Cancelamento motorista | PASS | Integração + teste manual |
| Pontos para bixetes | PASS | Produção; dados reais dos pontos pendentes |
| Painel admin | PARTIAL | Integração (permissões, foto, completo automático); falta uso real no celular pela conta oficial |
| Link da carona (WhatsApp) | PARTIAL | Integração + produção (prévia, redirecionamento, cartão `og`); falta abrir pelo WhatsApp num celular |
| INICIEI A ROTA / ESTOU NO LOCAL | PARTIAL | Integração (permissões, janela, uma vez só) + telas em produção; falta uso real |
| Notificações e lembrete de 10 min | PARTIAL | Agendamento real disparou em produção; falta receber no celular (Android e iPhone instalado) |
| PWA | PASS | Manifest, ícones, service worker e instalação vistos no celular |
| Mobile | PARTIAL | 1 celular real; larguras 360/390/430/tablet/desktop não verificadas |
| Banco | PASS | 6 migrations aplicadas; integração 85/85 |
| RLS | PASS | Integração (perfil, veículo, reserva, carona alheios bloqueados) |
| Testes | PARTIAL | Unitários + integração + carga OK; E2E Playwright não feito |
| README | PASS | `README.md` |
| Obsidian | PASS | `obsidian/` |
| Git organizado | PASS | Commits por tema no repositório `caronasunifal/app-caronas` |

## Requisitos detalhados

```text
[PASS] Login com e-mail e senha
[PASS] Verificação de e-mail (SMTP próprio via Gmail)
[PASS] Usuário não verificado sem acesso (Supabase não emite sessão + assert_ready_user no banco)
[PASS] Esqueci minha senha (implementado; NOT_TESTED manualmente)
[PASS] Primeiro acesso: nome, telefone/WhatsApp, bairro, e-mail do login
[PASS] Tela inicial com PEGAR, OFERECER e PONTOS PARA BIXETES
[PASS] Veículo: modelo, cor, placa; reutilizável e editável
[PASS] Wizard oferecer: sentido → horário → bairro → pontos → vagas [-] N [+] (mín. 1) → preço → resumo
[PASS] Carona criada com status OPEN
[PASS] Sentido IDA/VOLTA como primeira escolha (oferecer e pegar)
[PASS] Wizard pegar: sentido → dia/horário → bairro → ponto → caronas
[PASS] Card: horário, preço, vagas restantes, 1º nome, veículo, cor, pontos, placa mascarada
[PASS] Reserva transacional sem overbooking
[PASS] WhatsApp wa.me com mensagem por período e por sentido (ida/volta)
[PASS] Pagamento fora do app (sem gateway)
[PASS] Minhas reservas + CANCELAR CARONA (status, vaga, data/hora)
[PASS] Cancelamento pelo motorista: status, reservas invalidadas, afetados, WhatsApp
[PARTIAL] E-mail de cancelamento via Resend (implementado; sem credenciais → "skipped")
[PASS] Pontos para bixetes com "Informação aguardando cadastro" (sem dados inventados)
[PASS] Seed: Country Clube + 6 pontos com NULL/pending_data
[PASS] Painel admin (só conta oficial): bairros, pontos, foto, endereço, observações, localização, ordem, ocultar
[PARTIAL] Link compartilhável da carona pelo WhatsApp, levando direto à carona (falta teste no celular)
[PARTIAL] INICIEI A ROTA avisa os passageiros; ESTOU NO LOCAL avisa o motorista; WhatsApp de reserva (falta teste no celular)
[PARTIAL] Notificação ao motorista 10 min antes, abrindo a carona no INICIEI A ROTA (agendamento testado; falta receber no celular)
[PASS] PWA instalável com INSTALAR APP e instruções Android/iOS
[PASS] Segurança: proteção de rotas, validação server-side, RLS, secrets fora do código
[PASS] Arquitetura preparada para outros bairros e rotas compartilhadas
[NOT_TESTED] E2E Playwright
[PASS] Teste de carga (30–50 alunos simultâneos): 200 buscando e 60 buscando/reservando com oferta junto, 0 erros, sem overbooking
[PASS] README, docs, Obsidian
```

Nenhum requisito crítico em **FAIL**.
