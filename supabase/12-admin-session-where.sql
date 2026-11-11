-- Explicit predicate required by the REST database safety guard.
begin;
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
commit;
