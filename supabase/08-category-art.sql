-- Return only a few category-specific covers instead of downloading every
-- title/category relationship to construct the category tiles on a phone.
create or replace function public.catalog_categories()
returns table(id text,name text,count bigint,covers text[])
language sql stable security invoker set search_path='' as $$
  select c.id,c.name,count(t.id),
    coalesce((array_agg(t.cover order by md5(c.id || ':' || t.id))
      filter(where t.cover is not null and trim(t.cover)<>''))[1:3],array[]::text[])
  from public.categories c
  join public.title_categories tc on tc.category_id=c.id
  join public.titles t on t.id=tc.title_id and t.published
  group by c.id,c.name,c.position order by c.position,c.name;
$$;
revoke all on function public.catalog_categories() from public,anon;
grant execute on function public.catalog_categories() to authenticated;
