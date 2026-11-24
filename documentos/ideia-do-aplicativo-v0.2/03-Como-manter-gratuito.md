# Como manter gratuito

**O plano é pagar o domínio e começar com os demais serviços gratuitos.** Domínio é o endereço do site, como um nome terminado em .com.br. Ele tem custo de registro e renovação.

## O que vamos usar?

| Necessidade | Solução, em palavras simples | Custo inicial previsto |
|---|---|---|
| Endereço do site | Domínio próprio, escolhido para o projeto | Pago; cotar registro e renovação |
| Deixar o site disponível | Cloudflare: serviço onde publicamos o site | Plano gratuito |
| Guardar contas, caronas e reservas | Supabase: serviço que cuida do acesso e dessas informações | Plano gratuito |
| Confirmar e-mail e recuperar senha | Resend: serviço que envia esses e-mails | Plano gratuito, dentro da cota |
| Mostrar o encontro e seguir o caminho | Abrir Maps ou Waze por um link | Sem contratar serviço de mapas para o app |
| Conversar depois da reserva | Abrir o WhatsApp com texto pronto | Sem contratar envio automático de mensagens |

Fontes dos planos: [Cloudflare](https://developers.cloudflare.com/pages/functions/pricing/), [Supabase](https://supabase.com/pricing) e [Resend](https://resend.com/docs/knowledge-base/account-quotas-and-limits).

## Como o e-mail fica gratuito?

O Resend oferece uma cota de **3.000 e-mails por mês, com limite de 100 por dia**. Ela será usada para confirmação de cadastro, reenvios e recuperação de senha. Entrar com senha não exige enviar um e-mail a cada acesso.

Para enviar aos alunos, configuramos o remetente usando o domínio comprado. Não é necessário contratar uma caixa de e-mail paga apenas para esses envios. [Domínio e remetente no Resend](https://resend.com/docs/dashboard/domains/introduction).

O público informado é de até cerca de 1.500 alunos. Ter 1.500 contas não significa enviar 1.500 e-mails por dia. Começaremos com um grupo pequeno e acompanharemos o uso, principalmente no lançamento.

## Por que essa versão custa menos?

- Construímos um único site que funciona no celular e no computador.
- Usamos ferramentas gratuitas para desenvolver o aplicativo.
- O Maps e o Waze fazem a navegação quando a pessoa abre o link.
- A conversa e o pagamento acontecem diretamente entre os alunos.

## O que pode gerar gasto depois?

Os planos gratuitos têm limites. Se o uso crescer além deles, vamos ajustar o funcionamento ou comparar alternativas antes de contratar algo. O objetivo inicial é **R$ 0 por mês nesses serviços, além do domínio**. Envio pago só será avaliado se necessário e com preço que faça sentido para o projeto.

Condições consultadas em 14/09/2026. Hospedagem, banco e e-mail devem ser acompanhados durante o uso; a gratuidade depende dos limites e das condições dos provedores.
