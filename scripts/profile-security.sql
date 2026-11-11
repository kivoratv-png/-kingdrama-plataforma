begin;
insert into auth.users(id,email) values
('10000000-0000-4000-8000-000000000001','profile-test-1@example.invalid'),
('10000000-0000-4000-8000-000000000002','profile-test-2@example.invalid');
insert into auth.sessions(id,user_id,created_at,updated_at,user_agent) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',now()-interval '2 minutes',now(),'Test A'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',now()-interval '1 minute',now(),'Test B'),
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002',now(),now(),'Test C');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"20000000-0000-4000-8000-000000000002"}',true);
set local role authenticated;
do $$ begin
  if public.account_session_allowed() then raise exception 'Second session bypass'; end if;
  if jsonb_array_length(public.account_devices()->'devices')<>2 then raise exception 'Device isolation failure'; end if;
  if public.account_revoke_device('20000000-0000-4000-8000-000000000003') then raise exception 'Cross-user revocation'; end if;
  if not public.account_revoke_device('20000000-0000-4000-8000-000000000001') then raise exception 'Revocation failed'; end if;
  if not public.account_session_allowed() then raise exception 'Replacement session blocked'; end if;
  if not public.account_revoke_device('20000000-0000-4000-8000-000000000002') then raise exception 'Self revocation failed'; end if;
  if public.account_session_allowed() then raise exception 'Revoked JWT allowed'; end if;
end $$;
reset role;
rollback;
