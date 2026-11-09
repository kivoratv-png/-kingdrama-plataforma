-- ============================================================================
-- Libera o acesso de uma conta, sem passar pelo pagamento.
--
-- Use enquanto o gateway não está ligado, para você e para quem comprar por
-- fora (Pix na mão, por exemplo). Quando o pagamento entrar, quem escreve
-- nesta tabela é o webhook — e aí este arquivo vira só uma ferramenta de
-- suporte, para resolver caso a caso.
--
-- Troque o e-mail da linha abaixo e rode no SQL Editor.
-- ============================================================================

insert into public.subscriptions (user_id, status, plan, provider, started_at, ends_at)
select u.id, 'active', 'cortesia', 'manual', now(), null   -- ends_at null = sem prazo
from auth.users u
where u.email = 'kivoratv@gmail.com'
on conflict do nothing;

-- Confere quem está com acesso ativo agora
select u.email,
       s.status,
       s.plan,
       coalesce(to_char(s.ends_at, 'DD/MM/YYYY'), 'sem prazo') as vence_em
from public.subscriptions s
join auth.users u on u.id = s.user_id
order by s.updated_at desc;


-- ----------------------------------------------------------------------------
-- TIRAR o acesso de alguém (cancelamento, reembolso, teste encerrado):
--
--   update public.subscriptions s
--      set status = 'canceled', updated_at = now()
--     from auth.users u
--    where u.id = s.user_id and u.email = 'pessoa@exemplo.com';
--
-- DAR acesso por tempo limitado (30 dias, por exemplo): troque o ends_at
-- do insert por  now() + interval '30 days'.
-- ----------------------------------------------------------------------------
