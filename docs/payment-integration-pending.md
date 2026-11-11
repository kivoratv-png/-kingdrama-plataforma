# Ativação automática — pré-requisitos pendentes

Receptor publicado para cadastro na Lowify: `https://appkingdrama.netlify.app/.netlify/functions/lowify-webhook`.

## Contrato recebido do proprietário em 11/11/2026

O aviso é JSON com `event: sale.paid`, `status: paid`, `order_id`, `sale_amount`, `timestamp` (exemplo em horário brasileiro sem offset), `product.id` numérico e `customer.email`. A seleção de venda aprovada no painel controla o envio da Lowify, mas não autentica um POST recebido pela plataforma.

A migração `15-lowify-payments.sql` e o receptor implementam o processamento autenticado, sem ativá-lo por padrão: exigem hash de segredo previamente cadastrado no servidor e mapeamento explícito em `lowify_product_plans`. Não foram inventados IDs numéricos nem usado `42` do exemplo. O código do checkout não foi presumido como ID do aviso. O segredo pode ser enviado na URL (`?token=...`) ou por `Authorization: Bearer ...`; a disponibilidade de assinatura oficial da Lowify ainda precisa ser confirmada. Somente o hash SHA-256 de um segredo aleatório de 32 bytes deve ser persistido.

Com autenticação e mapeamento configurados, o receptor grava um registro privado por `order_id`, ativa a conta existente pelo mesmo e-mail e mantém compra anterior ao cadastro pendente. Após o cadastro com o mesmo e-mail, a compra é aplicada. Não cria senhas nem autentica clientes a partir do webhook. Produto desconhecido permanece pendente até ser mapeado, sem conceder plano. Renovações preservam dias existentes; a data inicial corresponde ao pagamento e períodos mensais usam meses do calendário brasileiro. Entregas idênticas não duplicam acesso ou indicações; dados conflitantes no mesmo pedido retornam 409. A rotina `lowify-retry` reconcilia pendências autenticadas a cada cinco minutos.

Pedidos originados na landing page seguem o mesmo processamento, desde que seus IDs de produto sejam mapeados. UTM e dados do afiliado não concedem assinatura nem substituem o vínculo de indicação já gravado no cadastro. Adicionais/order bumps exigem mapeamento próprio; não são tratados automaticamente como assinatura. As notificações de reembolso/chargeback ainda não foram fornecidas/configuradas e não estão conectadas.

Sem segredo, continua em modo de descoberta, sem ativação automática. GET informa esse estado; POST sem segredo aceita JSON ou formulário, persiste apenas a estrutura anonimizada e nomes de cabeçalhos relacionados à autenticação em uma tabela privada e confirma recebimento com HTTP 200. A captura de descoberta não guarda e-mails, telefones, valores ou segredos. Limite de 32 KB por envio e 40 estruturas distintas; estruturas antigas são removidas após sete dias na próxima captura. Nenhum evento recebido nesse modo comprova pagamento e não há reprocessamento automático posterior: os testes/vendas precisam ser reenviados após a integração autenticada ser habilitada.

Próximo passo: cadastrar a URL, enviar o teste da Lowify e confirmar o método oficial de autenticação. Não publicar este modo como liberação de planos concluída.

Os cards Lowify já têm os IDs e períodos corretos em `public/config/ofertas.json`: g18z8v semanal (7 dias), P3QfUF mensal (1 mês), ZPO7Gw trimestral (3 meses), LD4imo semestral (6 meses).

A integração de pagamento ainda não está ativa. Não há chaves Stripe/Lowify na configuração local nem uma conexão Stripe confirmada nesta sessão. O conector Stripe foi localizado e oferecido ao proprietário, mas não deve ser tratado como conectado até confirmação. Também falta saber se a Stripe terá checkout independente ou será somente processadora da Lowify, para evitar dupla ativação da mesma compra.

Necessário antes de implementar e ativar os webhooks:

1. Stripe: identificar a conta e os Price IDs dos quatro planos; configurar as credenciais de servidor e o segredo de assinatura do endpoint em armazenamento protegido; confirmar compra avulsa versus recorrência.
2. Lowify: obter documentação oficial ou exemplo anonimizado de evento e o mecanismo oficial de autenticação/validação. Documentação de Liqfy não é documentação de Lowify e não pode ser usada como contrato.
3. Implementar validação de origem do pagamento, idempotência por transação, identificação da conta e período do produto. A liberação não pode depender da página de retorno, de parâmetros editáveis ou apenas de um checkout aberto.
4. Preservar dias existentes e bônus nas renovações; adaptar o crédito de indicações para ambos os provedores e testar aprovação, repetição de eventos, vencimento e reembolso.

O perfil consulta a assinatura atualizada em `/api/me?atualizar=1` sempre que é aberto e mostra o nome do plano e “Expira em”/“Expirou em”. A data real precisa ser gravada pela futura integração; contas de cortesia sem data não devem ganhar um vencimento inventado.

Referência Stripe: https://docs.stripe.com/checkout/fulfillment e https://docs.stripe.com/webhooks/signature. O site oficial Lowify anuncia webhooks, mas a pesquisa pública não forneceu seu contrato de autenticação e payload: https://lowify.com.br/.
