begin;
insert into auth.users(id,email) values('10000000-0000-4000-8000-000000000001','category-test@example.invalid');
insert into public.categories(id,name) values('__cat_art_public__','Temporary category'),('__cat_art_empty__','Empty temporary category');
insert into public.titles(id,name,published,cover) values
('__cat_art_title_a__','Temporary A',true,'/img/category-test-a.webp'),
('__cat_art_title_b__','Temporary B',true,'/img/category-test-b.webp'),
('__cat_art_title_hidden__','Temporary hidden',false,'/img/category-test-hidden.webp');
insert into public.title_categories(title_id,category_id) values
('__cat_art_title_a__','__cat_art_public__'),('__cat_art_title_b__','__cat_art_public__'),('__cat_art_title_hidden__','__cat_art_public__');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$declare item record;cover_url text;begin
  select * into item from public.catalog_categories() where id='__cat_art_public__';
  if item.count<>2 or cardinality(item.covers)<>2 then raise exception 'Published category count incorrect';end if;
  if exists(select 1 from public.catalog_categories() where id='__cat_art_empty__') then raise exception 'Empty category leaked';end if;
  for item in select * from public.catalog_categories() loop
    if cardinality(item.covers)>3 then raise exception 'Too many category thumbnails';end if;
    foreach cover_url in array item.covers loop
      if not exists(select 1 from public.titles t join public.title_categories tc on tc.title_id=t.id where tc.category_id=item.id and t.published and t.cover=cover_url) then raise exception 'Cover belongs to another category or unpublished title';end if;
    end loop;
  end loop;
end $$;
reset role;
rollback;
