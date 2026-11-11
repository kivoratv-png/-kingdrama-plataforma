begin;
insert into auth.users(id,email) values
('10000000-0000-4000-8000-000000000001','referrer-test@example.invalid'),
('10000000-0000-4000-8000-000000000002','free-referral-test@example.invalid');
insert into public.subscriptions(user_id,status,plan,ends_at) values('10000000-0000-4000-8000-000000000001','active','basic',now()+interval '1 month');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$begin
 if (public.referral_dashboard()->>'eligible')::boolean then raise exception 'Free account eligible';end if;
 if public.referral_dashboard()->>'code' is not null then raise exception 'Free account received code';end if;
 begin perform public.create_referral_code();raise exception 'FREE_CODE_BYPASS';exception when insufficient_privilege then null;end;
 begin perform public.credit_referral_payment('fake','10000000-0000-4000-8000-000000000002',1,now());raise exception 'CLIENT_REWARD_BYPASS';exception when insufficient_privilege then null;end;
 begin perform code from public.referral_codes;raise exception 'PRIVATE_CODE_LEAK';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$declare first_code text;begin
 first_code:=public.create_referral_code();
 if first_code<>public.create_referral_code() then raise exception 'Unstable referral link';end if;
 if not (public.referral_dashboard()->>'eligible')::boolean then raise exception 'Subscriber incorrectly blocked';end if;
end $$;
reset role;
insert into auth.users(id,email,raw_user_meta_data)
select '10000000-0000-4000-8000-000000000003','referred-buyer-test@example.invalid',jsonb_build_object('referral_code',code)
from public.referral_codes where user_id='10000000-0000-4000-8000-000000000001';
do $$begin
 if not exists(select 1 from public.referral_signups where referred_user_id='10000000-0000-4000-8000-000000000003' and referrer_user_id='10000000-0000-4000-8000-000000000001') then raise exception 'Signup attribution missing';end if;
end $$;
update auth.users set raw_user_meta_data='{}'::jsonb where id='10000000-0000-4000-8000-000000000003';
set local role authenticated;
do $$begin
 if (public.referral_dashboard()->>'validReferrals')::integer<>0 or (public.referral_dashboard()->>'daysEarned')::integer<>0 then raise exception 'Signup rewarded without payment';end if;
end $$;
reset role;
insert into public.subscriptions(user_id,status,plan,provider,provider_ref,ends_at)
values('10000000-0000-4000-8000-000000000003','pending','monthly','lowify','referral-test-payment',now()+interval '1 month');
set local role service_role;
do $$begin
 begin
  perform public.credit_referral_payment('referral-test-payment','10000000-0000-4000-8000-000000000003',
    (select id from public.subscriptions where provider_ref='referral-test-payment'),now());
  raise exception 'PENDING_PAYMENT_REWARDED';
 exception when others then if sqlerrm='PENDING_PAYMENT_REWARDED' then raise;end if;end;
end $$;
reset role;
update public.subscriptions set status='active' where provider_ref='referral-test-payment';
set local role service_role;
do $$declare sid bigint;begin
 select id into sid from public.subscriptions where provider_ref='referral-test-payment';
 if not public.credit_referral_payment('referral-test-payment','10000000-0000-4000-8000-000000000003',sid,now()) then raise exception 'Verified payment not rewarded';end if;
 if public.credit_referral_payment('referral-test-payment','10000000-0000-4000-8000-000000000003',sid,now()) then raise exception 'Duplicate payment rewarded';end if;
 if public.credit_referral_payment('referral-test-renewal','10000000-0000-4000-8000-000000000003',sid,now()) then raise exception 'Same friend rewarded twice';end if;
end $$;
reset role;
do $$begin
 if (select ends_at from public.subscriptions where user_id='10000000-0000-4000-8000-000000000001')<>now()+interval '1 month'+interval '10 days' then raise exception 'Wrong expiry extension';end if;
end $$;
set local role authenticated;
do $$begin
 if (public.referral_dashboard()->>'validReferrals')::integer<>1 or (public.referral_dashboard()->>'daysEarned')::integer<>10 then raise exception 'Wrong referral counters';end if;
end $$;
reset role;
update public.subscriptions set ends_at=now()-interval '1 day' where user_id='10000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin
 if (public.referral_dashboard()->>'eligible')::boolean or public.referral_dashboard()->>'code' is not null then raise exception 'Expired subscriber received link';end if;
 begin perform public.create_referral_code();raise exception 'EXPIRED_CODE_BYPASS';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
