begin;
insert into auth.users(id,email) values
('10000000-0000-4000-8000-000000000001','customer-test-1@example.invalid'),
('10000000-0000-4000-8000-000000000002','customer-test-2@example.invalid'),
('10000000-0000-4000-8000-000000000003','customer-test-admin@example.invalid');
insert into auth.sessions(id,user_id,created_at,updated_at) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',now()-interval '2 minutes',now()),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',now(),now());
insert into public.admin_accounts(user_id) values('10000000-0000-4000-8000-000000000003');
insert into public.titles(id,name,published) values('__customer_test_title__','Temporary test title',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"20000000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
select public.account_activate_session();
do $$begin
 if not public.account_session_allowed() then raise exception 'Current session blocked';end if;
 if jsonb_array_length(public.account_devices()->'devices')<>1 then raise exception 'Old auth sessions counted as devices';end if;
 perform public.submit_drama_request('Drama A','');perform public.submit_drama_request('Drama B','');perform public.submit_drama_request('Drama C','');
 begin perform public.submit_drama_request('Drama D','');raise exception 'QUOTA_BYPASS';exception when others then if sqlerrm='QUOTA_BYPASS' then raise;end if;end;
 begin perform public.admin_drama_requests();raise exception 'ADMIN_BYPASS';exception when insufficient_privilege then null;end;
 begin perform public.admin_set_request_addon(auth.uid(),now()+interval '1 day');raise exception 'ADDON_BYPASS';exception when insufficient_privilege then null;end;
 if (public.customer_requests()->>'used')::integer<>3 then raise exception 'Incorrect request count';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"20000000-0000-4000-8000-000000000002"}',true);
select public.account_activate_session();
do $$begin if not public.account_session_allowed() then raise exception 'New mobile session blocked';end if;end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"20000000-0000-4000-8000-000000000001"}',true);
do $$begin if public.account_session_allowed() then raise exception 'Old device still allowed';end if;end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$begin if jsonb_array_length(public.customer_requests()->'requests')<>0 then raise exception 'Cross-customer requests leaked';end if;end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
do $$declare rid uuid;begin
 perform public.admin_set_request_addon('10000000-0000-4000-8000-000000000001',now()+interval '1 day');
 rid:=(public.admin_drama_requests()->'requests'->0->>'id')::uuid;
 perform public.admin_update_drama_request(rid,'adding','__customer_test_title__','Preparando o título');
 begin perform public.admin_update_drama_request(rid,'available','__customer_test_title__','');raise exception 'UNPUBLISHED_AVAILABLE';exception when others then if sqlerrm='UNPUBLISHED_AVAILABLE' then raise;end if;end;
end $$;
reset role;
update public.titles set published=true where id='__customer_test_title__';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"20000000-0000-4000-8000-000000000002"}',true);
do $$begin
 perform public.submit_drama_request('Drama D','');
 if (public.customer_requests()->>'used')::integer<>4 then raise exception 'Addon not honored';end if;
 if not exists(select 1 from jsonb_array_elements(public.customer_requests()->'requests')r where r->>'display_status'='available') then raise exception 'Publication not reflected in customer requests';end if;
 perform public.account_revoke_device('20000000-0000-4000-8000-000000000002');
 if public.account_session_allowed() then raise exception 'Revoked session allowed';end if;
end $$;
reset role;
rollback;
