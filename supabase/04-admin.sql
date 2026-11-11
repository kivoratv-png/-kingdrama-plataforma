-- Painel administrativo e presença. Aplicação atômica e repetível.
begin;

create table if not exists public.admin_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.admin_accounts enable row level security;
revoke all on public.admin_accounts from public, anon, authenticated;

do $$
begin
  if (select count(*) from auth.users
      where lower(email) = 'kivoratv@gmail.com' and email_confirmed_at is not null) <> 1 then
    raise exception 'A conta administradora confirmada deve existir e ser única';
  end if;
  insert into public.admin_accounts(user_id)
    select id from auth.users
    where lower(email) = 'kivoratv@gmail.com' and email_confirmed_at is not null
    on conflict (user_id) do nothing;
end;
$$;

create table if not exists public.viewer_presence (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null check (length(path) <= 200),
  title_id text references public.titles(id) on delete set null,
  episode_number integer,
  player_state text not null default 'page',
  position_seconds integer,
  page_visible boolean not null default true,
  last_seen timestamptz not null default now(),
  last_error_code text,
  error_at timestamptz,
  error_path text,
  error_title_id text references public.titles(id) on delete set null,
  constraint presence_state check (player_state in ('page','player_open','playing','paused','ended','error')),
  constraint presence_position check (position_seconds between 0 and 86400)
);
create index if not exists viewer_presence_seen on public.viewer_presence(last_seen desc);
create index if not exists viewer_presence_user on public.viewer_presence(user_id);
alter table public.viewer_presence enable row level security;
revoke all on public.viewer_presence from public, anon, authenticated;

create or replace function public.platform_admin_status()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.admin_accounts a
    where a.user_id = auth.uid() and a.enabled);
$$;
revoke all on function public.platform_admin_status() from public, anon;
grant execute on function public.platform_admin_status() to authenticated;

create or replace function public.record_viewer_presence(
  p_session uuid, p_path text, p_state text default 'page',
  p_position integer default null, p_visible boolean default true,
  p_error text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  title text;
  episode integer;
  parts text[];
  previous public.viewer_presence%rowtype;
begin
  if viewer is null then raise insufficient_privilege; end if;
  if p_session is null then raise exception 'Sessão inválida' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(viewer::text, 193));
  if p_path is null then
    delete from public.viewer_presence where session_id = p_session and user_id = viewer;
    return;
  end if;
  if length(p_path) > 200 or p_path !~ '^/([a-zA-Z0-9_-]+/?)*$'
      or p_state not in ('page','player_open','playing','paused','ended','error')
      or (p_position is not null and (p_position < 0 or p_position > 86400))
      or (p_error is not null and p_error !~ '^(http_[45][0-9]{2}|player_error|network_error)$') then
    raise exception 'Atividade inválida' using errcode = '22023';
  end if;
  select * into previous from public.viewer_presence where session_id = p_session;
  if found and previous.user_id <> viewer then raise insufficient_privilege; end if;
  if previous.last_seen > now() - interval '3 seconds' then return; end if;
  delete from public.viewer_presence where user_id = viewer and last_seen < now() - interval '1 day';
  if previous.session_id is null and
      (select count(*) from public.viewer_presence where user_id = viewer
        and last_seen > now() - interval '2 minutes') >= 8 then
    return;
  end if;
  -- Keep at most eight sessions per user, including stale browser tabs.
  if previous.session_id is null then
    delete from public.viewer_presence where session_id in (
      select session_id from public.viewer_presence where user_id = viewer
      order by last_seen desc offset 7
    );
  end if;
  parts := pg_catalog.regexp_match(p_path, '^/assistir/([a-zA-Z0-9_-]{1,120})/([0-9]{1,6})$');
  if parts is not null then
    select t.id into title from public.titles t where t.id = parts[1] and t.published;
    episode := parts[2]::integer;
  else
    p_state := 'page';
    p_position := null;
  end if;
  insert into public.viewer_presence(session_id,user_id,path,title_id,episode_number,
    player_state,position_seconds,page_visible,last_seen,last_error_code,error_at,error_path,error_title_id)
  values(p_session,viewer,p_path,title,episode,p_state,p_position,coalesce(p_visible,true),
    now(),p_error,case when p_error is not null then now() end,
    case when p_error is not null then p_path end,case when p_error is not null then title end)
  on conflict (session_id) do update set
    path=excluded.path, title_id=excluded.title_id, episode_number=excluded.episode_number,
    player_state=excluded.player_state, position_seconds=excluded.position_seconds,
    page_visible=excluded.page_visible, last_seen=excluded.last_seen,
    last_error_code=coalesce(excluded.last_error_code,public.viewer_presence.last_error_code),
    error_at=coalesce(excluded.error_at,public.viewer_presence.error_at),
    error_path=coalesce(excluded.error_path,public.viewer_presence.error_path),
    error_title_id=case when excluded.error_at is not null then excluded.error_title_id else public.viewer_presence.error_title_id end;
end;
$$;
revoke all on function public.record_viewer_presence(uuid,text,text,integer,boolean,text) from public, anon;
grant execute on function public.record_viewer_presence(uuid,text,text,integer,boolean,text) to authenticated;

create or replace function public.admin_dashboard(p_search text default '', p_page integer default 0)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  result jsonb;
  users_result jsonb;
  total_found bigint;
begin
  if not public.platform_admin_status() or coalesce(auth.jwt()->>'aal','') <> 'aal2'
      or not exists(select 1 from auth.mfa_factors f
        where f.user_id=auth.uid() and f.status='verified') then
    raise insufficient_privilege using message = 'Administração exige conta autorizada e segundo fator';
  end if;
  if p_page is null or p_page < 0 or p_page > 100000
      or p_search is null or length(p_search) > 100 then
    raise exception 'Filtro inválido' using errcode = '22023';
  end if;
  select count(*) into total_found from auth.users u
    left join public.profiles p on p.id=u.id
    where strpos(lower(coalesce(p.name,'') || ' ' || coalesce(u.email,'')),lower(p_search))>0;
  select coalesce(jsonb_agg(row_to_json(details) order by details.created_at desc),'[]'::jsonb)
  into users_result from (
    select u.id,coalesce(p.name,'') as name,u.email,u.created_at,u.last_sign_in_at,
      exists(select 1 from public.subscriptions s where s.user_id=u.id and s.status='active'
        and (s.ends_at is null or s.ends_at>now())) as has_access,
      (select jsonb_build_object('status',s.status,'plan',s.plan,'ends_at',s.ends_at)
        from public.subscriptions s where s.user_id=u.id
        order by (s.status='active' and (s.ends_at is null or s.ends_at>now())) desc,
          s.updated_at desc,s.id desc limit 1) as subscription
    from auth.users u left join public.profiles p on p.id=u.id
    where strpos(lower(coalesce(p.name,'') || ' ' || coalesce(u.email,'')),lower(p_search))>0
    order by u.created_at desc,u.id limit 50 offset p_page*50
  ) details;
  select jsonb_build_object(
    'generated_at',now(),
    'counts',jsonb_build_object(
      'users',(select count(*) from auth.users),
      'online',(select count(distinct user_id) from public.viewer_presence where last_seen>now()-interval '90 seconds'),
      'watching',(select count(distinct user_id) from public.viewer_presence
        where last_seen>now()-interval '90 seconds' and title_id is not null
          and player_state in ('player_open','playing','paused')),
      'active_subscriptions',(select count(distinct user_id) from public.subscriptions
        where status='active' and (ends_at is null or ends_at>now())),
      'titles',(select count(*) from public.titles where published)
    ),
    'online',coalesce((select jsonb_agg(row_to_json(activity) order by activity.last_seen desc) from (
      select v.session_id,v.user_id,coalesce(p.name,'') as name,u.email,v.path,
        v.title_id,t.name as title_name,v.episode_number,v.player_state,
        v.position_seconds,v.page_visible,v.last_seen
      from public.viewer_presence v join auth.users u on u.id=v.user_id
      left join public.profiles p on p.id=v.user_id left join public.titles t on t.id=v.title_id
      where v.last_seen>now()-interval '90 seconds' order by v.last_seen desc limit 200
    ) activity),'[]'::jsonb),
    'errors',coalesce((select jsonb_agg(row_to_json(failure) order by failure.error_at desc) from (
      select v.user_id,coalesce(p.name,'') as name,u.email,v.error_path as path,v.last_error_code,v.error_at,
        t.name as title_name
      from public.viewer_presence v join auth.users u on u.id=v.user_id
      left join public.profiles p on p.id=v.user_id left join public.titles t on t.id=v.error_title_id
      where v.error_at>now()-interval '1 day' order by v.error_at desc limit 50
    ) failure),'[]'::jsonb),
    'users',users_result,'users_total',total_found,'page',p_page,'page_size',50
  ) into result;
  return result;
end;
$$;
revoke all on function public.admin_dashboard(text,integer) from public, anon;
grant execute on function public.admin_dashboard(text,integer) to authenticated;

notify pgrst, 'reload schema';
commit;
