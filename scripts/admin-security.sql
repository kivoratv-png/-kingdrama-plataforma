-- Regression checks run in a transaction and rolled back, including presence.
begin;
do $$
declare
  owner_id uuid;
  other_id uuid;
  test_session uuid := gen_random_uuid();
begin
  select user_id into owner_id from public.admin_accounts where enabled limit 1;
  if owner_id is null then raise exception 'Administrator missing'; end if;
  select id into other_id from auth.users where id <> owner_id limit 1;

  if has_table_privilege('anon','public.admin_accounts','SELECT')
      or has_table_privilege('authenticated','public.admin_accounts','UPDATE')
      or has_table_privilege('authenticated','public.admin_accounts','INSERT')
      or has_table_privilege('authenticated','public.viewer_presence','SELECT')
      or has_table_privilege('authenticated','public.viewer_presence','INSERT') then
    raise exception 'Unexpected direct table access';
  end if;
  if has_function_privilege('anon','public.admin_dashboard(text,integer)','EXECUTE')
      or has_function_privilege('anon','public.record_viewer_presence(uuid,text,text,integer,boolean,text)','EXECUTE') then
    raise exception 'Unexpected anonymous RPC access';
  end if;
  if exists(select 1 from pg_class where oid in ('public.admin_accounts'::regclass,
      'public.viewer_presence'::regclass) and not relrowsecurity) then
    raise exception 'RLS missing';
  end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','aal','aal1')::text,true);
  execute 'set local role authenticated';
  if public.platform_admin_status() is not true then raise exception 'Administrator lookup failed'; end if;
  begin
    perform public.admin_dashboard('',0);
    raise exception 'AAL1 administrator reached dashboard';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.record_viewer_presence(test_session,'/inicio?token=secret');
    raise exception 'Query string was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.record_viewer_presence(test_session,'//external.example');
    raise exception 'External path was accepted';
  exception when invalid_parameter_value then null;
  end;
  perform public.record_viewer_presence(test_session,'/inicio');
  execute 'reset role';
  if not exists(select 1 from public.viewer_presence where session_id=test_session and user_id=owner_id) then
    raise exception 'Presence did not use verified user identity';
  end if;
  if other_id is not null then
    perform set_config('request.jwt.claims',jsonb_build_object('sub',other_id,'role','authenticated','aal','aal2')::text,true);
    execute 'set local role authenticated';
    if public.platform_admin_status() then raise exception 'Ordinary user became administrator'; end if;
    begin
      perform public.admin_dashboard('',0);
      raise exception 'Ordinary user reached dashboard';
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.record_viewer_presence(test_session,'/inicio');
      raise exception 'Ordinary user overwrote another session';
    exception when insufficient_privilege then null;
    end;
    perform public.record_viewer_presence(test_session,null);
    execute 'reset role';
    if not exists(select 1 from public.viewer_presence where session_id=test_session and user_id=owner_id) then
      raise exception 'Another user deleted presence';
    end if;
  end if;
end;
$$;
rollback;
select true as passed;
