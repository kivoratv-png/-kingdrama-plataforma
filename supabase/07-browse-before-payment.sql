begin;
-- Episode metadata is part of the catalog. Streaming identifiers remain in
-- episode_sources, which has no customer read policy.
drop policy if exists "episodios: ler com acesso" on public.episodes;
drop policy if exists "episodios: ler publicados" on public.episodes;
create policy "episodios: ler publicados" on public.episodes
  for select to authenticated using (published and exists (
    select 1 from public.titles t where t.id=title_id and t.published
  ));

drop policy if exists "favoritos: criar" on public.favorites;
create policy "favoritos: criar" on public.favorites for insert to authenticated
  with check(auth.uid()=user_id and exists (
    select 1 from public.titles t where t.id=title_id and t.published
  ));
commit;
