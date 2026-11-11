begin;
-- Count only sessions activated by the app, never old authentication records.
create table if not exists public.active_account_devices (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  activated_at timestamptz not null default now()
);
create index if not exists active_devices_user on public.active_account_devices(user_id,activated_at);
alter table public.active_account_devices enable row level security;
revoke all on public.active_account_devices from public,anon,authenticated;

create or replace function public.account_activate_session() returns boolean
language plpgsql security definer set search_path='' as $$
declare viewer uuid:=auth.uid(); sid uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
begin
  if viewer is null or not exists(select 1 from auth.sessions where id=sid and user_id=viewer and (not_after is null or not_after>now())) then
    raise exception 'Sessão inválida' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(viewer::text,7));
  insert into public.active_account_devices(session_id,user_id) values(sid,viewer)
    on conflict(session_id) do update set activated_at=now();
  delete from public.active_account_devices where user_id=viewer and session_id in (
    select session_id from public.active_account_devices where user_id=viewer
    order by activated_at desc,session_id desc offset public.account_device_limit()
  );
  return true;
end; $$;

create or replace function public.account_session_allowed() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.active_account_devices d join auth.sessions s on s.id=d.session_id
    where d.user_id=auth.uid() and d.session_id=nullif(auth.jwt()->>'session_id','')::uuid
      and (s.not_after is null or s.not_after>now()));
$$;

create or replace function public.account_devices() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('limit',public.account_device_limit(),'allowed',public.account_session_allowed(),
    'devices',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'agent',left(s.user_agent,300),
      'createdAt',d.activated_at,'lastSeen',coalesce(s.refreshed_at::timestamptz,s.updated_at,s.created_at),
      'current',s.id=nullif(auth.jwt()->>'session_id','')::uuid) order by d.activated_at desc)
    from public.active_account_devices d join auth.sessions s on s.id=d.session_id
    where d.user_id=auth.uid() and (s.not_after is null or s.not_after>now())), '[]'::jsonb));
$$;
revoke all on function public.account_activate_session() from public,anon;
grant execute on function public.account_activate_session() to authenticated;

-- Contact identifiers are private and cannot be changed through profile edits.
create table if not exists public.account_contacts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  whatsapp text unique not null check(whatsapp ~ '^[1-9][0-9]{9,10}$')
);
alter table public.account_contacts enable row level security;
revoke all on public.account_contacts from public,anon,authenticated;
grant all on public.account_contacts to service_role;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,name) values(new.id,nullif(trim(new.raw_user_meta_data->>'name'),'')) on conflict(id) do nothing;
  if coalesce(new.raw_user_meta_data->>'whatsapp','')<>'' then
    if (new.raw_user_meta_data->>'whatsapp') !~ '^[1-9][0-9]{9,10}$' then raise exception 'WhatsApp inválido'; end if;
    insert into public.account_contacts(user_id,whatsapp) values(new.id,new.raw_user_meta_data->>'whatsapp');
  end if;
  return new;
end; $$;

create table if not exists public.drama_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(length(trim(name)) between 2 and 150),
  notes text not null default '' check(length(notes)<=1000),
  status text not null default 'received' check(status in('received','reviewing','adding','available','unavailable')),
  title_id text references public.titles(id) on delete set null,
  admin_note text not null default '' check(length(admin_note)<=1000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists drama_requests_user on public.drama_requests(user_id,created_at desc);
alter table public.drama_requests enable row level security;
revoke all on public.drama_requests from public,anon,authenticated;
-- Unlimited requests are a separately granted add-on, never user-controlled metadata.
create table if not exists public.request_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  unlimited_until timestamptz not null
);
alter table public.request_entitlements enable row level security;
revoke all on public.request_entitlements from public,anon,authenticated;

create or replace function public.customer_requests() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('limit',3,'unlimited',exists(select 1 from public.request_entitlements where user_id=auth.uid() and unlimited_until>now()),
  'used',(select count(*) from public.drama_requests where user_id=auth.uid()),
  'requests',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (
    select d.id,d.name,d.notes,d.status,d.admin_note,d.created_at,d.updated_at,
      case when t.published then t.id else null end as title_id,
      case when t.published then t.name else null end as title_name,
      case when t.published then 'available' when d.status='available' then 'adding' else d.status end as display_status
    from public.drama_requests d left join public.titles t on t.id=d.title_id where d.user_id=auth.uid()
  )r),'[]'::jsonb));
$$;

create or replace function public.submit_drama_request(p_name text,p_notes text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare viewer uuid:=auth.uid(); rid uuid;
begin
  if viewer is null then raise exception 'Entre na sua conta'; end if;
  if public.platform_admin_status() then raise exception 'Use o painel administrativo para gerenciar pedidos'; end if;
  if length(trim(p_name)) not between 2 and 150 or length(coalesce(p_notes,''))>1000 then raise exception 'Confira o nome e as observações do pedido'; end if;
  perform pg_advisory_xact_lock(hashtextextended(viewer::text,9));
  if exists(select 1 from public.drama_requests where user_id=viewer and lower(trim(name))=lower(trim(p_name))) then raise exception 'Você já pediu este dorama'; end if;
  if (select count(*) from public.drama_requests where user_id=viewer)>=3
    and not exists(select 1 from public.request_entitlements where user_id=viewer and unlimited_until>now()) then
    raise exception 'Você usou os 3 pedidos. Para pedir mais, adicione Pedidos ilimitados ao seu plano.';
  end if;
  insert into public.drama_requests(user_id,name,notes) values(viewer,trim(p_name),trim(coalesce(p_notes,''))) returning id into rid;
  return rid;
end; $$;

create or replace function public.admin_drama_requests() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.platform_admin_status() or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Acesso administrativo restrito' using errcode='42501'; end if;
  return jsonb_build_object('requests',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from(
    select d.*,p.name as customer_name,u.email as customer_email from public.drama_requests d
    join auth.users u on u.id=d.user_id left join public.profiles p on p.id=d.user_id
    order by d.created_at desc limit 500)r),'[]'::jsonb),
    'titles',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'published',published) order by name) from public.titles),'[]'::jsonb));
end; $$;

create or replace function public.admin_update_drama_request(p_id uuid,p_status text,p_title text default null,p_note text default '') returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if not public.platform_admin_status() or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Acesso administrativo restrito' using errcode='42501'; end if;
  if p_status not in('received','reviewing','adding','available','unavailable') or length(p_note)>1000 then raise exception 'Dados inválidos'; end if;
  if p_status='available' and not exists(select 1 from public.titles where id=p_title and published) then raise exception 'Vincule um título publicado para disponibilizar o pedido'; end if;
  update public.drama_requests set status=p_status,title_id=nullif(p_title,''),admin_note=trim(p_note),updated_at=now() where id=p_id;
  return found;
end; $$;

revoke all on function public.customer_requests(),public.submit_drama_request(text,text),public.admin_drama_requests(),public.admin_update_drama_request(uuid,text,text,text) from public,anon;
grant execute on function public.customer_requests(),public.submit_drama_request(text,text),public.admin_drama_requests(),public.admin_update_drama_request(uuid,text,text,text) to authenticated;

create or replace function public.admin_set_request_addon(p_user uuid,p_until timestamptz) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.platform_admin_status() or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Acesso administrativo restrito' using errcode='42501'; end if;
  if p_until is null then delete from public.request_entitlements where user_id=p_user;
  else
    if p_until<=now() then raise exception 'Escolha uma validade futura'; end if;
    insert into public.request_entitlements(user_id,unlimited_until) values(p_user,p_until)
      on conflict(user_id) do update set unlimited_until=excluded.unlimited_until;
  end if;
end; $$;
revoke all on function public.admin_set_request_addon(uuid,timestamptz) from public,anon;
grant execute on function public.admin_set_request_addon(uuid,timestamptz) to authenticated;
commit;
