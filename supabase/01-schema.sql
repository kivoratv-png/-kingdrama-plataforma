-- ============================================================================
-- KingDrama — estrutura do banco no Supabase
--
-- Rode este arquivo UMA VEZ, inteiro, no SQL Editor do Supabase.
-- Ele cria as tabelas, liga o RLS (Row Level Security) e define quem pode ler
-- e escrever o quê.
--
-- A ideia central da segurança:
--   - o catálogo (títulos, capas, sinopses) é visível para quem está logado;
--   - a LISTA de episódios só aparece para quem tem assinatura ativa;
--   - o ID do vídeo na Bunny NÃO é visível para ninguém pelo navegador.
--     Ele mora em episode_sources, que nenhuma chave pública alcança. Só o
--     servidor (service_role, dentro de uma Netlify Function) lê essa tabela
--     para assinar a URL do vídeo.
-- ============================================================================

-- ------------------------------------------------------------------ Perfis
-- Espelha auth.users com os dados que o site mostra.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text,
  created_at  timestamptz not null default now()
);

-- Cria o perfil sozinho quando alguém se cadastra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'name'), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------- Categorias
create table if not exists public.categories (
  id        text primary key,          -- slug: "romance", "vinganca"
  name      text not null,
  position  int  not null default 0
);

-- ----------------------------------------------------------------- Títulos
create table if not exists public.titles (
  id          text primary key,        -- slug da URL: /titulo/<id>
  name        text not null,
  synopsis    text,
  cover       text,                    -- caminho da capa
  year        int,
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.title_categories (
  title_id     text not null references public.titles (id)     on delete cascade,
  category_id  text not null references public.categories (id) on delete cascade,
  primary key (title_id, category_id)
);

create index if not exists idx_title_categories_category on public.title_categories (category_id);

-- --------------------------------------------------------------- Episódios
-- Só metadado. O vídeo em si fica em episode_sources.
create table if not exists public.episodes (
  id          bigint generated always as identity primary key,
  title_id    text not null references public.titles (id) on delete cascade,
  number      int  not null,
  name        text,
  duration_s  int,
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (title_id, number)
);

create index if not exists idx_episodes_title on public.episodes (title_id, number);

-- ------------------------------------------------- Vídeo na Bunny (SEGREDO)
-- Esta tabela NUNCA é lida pelo navegador. Sem policy de RLS, nem a chave
-- anon nem a de usuário logado enxergam nada aqui — só o service_role,
-- usado no servidor para gerar a URL assinada.
create table if not exists public.episode_sources (
  episode_id        bigint primary key references public.episodes (id) on delete cascade,
  bunny_library_id  text,
  bunny_video_id    text not null,
  license_note      text,              -- de onde veio o direito de exibir
  updated_at        timestamptz not null default now()
);

-- ------------------------------------------------------------- Assinaturas
-- Quem escreve aqui é o webhook do pagamento (service_role), nunca o cliente.
create table if not exists public.subscriptions (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  status        text not null default 'pending'
                check (status in ('pending','active','canceled','refunded','expired','chargeback')),
  plan          text,
  provider      text,                  -- mercadopago, stripe...
  provider_ref  text,                  -- id da assinatura no gateway
  started_at    timestamptz,
  ends_at       timestamptz,           -- null = sem prazo (vitalício)
  updated_at    timestamptz not null default now()
);

create index if not exists idx_subscriptions_user on public.subscriptions (user_id, status);

-- ------------------------------------------------- Lista e progresso
create table if not exists public.favorites (
  user_id     uuid not null references auth.users (id)  on delete cascade,
  title_id    text not null references public.titles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, title_id)
);

create table if not exists public.watch_progress (
  user_id     uuid   not null references auth.users (id)    on delete cascade,
  episode_id  bigint not null references public.episodes (id) on delete cascade,
  position_s  int    not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, episode_id)
);

-- ============================================================================
-- Quem tem acesso liberado
-- ============================================================================
create or replace function public.has_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = auth.uid()
      and s.status  = 'active'
      and (s.ends_at is null or s.ends_at > now())
  );
$$;

-- ============================================================================
-- RLS — por padrão ninguém vê nada; as policies abaixo abrem o mínimo
-- ============================================================================
alter table public.profiles         enable row level security;
alter table public.categories       enable row level security;
alter table public.titles           enable row level security;
alter table public.title_categories enable row level security;
alter table public.episodes         enable row level security;
alter table public.episode_sources  enable row level security;
alter table public.subscriptions    enable row level security;
alter table public.favorites        enable row level security;
alter table public.watch_progress   enable row level security;

-- Trava extra na tabela do vídeo: nem o GRANT padrão do Supabase vale aqui.
revoke all on public.episode_sources from anon, authenticated;

-- ---- Perfil: cada um cuida do seu
drop policy if exists "perfil proprio: ler"      on public.profiles;
drop policy if exists "perfil proprio: atualizar" on public.profiles;
create policy "perfil proprio: ler"       on public.profiles for select using  (auth.uid() = id);
create policy "perfil proprio: atualizar" on public.profiles for update using  (auth.uid() = id)
                                                                    with check (auth.uid() = id);

-- ---- Catálogo: quem está logado vê o que está publicado
drop policy if exists "categorias: ler" on public.categories;
create policy "categorias: ler" on public.categories
  for select to authenticated using (true);

drop policy if exists "titulos: ler publicados" on public.titles;
create policy "titulos: ler publicados" on public.titles
  for select to authenticated using (published);

drop policy if exists "titulo-categoria: ler" on public.title_categories;
create policy "titulo-categoria: ler" on public.title_categories
  for select to authenticated using (
    exists (select 1 from public.titles t where t.id = title_id and t.published)
  );

-- ---- Episódios: só com assinatura ativa
drop policy if exists "episodios: ler com acesso" on public.episodes;
create policy "episodios: ler com acesso" on public.episodes
  for select to authenticated using (
    published
    and public.has_access()
    and exists (select 1 from public.titles t where t.id = title_id and t.published)
  );

-- ---- episode_sources: nenhuma policy de propósito. Só o service_role lê.

-- ---- Assinatura: o usuário vê a dele, mas não mexe
drop policy if exists "assinatura propria: ler" on public.subscriptions;
create policy "assinatura propria: ler" on public.subscriptions
  for select to authenticated using (auth.uid() = user_id);

-- ---- Minha lista
drop policy if exists "favoritos: ler"    on public.favorites;
drop policy if exists "favoritos: criar"  on public.favorites;
drop policy if exists "favoritos: apagar" on public.favorites;
create policy "favoritos: ler"    on public.favorites for select to authenticated using (auth.uid() = user_id);
create policy "favoritos: criar"  on public.favorites for insert to authenticated with check (auth.uid() = user_id and public.has_access());
create policy "favoritos: apagar" on public.favorites for delete to authenticated using (auth.uid() = user_id);

-- ---- Continuar assistindo
drop policy if exists "progresso: ler"       on public.watch_progress;
drop policy if exists "progresso: gravar"    on public.watch_progress;
drop policy if exists "progresso: atualizar" on public.watch_progress;
create policy "progresso: ler"       on public.watch_progress for select to authenticated using (auth.uid() = user_id);
create policy "progresso: gravar"    on public.watch_progress for insert to authenticated with check (auth.uid() = user_id and public.has_access());
create policy "progresso: atualizar" on public.watch_progress for update to authenticated using (auth.uid() = user_id)
                                                                                     with check (auth.uid() = user_id);

-- ============================================================================
-- Pronto. Confira em Database > Tables que todas aparecem com "RLS enabled".
-- ============================================================================
