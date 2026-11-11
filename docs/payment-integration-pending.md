# Ativação automática — pré-requisitos pendentes

Os cards Lowify já têm os IDs e períodos corretos em `public/config/ofertas.json`: g18z8v semanal (7 dias), P3QfUF mensal (1 mês), ZPO7Gw trimestral (3 meses), LD4imo semestral (6 meses).

A integração de pagamento ainda não está ativa. Não há chaves Stripe/Lowify na configuração local nem uma conexão Stripe confirmada nesta sessão. O conector Stripe foi localizado e oferecido ao proprietário, mas não deve ser tratado como conectado até confirmação. Também falta saber se a Stripe terá checkout independente ou será somente processadora da Lowify, para evitar dupla ativação da mesma compra.

Necessário antes de implementar e ativar os webhooks:

1. Stripe: identificar a conta e os Price IDs dos quatro planos; configurar as credenciais de servidor e o segredo de assinatura do endpoint em armazenamento protegido; confirmar compra avulsa versus recorrência.
2. Lowify: obter documentação oficial ou exemplo anonimizado de evento e o mecanismo oficial de autenticação/validação. Documentação de Liqfy não é documentação de Lowify e não pode ser usada como contrato.
3. Implementar validação de origem do pagamento, idempotência por transação, identificação da conta e período do produto. A liberação não pode depender da página de retorno, de parâmetros editáveis ou apenas de um checkout aberto.
4. Preservar dias existentes e bônus nas renovações; adaptar o crédito de indicações para ambos os provedores e testar aprovação, repetição de eventos, vencimento e reembolso.

O perfil consulta a assinatura atualizada em `/api/me?atualizar=1` sempre que é aberto e mostra o nome do plano e “Expira em”/“Expirou em”. A data real precisa ser gravada pela futura integração; contas de cortesia sem data não devem ganhar um vencimento inventado.

Referência Stripe: https://docs.stripe.com/checkout/fulfillment e https://docs.stripe.com/webhooks/signature. O site oficial Lowify anuncia webhooks, mas a pesquisa pública não forneceu seu contrato de autenticação e payload: https://lowify.com.br/.
