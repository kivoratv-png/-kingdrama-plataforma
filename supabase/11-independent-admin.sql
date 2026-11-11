-- Console credentials and sessions have no relationship to auth.users.
begin;
create table if not exists public.admin_console_credentials(
 id integer primary key check(id=1),username text,password_hash text,totp_secret text,
 active boolean not null default false,bootstrap_hash text,bootstrap_expires timestamptz,
 pending_expires timestamptz,last_counter bigint not null default -1,
 failures integer not null default 0,blocked_until timestamptz
);
create table if not exists public.admin_console_sessions(
 cookie_hash text primary key,page_hash text not null,created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '4 hours',last_seen timestamptz not null default now()
);
alter table public.admin_console_credentials enable row level security;
alter table public.admin_console_sessions enable row level security;
revoke all on public.admin_console_credentials,public.admin_console_sessions from public,anon,authenticated;
grant all on public.admin_console_credentials,public.admin_console_sessions to service_role;
insert into public.admin_console_credentials(id) values(1) on conflict do nothing;

create or replace function public.admin_console_attempt() returns boolean language plpgsql security definer set search_path='' as $$
declare r public.admin_console_credentials%rowtype;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise insufficient_privilege; end if;
 select * into r from public.admin_console_credentials where id=1 for update;
 if r.blocked_until>now() then return false; end if;
 if r.blocked_until is not null then r.failures:=0; end if;
 update public.admin_console_credentials set failures=r.failures+1,
 blocked_until=case when r.failures>=9 then now()+interval '5 minutes' else null end where id=1;
 return r.failures<9;
end; $$;
create or replace function public.admin_console_commit_login(p_counter bigint,p_cookie text,p_page text,p_setup text,p_secret text) returns boolean language plpgsql security definer set search_path='' as $$
declare r public.admin_console_credentials%rowtype;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise insufficient_privilege; end if;
 select * into r from public.admin_console_credentials where id=1 for update;
 if r.blocked_until>now() or p_counter<=r.last_counter or p_secret is distinct from r.totp_secret or p_cookie!~'^[a-f0-9]{64}$' or p_page!~'^[a-f0-9]{64}$' then return false; end if;
 if p_setup is null then if not r.active then return false; end if;
 else
  if r.active or p_setup is distinct from r.bootstrap_hash or r.bootstrap_expires<=now() or r.pending_expires<=now() or r.pending_expires is null then return false; end if;
 end if;
 update public.admin_console_credentials set active=true,last_counter=p_counter,failures=0,blocked_until=null,bootstrap_hash=null,bootstrap_expires=null,pending_expires=null where id=1;
 delete from public.admin_console_sessions where created_at<=now();
 insert into public.admin_console_sessions(cookie_hash,page_hash) values(p_cookie,p_page);
 return true;
end; $$;
create or replace function public.admin_console_validate(p_cookie text,p_page text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise insufficient_privilege; end if;
 update public.admin_console_sessions set last_seen=now() where cookie_hash=p_cookie and page_hash=p_page and expires_at>now() and last_seen>now()-interval '20 minutes';
 return found;
end; $$;
create or replace function public.admin_console_revoke(p_cookie text) returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise insufficient_privilege; end if;
 delete from public.admin_console_sessions where cookie_hash=p_cookie;
end; $$;
revoke all on function public.admin_console_attempt(),public.admin_console_commit_login(bigint,text,text,text,text),public.admin_console_validate(text,text),public.admin_console_revoke(text) from public,anon,authenticated;
grant execute on function public.admin_console_attempt(),public.admin_console_commit_login(bigint,text,text,text,text),public.admin_console_validate(text,text),public.admin_console_revoke(text) to service_role;

-- Retain the current dashboard and request logic, but expose it only to the
-- backend after independent console authentication. No app JWT can call it.
do $$
declare old_name text;new_name text;signature text;definition text;guard text;
begin
 foreach old_name in array array['admin_dashboard','admin_drama_requests','admin_update_drama_request','admin_set_request_addon'] loop
  select pg_get_functiondef(p.oid),pg_get_function_identity_arguments(p.oid) into definition,signature
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=old_name;
  if definition is null then raise exception 'Missing administrative function: %',old_name; end if;
  new_name:=replace(old_name,'admin_','admin_console_');
  guard:='if coalesce(auth.role(),'''')<>''service_role'' then raise insufficient_privilege; end if;';
  definition:=regexp_replace(definition,'if not public.platform_admin_status\(\).*?end if;',guard,'s');
  if strpos(definition,'platform_admin_status')>0 then raise exception 'Unable to remove account-based authorization'; end if;
  definition:=replace(definition,'FUNCTION public.'||old_name||'(','FUNCTION public.'||new_name||'(');
  execute definition;
  execute format('revoke all on function public.%I(%s) from public,anon,authenticated',new_name,signature);
  execute format('grant execute on function public.%I(%s) to service_role',new_name,signature);
  execute format('revoke all on function public.%I(%s) from public,anon,authenticated',old_name,signature);
 end loop;
end; $$;
-- Explicitly remove the old association with platform accounts.
delete from public.admin_accounts;
commit;
