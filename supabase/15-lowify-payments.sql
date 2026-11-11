begin;
create table if not exists public.lowify_webhook_credentials (
 id integer primary key check(id=1),token_hash text not null check(token_hash ~ '^[a-f0-9]{64}$')
);
create table if not exists public.lowify_product_plans (
 product_id text primary key check(length(product_id) between 1 and 100),
 plan_code text not null check(plan_code in('weekly','monthly','quarterly','semiannual'))
);
-- No product mapping is guessed from example IDs, prices, names, or UTMs.
create table if not exists public.lowify_paid_orders (
 order_id text primary key check(length(order_id) between 1 and 200),
 product_id text not null check(length(product_id) between 1 and 100),
 customer_email text not null check(length(customer_email) between 3 and 254),
 paid_at timestamptz not null,amount numeric(14,2) not null check(amount>0),
 state text not null default 'pending_product' check(state in('pending_product','pending_account','applied')),
 subscription_id bigint references public.subscriptions(id) on delete set null,
 user_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),applied_at timestamptz
);
create index if not exists lowify_orders_email_pending on public.lowify_paid_orders(customer_email,paid_at) where state<>'applied';
alter table public.lowify_webhook_credentials enable row level security;
alter table public.lowify_product_plans enable row level security;
alter table public.lowify_paid_orders enable row level security;
revoke all on public.lowify_webhook_credentials,public.lowify_product_plans,public.lowify_paid_orders from public,anon,authenticated;
grant select on public.lowify_webhook_credentials,public.lowify_product_plans,public.lowify_paid_orders to service_role;

create or replace function public.apply_lowify_paid_order(p_order_id text) returns text
language plpgsql security definer set search_path='' as $$
declare payment public.lowify_paid_orders%rowtype; plan text; buyer uuid;
 previous public.subscriptions%rowtype; base_date timestamptz; end_date timestamptz; sid bigint;
begin
 -- Serialize paid renewals and deferred registration claims, including repeated deliveries.
 perform pg_advisory_xact_lock(hashtextextended('lowify-paid-application',31));
 select * into payment from public.lowify_paid_orders where order_id=p_order_id for update;
 if not found then raise exception 'Order not recorded';end if;
 if payment.state='applied' then return 'applied';end if;
 select plan_code into plan from public.lowify_product_plans where product_id=payment.product_id;
 if plan is null then
  update public.lowify_paid_orders set state='pending_product' where order_id=p_order_id;
  return 'pending_product';
 end if;
 -- Never match by editable name, WhatsApp, affiliate or UTM parameters.
 if (select count(*) from auth.users where lower(email)=payment.customer_email)<>1 then
  update public.lowify_paid_orders set state='pending_account' where order_id=p_order_id;
  return 'pending_account';
 end if;
 select id into buyer from auth.users where lower(email)=payment.customer_email;
 select * into previous from public.subscriptions where user_id=buyer
  order by updated_at desc,id desc limit 1 for update;
 base_date:=payment.paid_at;
 if previous.status='active' and previous.ends_at>base_date then base_date:=previous.ends_at;end if;
 -- Monthly terms use the Brazilian calendar, including end-of-month clamping.
 end_date:=case plan when 'weekly' then base_date+interval '7 days'
  when 'monthly' then ((base_date at time zone 'America/Sao_Paulo')+interval '1 month') at time zone 'America/Sao_Paulo'
  when 'quarterly' then ((base_date at time zone 'America/Sao_Paulo')+interval '3 months') at time zone 'America/Sao_Paulo'
  when 'semiannual' then ((base_date at time zone 'America/Sao_Paulo')+interval '6 months') at time zone 'America/Sao_Paulo' end;
 insert into public.subscriptions(user_id,status,plan,provider,provider_ref,started_at,ends_at,payment_confirmed_at)
 values(buyer,case when end_date>now() then 'active' else 'expired' end,plan,'lowify',payment.order_id,payment.paid_at,end_date,payment.paid_at)
 returning id into sid;
 update public.lowify_paid_orders set state='applied',subscription_id=sid,user_id=buyer,applied_at=now() where order_id=p_order_id;
 return 'applied';
end;$$;

create or replace function public.receive_lowify_paid_order(p_token_hash text,p_order jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare oid text;pid text;email text;paid timestamptz;amount numeric;old public.lowify_paid_orders%rowtype;result text;
begin
 if not exists(select 1 from public.lowify_webhook_credentials where id=1 and token_hash=p_token_hash) then
  return jsonb_build_object('state','unauthorized');
 end if;
 if p_order->>'event' is distinct from 'sale.paid' or p_order->>'status' is distinct from 'paid' then return jsonb_build_object('state','ignored');end if;
 oid:=p_order->>'order_id';pid:=p_order->>'product_id';email:=lower(trim(p_order->>'email'));
 if oid is null or length(oid) not between 1 and 200 or pid is null or length(pid) not between 1 and 100
  or email is null or length(email)>254 or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
  return jsonb_build_object('state','invalid');
 end if;
 begin paid:=(p_order->>'paid_at')::timestamptz;amount:=(p_order->>'amount')::numeric;
 exception when others then return jsonb_build_object('state','invalid');end;
 if paid is null or paid>now()+interval '5 minutes' or amount is null or amount<=0 or amount>999999999999.99 then return jsonb_build_object('state','invalid');end if;
 perform pg_advisory_xact_lock(hashtextextended('lowify-paid-application',31));
 insert into public.lowify_paid_orders(order_id,product_id,customer_email,paid_at,amount)
 values(oid,pid,email,paid,amount) on conflict(order_id) do nothing;
 select * into old from public.lowify_paid_orders where order_id=oid for update;
 if old.product_id<>pid or old.customer_email<>email or old.amount<>round(amount,2) then
  return jsonb_build_object('state','conflict');
 end if;
 result:=public.apply_lowify_paid_order(oid);
 return jsonb_build_object('state',result);
end;$$;

create or replace function public.claim_lowify_orders_after_signup() returns trigger
language plpgsql security definer set search_path='' as $$
declare payment record;
begin
 for payment in select order_id from public.lowify_paid_orders
  where customer_email=lower(new.email) and state<>'applied' order by paid_at,order_id loop
  perform public.apply_lowify_paid_order(payment.order_id);
 end loop;
 return new;
end;$$;
drop trigger if exists zz_claim_lowify_orders on auth.users;
create trigger zz_claim_lowify_orders after insert on auth.users for each row execute function public.claim_lowify_orders_after_signup();

create or replace function public.retry_lowify_paid_orders() returns jsonb
language plpgsql security definer set search_path='' as $$
declare payment record;processed integer:=0;failed integer:=0;
begin
 for payment in select o.order_id from public.lowify_paid_orders o
  join public.lowify_product_plans p on p.product_id=o.product_id
  where o.state<>'applied' and exists(select 1 from auth.users u where lower(u.email)=o.customer_email)
  order by o.paid_at,o.order_id limit 20 loop
  begin perform public.apply_lowify_paid_order(payment.order_id);processed:=processed+1;
  exception when others then failed:=failed+1;end;
 end loop;
 return jsonb_build_object('processed',processed,'failed',failed);
end;$$;
revoke all on function public.apply_lowify_paid_order(text),public.receive_lowify_paid_order(text,jsonb),public.claim_lowify_orders_after_signup(),public.retry_lowify_paid_orders() from public,anon,authenticated;
grant execute on function public.receive_lowify_paid_order(text,jsonb),public.retry_lowify_paid_orders() to service_role;
commit;
