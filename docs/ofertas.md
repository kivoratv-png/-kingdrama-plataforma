# Ofertas Lowify

Configuração pública dos cards: `public/config/ofertas.json`. Valores totais consultados nos checkouts em 11/11/2026:

| Produto | Período | Total |
| --- | --- | --- |
| g18z8v | Semanal, 7 dias | Indisponível (HTTP 404); card desabilitado |
| P3QfUF | Mensal, 1 mês | R$ 24,90 |
| ZPO7Gw | Trimestral, 3 meses | R$ 79,90 |
| LD4imo | Semestral, 6 meses | R$ 129,90 |

O checkout externo abre em outra aba. O cliente deve usar o e-mail da conta. Não há confirmação de compra por parâmetros de URL ou armazenamento do navegador. A intenção local apenas inicia consultas ao estado real da própria assinatura ao retornar à página. O botão “Já paguei” força uma consulta atualizada ao banco.

A integração de confirmação de pagamentos Lowify ainda precisa ser configurada. Publicar os cards não configura essa integração. O servidor deverá validar a confirmação, identificar a conta e o produto, registrar o pagamento sem duplicidade e definir o período correspondente. Somente depois da ativação real a consulta libera o episódio. Não reutilizar os períodos antigos (ZPO7Gw semestral / LD4imo anual).

Não foram definidos benefícios diferentes por duração: os cards apresentam o acesso atual, com um dispositivo conectado por vez. Não anunciam descontos, solicitações ilimitadas ou múltiplos dispositivos.
