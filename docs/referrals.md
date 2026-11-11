# Indicações

Cada conta pode visualizar `/indicacoes`. Somente uma assinatura ativa permite criar ou consultar o código pessoal. A consulta pública do painel de indicações nunca gera códigos. O mesmo assinante recebe sempre o mesmo código.

O link `/cadastro?ref=CODIGO` guarda o convite no navegador por até 30 dias e envia o código no cadastro. O trigger `capture_referral_signup` valida o código e a assinatura de quem indicou durante a criação da conta. O vínculo é privado e não pode ser modificado pelo cliente posteriormente. Um link inválido não impede o cadastro, mas não gera indicação.

Os contadores usam exclusivamente o histórico de recompensas. Um cadastro sem pagamento não aumenta nenhum contador e não libera dias.

## Integração Lowify pendente

Não existe endpoint público que conceda dias e nenhum webhook Lowify foi ativado nesta mudança. A confirmação automática continua pendente da documentação e das credenciais oficiais.

Depois de implementar e autenticar o webhook, o servidor deverá:

1. Verificar o evento com o mecanismo oficial da Lowify e, quando disponível, consultar a transação na API.
2. Validar status aprovado, produto, valor, moeda e vínculo da compra com a conta cadastrada. QR gerado, comprovante e parâmetros da URL nunca são confirmação.
3. Registrar a assinatura paga do comprador, com `provider='lowify'` e `provider_ref` igual ao ID do pagamento aprovado. Definir os períodos mensal/semestral/anual com as regras de calendário acertadas na integração.
4. Chamar `credit_referral_payment(payment_id, buyer_id, subscription_id, paid_at)` exclusivamente com a chave de serviço, após as validações anteriores.
5. Atualizar o estado do comprador e do indicador na interface.

A função aceita apenas assinaturas confirmadas registradas no servidor, bloqueia crédito duplicado por pagamento e por amigo e registra a recompensa junto à extensão da assinatura na mesma transação. Adiciona 10 dias ao vencimento vigente; se a assinatura já venceu, conta a partir do momento do crédito. Planos sem vencimento mantêm seu prazo ilimitado, com a recompensa registrada nos contadores.

Renovações futuras precisam preservar os dias extras já concedidos. Tratamento de reembolsos, estornos e eventual reversão das recompensas deve ser conectado junto com os eventos oficiais da Lowify antes de ativar a confirmação automática. Não ativar eventos ou conceder benefícios a partir de um webhook sem validação.
