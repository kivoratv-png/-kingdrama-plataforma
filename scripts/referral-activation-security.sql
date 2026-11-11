begin;
insert into auth.users(id,email) values
('10000000-0000-4000-8000-000000000001','automatic-referrer@example.invalid'),
('10000000-0000-4000-8000-000000000002','automatic-unrelated@example.invalid');
insert into public.subscriptions(user_id,status,plan,ends_at) values('10000000-0000-4000-8000-000000000001','active','basic',now()+interval '1 month');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.create_referral_code();
do $$begin
 begin perform public.retry_referral_activations();raise exception 'CLIENT_RETRY_ACCESS';exception when insufficient_privilege then null;end;
 begin perform id from public.referral_activation_jobs;raise exception 'CLIENT_QUEUE_LEAK';exception when insufficient_privilege then null;end;
 begin update public.subscriptions set provider='lowify',provider_ref='client-forged-payment',status='active' where user_id=auth.uid();exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin if exists(select 1 from public.subscriptions where provider_ref='client-forged-payment') then raise exception 'Client forged paid activation';end if;end $$;
insert into auth.users(id,email,raw_user_meta_data)
select '10000000-0000-4000-8000-000000000003','automatic-buyer@example.invalid',jsonb_build_object('referral_code',code)
from public.referral_codes where user_id='10000000-0000-4000-8000-000000000001';
insert into public.subscriptions(user_id,status,plan,provider,provider_ref,ends_at)
values('10000000-0000-4000-8000-000000000003','pending','monthly','lowify','automatic-payment-1',now()+interval '1 month');
do $$begin
 if exists(select 1 from public.referral_rewards where referred_user_id='10000000-0000-4000-8000-000000000003') then raise exception 'Unpaid signup rewarded';end if;
 if exists(select 1 from public.referral_activation_jobs where payment_id='automatic-payment-1') then raise exception 'Pending payment queued';end if;
end $$;
-- Only account activation changes here: no explicit call to a reward function.
update public.subscriptions set status='active',payment_confirmed_at=now() where provider_ref='automatic-payment-1';
do $$begin
 if (select count(*) from public.referral_rewards where referrer_user_id='10000000-0000-4000-8000-000000000001')<>1 then raise exception 'Automatic credit missing';end if;
 if (select ends_at from public.subscriptions where user_id='10000000-0000-4000-8000-000000000001')<>now()+interval '1 month'+interval '10 days' then raise exception 'Wrong automatic expiry';end if;
 if not exists(select 1 from public.referral_activation_jobs where payment_id='automatic-payment-1' and state='completed') then raise exception 'Missing completed audit record';end if;
end $$;
update public.subscriptions set status='active',ends_at=ends_at+interval '1 day' where provider_ref='automatic-payment-1';
insert into public.subscriptions(user_id,status,plan,provider,provider_ref,ends_at)
values('10000000-0000-4000-8000-000000000003','active','monthly','lowify','automatic-renewal-1',now()+interval '2 months');
do $$begin
 if (select count(*) from public.referral_rewards where referrer_user_id='10000000-0000-4000-8000-000000000001')<>1 then raise exception 'Duplicate activation or renewal credited';end if;
end $$;
insert into auth.users(id,email,raw_user_meta_data)
select '10000000-0000-4000-8000-000000000004','automatic-courtesy@example.invalid',jsonb_build_object('referral_code',code)
from public.referral_codes where user_id='10000000-0000-4000-8000-000000000001';
insert into public.subscriptions(user_id,status,plan,provider,provider_ref,ends_at)
values('10000000-0000-4000-8000-000000000004','active','cortesia','lowify','automatic-courtesy',now()+interval '1 month');
do $$begin
 if exists(select 1 from public.referral_rewards where referred_user_id='10000000-0000-4000-8000-000000000004') then raise exception 'Courtesy rewarded';end if;
end $$;
update public.subscriptions set plan='monthly',provider_ref='automatic-payment-2',payment_confirmed_at=now() where provider_ref='automatic-courtesy';
do $$begin
 if not exists(select 1 from public.referral_rewards where referred_user_id='10000000-0000-4000-8000-000000000004') then raise exception 'Confirmed paid upgrade not credited';end if;
end $$;
insert into auth.users(id,email,raw_user_meta_data)
select '10000000-0000-4000-8000-000000000005','automatic-retry@example.invalid',jsonb_build_object('referral_code',code)
from public.referral_codes where user_id='10000000-0000-4000-8000-000000000001';
-- Simulate a referrer requiring account review while the friend's purchase succeeds.
update public.subscriptions set status='refunded' where user_id='10000000-0000-4000-8000-000000000001';
insert into public.subscriptions(user_id,status,plan,provider,provider_ref,ends_at)
values('10000000-0000-4000-8000-000000000005','active','monthly','lowify','automatic-payment-retry',now()+interval '1 month');
do $$begin
 if not exists(select 1 from public.subscriptions where provider_ref='automatic-payment-retry' and status='active') then raise exception 'Referral failure blocked buyer activation';end if;
 if not exists(select 1 from public.referral_activation_jobs where payment_id='automatic-payment-retry' and state='failed' and attempts=1) then raise exception 'Failed reward was lost';end if;
 if exists(select 1 from public.referral_rewards where referred_user_id='10000000-0000-4000-8000-000000000005') then raise exception 'Failed reward partially committed';end if;
end $$;
update public.subscriptions set status='active' where user_id='10000000-0000-4000-8000-000000000001';
update public.referral_activation_jobs set next_attempt_at=now() where payment_id='automatic-payment-retry';
set local role service_role;
select public.retry_referral_activations();
select public.retry_referral_activations();
reset role;
do $$begin
 if (select sum(days) from public.referral_rewards where referrer_user_id='10000000-0000-4000-8000-000000000001')<>30 then raise exception 'Retries lost or doubled reward';end if;
 if not exists(select 1 from public.referral_activation_jobs where payment_id='automatic-payment-retry' and state='completed' and attempts=2) then raise exception 'Retry not audited';end if;
 if (select ends_at from public.subscriptions where user_id='10000000-0000-4000-8000-000000000001')<>now()+interval '1 month'+interval '30 days' then raise exception 'Final expiry incorrect';end if;
end $$;
set local role authenticated;
do $$begin
 if (public.referral_dashboard()->>'validReferrals')::integer<>3 or (public.referral_dashboard()->>'daysEarned')::integer<>30 then raise exception 'Dashboard did not update';end if;
end $$;
reset role;
rollback;
