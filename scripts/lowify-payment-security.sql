begin;
-- Isolated fixtures are rolled back, including temporary credentials/product mappings.
insert into public.lowify_webhook_credentials values(1,repeat('a',64)) on conflict(id) do update set token_hash=excluded.token_hash;
insert into public.lowify_product_plans values('__test_monthly','monthly'),('__test_quarterly','quarterly'),('__test_weekly','weekly'),('__test_semiannual','semiannual');
insert into auth.users(id,email) values('10000000-0000-4000-8000-000000000081','lowify-existing@example.invalid');
set local role service_role;
do $$declare result jsonb;paid text:=(now()-interval '1 minute')::text;before_count integer;before_end timestamptz;after_end timestamptz;
 item jsonb:=jsonb_build_object('event','sale.paid','status','paid','order_id','__lowify_test_first','product_id','__test_monthly','email','LOWIFY-EXISTING@example.invalid','amount',24.90,'paid_at',paid);
begin
 select count(*) into before_count from public.subscriptions where user_id='10000000-0000-4000-8000-000000000081';
 result:=public.receive_lowify_paid_order(repeat('b',64),item);
 if result->>'state'<>'unauthorized' then raise exception 'Invalid token accepted';end if;
 if exists(select 1 from public.lowify_paid_orders where order_id='__lowify_test_first') then raise exception 'Untrusted order stored';end if;
 result:=public.receive_lowify_paid_order(repeat('a',64),item);
 if result->>'state'<>'applied' then raise exception 'Existing account not activated: %',result;end if;
 if (select count(*) from public.subscriptions where user_id='10000000-0000-4000-8000-000000000081')<>before_count+1 then raise exception 'Subscription missing';end if;
 select ends_at into before_end from public.subscriptions where provider_ref='__lowify_test_first';
 if before_end<>(((paid::timestamptz at time zone 'America/Sao_Paulo')+interval '1 month') at time zone 'America/Sao_Paulo') then raise exception 'Monthly expiry incorrect';end if;
 perform public.receive_lowify_paid_order(repeat('a',64),item);
 if (select count(*) from public.subscriptions where provider_ref='__lowify_test_first')<>1 then raise exception 'Duplicate sale credited twice';end if;
 result:=public.receive_lowify_paid_order(repeat('a',64),item||'{"product_id":"__test_quarterly"}'::jsonb);
 if result->>'state'<>'conflict' then raise exception 'Conflicting duplicate accepted';end if;
 perform public.receive_lowify_paid_order(repeat('a',64),item||'{"order_id":"__lowify_test_second","product_id":"__test_quarterly"}'::jsonb);
 select ends_at into after_end from public.subscriptions where provider_ref='__lowify_test_second';
 if after_end<>(((before_end at time zone 'America/Sao_Paulo')+interval '3 months') at time zone 'America/Sao_Paulo') then raise exception 'Renewal lost remaining days';end if;
 result:=public.receive_lowify_paid_order(repeat('a',64),item||'{"order_id":"__lowify_test_unknown","product_id":"__test_unknown"}'::jsonb);
 if result->>'state'<>'pending_product' then raise exception 'Unknown product granted a plan';end if;
 result:=public.receive_lowify_paid_order(repeat('a',64),item||'{"order_id":"__lowify_test_new","product_id":"__test_weekly","email":"lowify-new@example.invalid"}'::jsonb);
 if result->>'state'<>'pending_account' then raise exception 'Sale before signup not retained';end if;
 result:=public.receive_lowify_paid_order(repeat('a',64),item||'{"order_id":"__lowify_test_ignore","event":"sale.pending","status":"pending"}'::jsonb);
 if result->>'state'<>'ignored' then raise exception 'Pending sale accepted';end if;
end $$;
reset role;
insert into auth.users(id,email) values('10000000-0000-4000-8000-000000000082','lowify-new@example.invalid');
do $$begin
 if not exists(select 1 from public.subscriptions where user_id='10000000-0000-4000-8000-000000000082' and plan='weekly' and ends_at>now()) then raise exception 'Signup did not claim purchase';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000081","role":"authenticated"}',true);
set local role authenticated;
do $$begin
 begin perform public.receive_lowify_paid_order(repeat('a',64),'{}');raise exception 'CLIENT_PAYMENT_BYPASS';exception when insufficient_privilege then null;end;
 begin perform public.retry_lowify_paid_orders();raise exception 'CLIENT_RETRY_BYPASS';exception when insufficient_privilege then null;end;
 begin perform count(*) from public.lowify_paid_orders;raise exception 'CLIENT_ORDER_LEAK';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into auth.users(id,email) values('10000000-0000-4000-8000-000000000083','lowify-referral@example.invalid');
insert into public.referral_signups(referred_user_id,referrer_user_id,created_at)
values('10000000-0000-4000-8000-000000000083','10000000-0000-4000-8000-000000000082',now()-interval '2 minutes');
set local role service_role;
do $$declare before_end timestamptz;after_end timestamptz;item jsonb;
begin
 select ends_at into before_end from public.subscriptions where provider_ref='__lowify_test_new';
 item:=jsonb_build_object('event','sale.paid','status','paid','order_id','__lowify_test_referral','product_id','__test_semiannual','email','lowify-referral@example.invalid','amount',129.90,'paid_at',(now()-interval '1 minute')::text);
 perform public.receive_lowify_paid_order(repeat('a',64),item);
 perform public.receive_lowify_paid_order(repeat('a',64),item);
 select ends_at into after_end from public.subscriptions where provider_ref='__lowify_test_new';
 if after_end<>before_end+interval '10 days' then raise exception 'Referral bonus missing or duplicated';end if;
 if (select count(*) from public.referral_rewards where referred_user_id='10000000-0000-4000-8000-000000000083')<>1 then raise exception 'Referral reward count incorrect';end if;
end $$;
reset role;
rollback;
