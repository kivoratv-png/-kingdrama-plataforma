-- Session checks also protect database reads and signed playback URLs.
create table if not exists public.plan_device_limits (
  plan text primary key,
  device_limit integer not null check (device_limit between 1 and 20)
);
alter table public.plan_device_limits enable row level security;
revoke all on public.plan_device_limits from anon, authenticated;
insert into public.plan_device_limits values ('basic',1),('basico',1),('básico',1)
on conflict (plan) do nothing;

create or replace function public.account_device_limit() returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((select l.device_limit from public.subscriptions s
    join public.plan_device_limits l on l.plan=lower(s.plan)
    where s.user_id=auth.uid() and s.status='active' and (s.ends_at is null or s.ends_at>now())
    order by s.updated_at desc,s.id desc limit 1),1);
$$;

create or replace function public.account_session_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from (
    select s.id from auth.sessions s where s.user_id=auth.uid()
    and (s.not_after is null or s.not_after>now())
    order by s.created_at,s.id limit public.account_device_limit()
  ) allowed where allowed.id=nullif(auth.jwt()->>'session_id','')::uuid);
$$;

create or replace function public.account_devices() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('limit',public.account_device_limit(),
    'allowed',public.account_session_allowed(),
    'devices',coalesce((select jsonb_agg(jsonb_build_object(
      'id',s.id,'agent',left(s.user_agent,300),'createdAt',s.created_at,
      'lastSeen',coalesce(s.refreshed_at::timestamptz,s.updated_at,s.created_at),
      'current',s.id=nullif(auth.jwt()->>'session_id','')::uuid) order by s.created_at)
    from auth.sessions s where s.user_id=auth.uid() and (s.not_after is null or s.not_after>now())), '[]'::jsonb));
$$;

create or replace function public.account_revoke_device(p_session uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from auth.sessions where user_id=auth.uid()
    and id=nullif(auth.jwt()->>'session_id','')::uuid) then
    raise exception 'Sessão inválida' using errcode='42501';
  end if;
  delete from auth.sessions where id=p_session and user_id=auth.uid();
  return found;
end;
$$;

create or replace function public.has_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.account_session_allowed() and exists(select 1 from public.subscriptions s
  where s.user_id=auth.uid() and s.status='active' and (s.ends_at is null or s.ends_at>now()));
$$;

revoke all on function public.account_device_limit(), public.account_session_allowed(),
  public.account_devices(),public.account_revoke_device(uuid) from public,anon;
grant execute on function public.account_device_limit(), public.account_session_allowed(),
  public.account_devices(),public.account_revoke_device(uuid) to authenticated;
