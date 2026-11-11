# Ofertas Lowify

Configuração pública dos cards: `public/config/ofertas.json`. Valores totais consultados nos checkouts em 11/11/2026:

| Produto | Período | Total |
| --- | --- | --- |
| g18z8v | Semanal, 7 dias | R$ 14,99 |
| P3QfUF | Mensal, 1 mês | R$ 24,90 |
| ZPO7Gw | Trimestral, 3 meses | R$ 79,90 |
| LD4imo | Semestral, 6 meses | R$ 129,90 |

O checkout externo abre em outra aba. O cliente deve usar o e-mail da conta. Não há confirmação de compra por parâmetros de URL ou armazenamento do navegador. A intenção local apenas inicia consultas ao estado real da própria assinatura ao retornar à página. O botão “Já paguei” força uma consulta atualizada ao banco.

A integração de confirmação de pagamentos Lowify ainda precisa ser configurada. Publicar os cards não configura essa integração. O servidor deverá validar a confirmação, identificar a conta e o produto, registrar o pagamento sem duplicidade e definir o período correspondente. Somente depois da ativação real a consulta libera o episódio. Não reutilizar os períodos antigos (ZPO7Gw semestral / LD4imo anual).

Semanal e mensal permitem um dispositivo conectado por vez. Trimestral e semestral permitem até três. A migração `13-plan-requests.sql` aplica esses limites no servidor, inclusive após vencimento ou mudança do plano. Os cards apresentam o limite correspondente.

Cada conta pode enviar dois pedidos de doramas, independentemente da duração da assinatura. O adicional de pedidos ilimitados é separado dos planos; só é liberado por uma concessão com validade no servidor. O botão de interesse ainda direciona ao suporte, sem cobrança ou ativação automática. A compra do adicional depende da configuração do produto e da integração de pagamentos.

O botão principal Pedir Dorama abre uma janela com formulário e acompanhamento, preservando a página atual. O banner abre a mesma janela. Links antigos para `/pedidos` abrem a janela sobre o início. O perfil não contém esse atalho.
