begin;
do $$
declare name text;r jsonb;
begin
 if exists(select 1 from public.admin_accounts) then raise exception 'Platform accounts remain associated'; end if;
 foreach name in array array['admin_console_credentials','admin_console_sessions'] loop
  if has_table_privilege('authenticated','public.'||name,'SELECT') or has_table_privilege('anon','public.'||name,'SELECT') then raise exception 'Console authentication data exposed'; end if;
 end loop;
 foreach name in array array['admin_dashboard(text,integer)','admin_drama_requests()','admin_update_drama_request(uuid,text,text,text)','admin_set_request_addon(uuid,timestamp with time zone)','admin_console_dashboard(text,integer)','admin_console_drama_requests()','admin_console_commit_login(bigint,text,text,text,text)'] loop
  if has_function_privilege('authenticated','public.'||name,'EXECUTE') or has_function_privilege('anon','public.'||name,'EXECUTE') then raise exception 'App role can access console: %',name; end if;
 end loop;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 update public.admin_console_credentials set active=true,username='test-console',password_hash='test',totp_secret='test-secret',last_counter=-1,failures=0,blocked_until=null where id=1;
 if not public.admin_console_attempt() then raise exception 'First attempt blocked'; end if;
 if not public.admin_console_commit_login(100,repeat('a',64),repeat('b',64),null,'test-secret') then raise exception 'Login commit failed'; end if;
 if public.admin_console_commit_login(100,repeat('c',64),repeat('d',64),null,'test-secret') then raise exception 'Repeated OTP accepted'; end if;
 if public.admin_console_validate(repeat('a',64),repeat('c',64)) then raise exception 'Wrong page token accepted'; end if;
 if not public.admin_console_validate(repeat('a',64),repeat('b',64)) then raise exception 'Session failed'; end if;
 perform public.admin_console_dashboard('',0);perform public.admin_console_drama_requests();
 perform public.admin_console_revoke(repeat('a',64));
 if public.admin_console_validate(repeat('a',64),repeat('b',64)) then raise exception 'Logout failed'; end if;
 perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 begin perform public.admin_console_dashboard('',0);raise exception 'App role passed service-only guard';exception when insufficient_privilege then null;end;
end; $$;
rollback;
