begin;
insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000071','plan-quota-test@example.invalid');
insert into auth.sessions(id,user_id,created_at,updated_at)
select ('20000000-0000-4000-8000-00000000007'||n)::uuid,'10000000-0000-4000-8000-000000000071',now(),now() from generate_series(1,4)n;
insert into public.subscriptions(user_id,status,plan,ends_at) values('10000000-0000-4000-8000-000000000071','active','quarterly',now()+interval '3 months');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000071","role":"authenticated","session_id":"20000000-0000-4000-8000-000000000071"}',true);
set local role authenticated;
do $$declare n integer;begin
 if public.account_device_limit()<>3 then raise exception 'Quarterly limit incorrect';end if;
 for n in 1..4 loop
 perform set_config('request.jwt.claims',jsonb_build_object('sub',auth.uid(),'role','authenticated','session_id','20000000-0000-4000-8000-00000000007'||n)::text,true);
 perform public.account_activate_session();
 if not public.account_session_allowed() then raise exception 'Newest device blocked';end if;
 end loop;
 if jsonb_array_length(public.account_devices()->'devices')<>3 then raise exception 'Fourth device not removed';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',auth.uid(),'role','authenticated','session_id','20000000-0000-4000-8000-000000000071')::text,true);
 if public.account_session_allowed() then raise exception 'Evicted device allowed';end if;
 perform public.submit_drama_request('Quota test A','');perform public.submit_drama_request('Quota test B','');
 begin perform public.submit_drama_request('Quota test C','');raise exception 'QUOTA_BYPASS';exception when others then if sqlerrm='QUOTA_BYPASS' or position('2 pedidos' in sqlerrm)=0 then raise;end if;end;
 if (public.customer_requests()->>'used')::integer<>2 or (public.customer_requests()->>'limit')::integer<>2 then raise exception 'Quota count incorrect';end if;
 begin insert into public.request_entitlements values(auth.uid(),now()+interval '1 day');raise exception 'ADDON_BYPASS';exception when insufficient_privilege then null;end;
 begin update public.plan_device_limits set device_limit=10 where plan='monthly';raise exception 'LIMIT_BYPASS';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Test changes without another login: existing devices must obey the new plan immediately.
do $$declare plan_code text;expected integer;n integer;actual boolean;begin
 foreach plan_code in array array['weekly','monthly','quarterly','semiannual','Trimestral','Semestral','unknown'] loop
 update public.subscriptions set plan=plan_code where user_id='10000000-0000-4000-8000-000000000071';
 expected:=case when plan_code in('quarterly','semiannual','Trimestral','Semestral') then 3 else 1 end;
 if public.account_device_limit()<>expected then raise exception 'Wrong limit for %',plan_code;end if;
 for n in 2..4 loop
 perform set_config('request.jwt.claims',jsonb_build_object('sub','10000000-0000-4000-8000-000000000071','role','authenticated','session_id','20000000-0000-4000-8000-00000000007'||n)::text,true);
 actual:=public.account_session_allowed();
 if actual<>(expected=3 or n=4) then raise exception 'Wrong device authorization for % / %',plan_code,n;end if;
 end loop;
 end loop;
 update public.subscriptions set plan='quarterly',ends_at=now()-interval '1 second' where user_id=auth.uid();
 if public.account_device_limit()<>1 then raise exception 'Expired plan retains three devices';end if;
 insert into public.request_entitlements values(auth.uid(),now()+interval '1 day');
end $$;
set local role authenticated;
select public.submit_drama_request('Quota test C','');
do $$begin if (public.customer_requests()->>'used')::integer<>3 then raise exception 'Unlimited addon ignored';end if;end $$;
reset role;
update public.request_entitlements set unlimited_until=now()-interval '1 second' where user_id=auth.uid();
set local role authenticated;
do $$begin
 begin perform public.submit_drama_request('Quota test D','');raise exception 'EXPIRED_ADDON_BYPASS';exception when others then if sqlerrm='EXPIRED_ADDON_BYPASS' or position('2 pedidos' in sqlerrm)=0 then raise;end if;end;
 perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000072","role":"authenticated"}',true);
 if (public.customer_requests()->>'used')::integer<>0 then raise exception 'Another account requests leaked';end if;
end $$;
reset role;
rollback;
