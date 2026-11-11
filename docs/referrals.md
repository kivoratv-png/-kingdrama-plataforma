# Indicações

Cada conta pode visualizar `/indicacoes`. Somente uma assinatura ativa permite criar ou consultar o código pessoal. A consulta pública do painel de indicações nunca gera códigos. O mesmo assinante recebe sempre o mesmo código.

O link `/cadastro?ref=CODIGO` agora inclui UTMs de indicação. Links antigos continuam válidos; `utm_source=indicacao&utm_content=CODIGO` também identifica um convite. O navegador guarda o convite por até 30 dias e envia o código no cadastro. O trigger `capture_referral_signup` valida o código e a assinatura de quem indicou durante a criação da conta. O vínculo entre as duas contas fica no banco, é privado e não pode ser modificado pelo cliente posteriormente. Um link inválido não impede o cadastro, mas não gera indicação.

Os contadores usam exclusivamente o histórico de recompensas. Um cadastro sem pagamento não aumenta nenhum contador e não libera dias.

## Integração Lowify pendente

Não existe endpoint público que conceda dias e nenhum webhook Lowify foi ativado nesta mudança. A confirmação automática continua pendente da documentação e das credenciais oficiais.

Depois de implementar e autenticar o webhook, o servidor deverá:

1. Verificar o evento com o mecanismo oficial da Lowify e, quando disponível, consultar a transação na API.
2. Validar status aprovado, produto, valor, moeda e vínculo da compra com a conta cadastrada. QR gerado, comprovante e parâmetros da URL nunca são confirmação.
3. Registrar a assinatura paga do comprador, com `provider='lowify'` e `provider_ref` igual ao ID do pagamento aprovado. Definir os períodos mensal/semestral/anual com as regras de calendário acertadas na integração.
4. Registrar `payment_confirmed_at` com a data real de aprovação, quando disponível. Não chamar uma função de recompensa separada: o banco processa a indicação automaticamente ao inserir ou atualizar a assinatura ativa por pagamento Lowify.
5. Atualizar o estado do comprador e do indicador na interface.

## Ativação e recompensa automáticas

O trigger `on_paid_subscription_referral` já está ativo no banco. Ele considera somente `status='active'`, `provider='lowify'`, ID de pagamento em `provider_ref`, prazo ainda válido e plano sem marcação de cortesia/teste/bônus. Os clientes não podem alterar assinaturas ou criar trabalhos na fila. Assim, apenas a ativação paga registrada por um servidor autorizado pode conceder dias.

A ativação cria uma tarefa privada em `referral_activation_jobs` e tenta processá-la imediatamente. Um erro de recompensa não desfaz a ativação paga do comprador. A função agendada `referrals-retry` tenta novamente a cada cinco minutos, até dez tentativas automáticas; depois disso a tarefa fica registrada para revisão. O servidor pode repetir `process_referral_activation(job_id)` após corrigir a causa. Não há dados pessoais nos contadores públicos.

A função de crédito bloqueia duplicatas por pagamento e por amigo e registra a recompensa junto à extensão da assinatura na mesma transação. Adiciona 10 dias ao vencimento vigente; se a assinatura já venceu, conta a partir do momento do crédito. Planos sem vencimento mantêm seu prazo ilimitado, com a recompensa registrada nos contadores. Extensões por bônus não geram recompensas em cadeia.

`/indicacoes` atualiza os contadores a cada quinze segundos enquanto estiver visível. O assinante também pode atualizar manualmente. O vínculo persiste se o amigo pagar em outra sessão ou dispositivo, desde que a compra ative a mesma conta.

Renovações futuras precisam preservar os dias extras já concedidos. Tratamento de reembolsos, estornos e eventual reversão das recompensas deve ser conectado junto com os eventos oficiais da Lowify antes de ativar a confirmação automática. Não ativar eventos ou conceder benefícios a partir de um webhook sem validação.
