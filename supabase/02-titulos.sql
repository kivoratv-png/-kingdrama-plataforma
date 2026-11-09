-- ============================================================================
-- KingDrama - carga inicial: 25 titulos vindos da Bunny
-- Gerado de sincronizacao_bunny_25.csv. Rode DEPOIS do 01-schema.sql.
-- Pode rodar mais de uma vez: usa on conflict do update.
-- ============================================================================

-- Categorias (por enquanto, o idioma - troque por genero quando quiser)
insert into public.categories (id, name, position) values
  ('dublado','Dublado',1), ('legendado','Legendado',2)
on conflict (id) do update set name = excluded.name, position = excluded.position;

-- Titulos
insert into public.titles (id, name, synopsis, cover, year, published) values
  ('a-camponesa-e-o-lorde-dragao-1794178050', 'A Camponesa e o Lorde Dragão', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/a-camponesa-e-o-lorde-dragao-1794178050.webp', 2026, true),
  ('a-coroa-que-ela-nasceu-pra-usar-1794183408', 'A Coroa que Ela Nasceu pra Usar', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/a-coroa-que-ela-nasceu-pra-usar-1794183408.webp', 2026, true),
  ('a-doce-governanta-fugitiva-1794159042', 'A Doce Governanta Fugitiva', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/a-doce-governanta-fugitiva-1794159042.webp', 2026, true),
  ('a-herdeira-rebelde-favorita-1794156584', 'A Herdeira Rebelde Favorita', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/a-herdeira-rebelde-favorita-1794156584.webp', 2026, true),
  ('a-herdeira-recupera-a-sua-vida-1794159770', 'A Herdeira Recupera a Sua Vida', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/a-herdeira-recupera-a-sua-vida-1794159770.webp', 2026, true),
  ('a-herdeira-italo--o-noivo-que-me-substimou-1794178743', 'A Herdeira Ítalo- : o Noivo que Me Subestimou', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/a-herdeira-italo--o-noivo-que-me-substimou-1794178743.webp', 2026, true),
  ('a-princesa-das-cinzas-1794185796', 'A Princesa das Cinzas', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/a-princesa-das-cinzas-1794185796.webp', 2026, true),
  ('a-princesa-do-don-herdeira-de-um-imperio-1794184001', 'A Princesa do Don, Herdeira de um Império', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/a-princesa-do-don-herdeira-de-um-imperio-1794184001.webp', 2026, true),
  ('a-vida-secreta-do-meu-marido-bilionario', 'A Vida Secreta do Meu Marido Bilionário', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/a-vida-secreta-do-meu-marido-bilionario.webp', 2025, true),
  ('abandonada-no-altar-escolhida-pelo-duque-1794183775', 'Abandonada no Altar, Escolhida Pelo Duque', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/abandonada-no-altar-escolhida-pelo-duque-1794183775.webp', 2026, true),
  ('bom-demais-pra-demitir-a-medica-genio-1794173619', 'Bom Demais pra Demitir: A Médica Gênio', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/bom-demais-pra-demitir-a-medica-genio-1794173619.webp', 2026, true),
  ('caindo-pelo-maior-inimigo-1794170427', 'Caindo Pelo Maior Inimigo', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/caindo-pelo-maior-inimigo-1794170427.webp', 2026, true),
  ('jiaojiao-meu-amor-1794160060', 'Jiaojiao, Meu Amor', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/jiaojiao-meu-amor-1794160060.webp', 2026, true),
  ('jogo-na-ilha-a-obsessao-do-meu-ceo-1794154998', 'Jogo na Ilha: A Obsessão do Meu CEO', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/jogo-na-ilha-a-obsessao-do-meu-ceo-1794154998.webp', 2026, true),
  ('meu-marido-nunca-me-escolheu-1794169335', 'Meu Marido Nunca Me Escolheu', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/meu-marido-nunca-me-escolheu-1794169335.webp', 2026, true),
  ('meu-pai-escolheu-outra-familia-1794173605', 'Meu Pai Escolheu Outra Família', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/meu-pai-escolheu-outra-familia-1794173605.webp', 2026, true),
  ('o-calor-da-sua-lingua-1794155444', 'O Calor da Sua Língua', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/o-calor-da-sua-lingua-1794155444.webp', 2026, true),
  ('o-grande-e-poderoso-genio-1787460327', 'O Grande e Poderoso Gênio', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/o-grande-e-poderoso-genio-1787460327.webp', 2026, true),
  ('o-mafioso-e-a-noiva-hacker-1794178196', 'O Mafioso e a Noiva Hacker', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/o-mafioso-e-a-noiva-hacker-1794178196.webp', 2026, true),
  ('o-principe-vampiro-amaldicoado-1794184108', 'O Príncipe Vampiro Amaldiçoado', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/o-principe-vampiro-amaldicoado-1794184108.webp', 2026, true),
  ('o-traidor-da-familia-1794170367', 'O Traidor da Família', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/o-traidor-da-familia-1794170367.webp', 2026, true),
  ('posso-ler-a-mente-dos-bebes-da-mafia-1794178808', 'Posso Ler a Mente dos Bebês da Máfia', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/posso-ler-a-mente-dos-bebes-da-mafia-1794178808.webp', 2026, true),
  ('troca-de-casais-proibida-1794156381', 'Troca de Casais Proibida', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/troca-de-casais-proibida-1794156381.webp', 2026, true),
  ('vagando-livre-pelo-mundo-1793984181', 'Vagando Livre Pelo Mundo', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/vagando-livre-pelo-mundo-1793984181.webp', 2026, true),
  ('virei-quarterback-minha-ex-capita-de-torcida-implora-pra-eu-voltar-1794173885', 'Virei Quarterback, Minha Ex, Capitã de Torcida, Implora pra Eu Voltar', null, 'https://yvwdhuphzyjfhfsqdeho.supabase.co/storage/v1/object/public/capas/virei-quarterback-minha-ex-capita-de-torcida-implora-pra-eu-voltar-1794173885.webp', 2026, true)
on conflict (id) do update set name = excluded.name, cover = excluded.cover, year = excluded.year, published = excluded.published;

-- Idioma de cada titulo
insert into public.title_categories (title_id, category_id) values
  ('a-camponesa-e-o-lorde-dragao-1794178050', 'dublado'),
  ('a-coroa-que-ela-nasceu-pra-usar-1794183408', 'legendado'),
  ('a-doce-governanta-fugitiva-1794159042', 'legendado'),
  ('a-herdeira-rebelde-favorita-1794156584', 'legendado'),
  ('a-herdeira-recupera-a-sua-vida-1794159770', 'dublado'),
  ('a-herdeira-italo--o-noivo-que-me-substimou-1794178743', 'dublado'),
  ('a-princesa-das-cinzas-1794185796', 'legendado'),
  ('a-princesa-do-don-herdeira-de-um-imperio-1794184001', 'dublado'),
  ('a-vida-secreta-do-meu-marido-bilionario', 'dublado'),
  ('abandonada-no-altar-escolhida-pelo-duque-1794183775', 'legendado'),
  ('bom-demais-pra-demitir-a-medica-genio-1794173619', 'legendado'),
  ('caindo-pelo-maior-inimigo-1794170427', 'legendado'),
  ('jiaojiao-meu-amor-1794160060', 'legendado'),
  ('jogo-na-ilha-a-obsessao-do-meu-ceo-1794154998', 'dublado'),
  ('meu-marido-nunca-me-escolheu-1794169335', 'legendado'),
  ('meu-pai-escolheu-outra-familia-1794173605', 'legendado'),
  ('o-calor-da-sua-lingua-1794155444', 'legendado'),
  ('o-grande-e-poderoso-genio-1787460327', 'legendado'),
  ('o-mafioso-e-a-noiva-hacker-1794178196', 'legendado'),
  ('o-principe-vampiro-amaldicoado-1794184108', 'legendado'),
  ('o-traidor-da-familia-1794170367', 'dublado'),
  ('posso-ler-a-mente-dos-bebes-da-mafia-1794178808', 'legendado'),
  ('troca-de-casais-proibida-1794156381', 'legendado'),
  ('vagando-livre-pelo-mundo-1793984181', 'legendado'),
  ('virei-quarterback-minha-ex-capita-de-torcida-implora-pra-eu-voltar-1794173885', 'dublado')
on conflict do nothing;

-- Um episodio por titulo (o filme inteiro)
insert into public.episodes (title_id, number, name, duration_s, published) values
  ('a-camponesa-e-o-lorde-dragao-1794178050', 1, null, 4662, true),
  ('a-coroa-que-ela-nasceu-pra-usar-1794183408', 1, null, 2424, true),
  ('a-doce-governanta-fugitiva-1794159042', 1, null, 2940, true),
  ('a-herdeira-rebelde-favorita-1794156584', 1, null, 2154, true),
  ('a-herdeira-recupera-a-sua-vida-1794159770', 1, null, 3390, true),
  ('a-herdeira-italo--o-noivo-que-me-substimou-1794178743', 1, null, 2328, true),
  ('a-princesa-das-cinzas-1794185796', 1, null, 2796, true),
  ('a-princesa-do-don-herdeira-de-um-imperio-1794184001', 1, null, 3276, true),
  ('a-vida-secreta-do-meu-marido-bilionario', 1, null, 5004, true),
  ('abandonada-no-altar-escolhida-pelo-duque-1794183775', 1, null, 6126, true),
  ('bom-demais-pra-demitir-a-medica-genio-1794173619', 1, null, 3048, true),
  ('caindo-pelo-maior-inimigo-1794170427', 1, null, 3438, true),
  ('jiaojiao-meu-amor-1794160060', 1, null, 9774, true),
  ('jogo-na-ilha-a-obsessao-do-meu-ceo-1794154998', 1, null, 4932, true),
  ('meu-marido-nunca-me-escolheu-1794169335', 1, null, 3804, true),
  ('meu-pai-escolheu-outra-familia-1794173605', 1, null, 5022, true),
  ('o-calor-da-sua-lingua-1794155444', 1, null, 4500, true),
  ('o-grande-e-poderoso-genio-1787460327', 1, null, 4428, true),
  ('o-mafioso-e-a-noiva-hacker-1794178196', 1, null, 5190, true),
  ('o-principe-vampiro-amaldicoado-1794184108', 1, null, 2382, true),
  ('o-traidor-da-familia-1794170367', 1, null, 7632, true),
  ('posso-ler-a-mente-dos-bebes-da-mafia-1794178808', 1, null, 2898, true),
  ('troca-de-casais-proibida-1794156381', 1, null, 5220, true),
  ('vagando-livre-pelo-mundo-1793984181', 1, null, 5148, true),
  ('virei-quarterback-minha-ex-capita-de-torcida-implora-pra-eu-voltar-1794173885', 1, null, 2316, true)
on conflict (title_id, number) do update set duration_s = excluded.duration_s, published = excluded.published;

-- Video na Bunny. Esta tabela nao e visivel pelo navegador (ver 01-schema.sql).
insert into public.episode_sources (episode_id, bunny_library_id, bunny_video_id, license_note)
select e.id, v.lib, v.vid, v.nota
from (values
  ('a-camponesa-e-o-lorde-dragao-1794178050', '803532', 'f4ce56f9-3a72-459b-88b9-0da77e3986f6', 'Importado de sincronizacao_bunny_25.csv'),
  ('a-coroa-que-ela-nasceu-pra-usar-1794183408', '803532', 'eb3f40fa-5c34-42b5-823e-d7750cd1fdc7', 'Importado de sincronizacao_bunny_25.csv'),
  ('a-doce-governanta-fugitiva-1794159042', '803532', '590ffa1e-01e5-4add-b861-b6f385ac9359', 'Importado de sincronizacao_bunny_25.csv'),
  ('a-herdeira-rebelde-favorita-1794156584', '803532', '034561ac-5124-4dfc-82a6-43985b7cd6e4', 'Importado de sincronizacao_bunny_25.csv'),
  ('a-herdeira-recupera-a-sua-vida-1794159770', '803532', '9ffd6425-f3ac-434c-ab76-c8606b83f877', 'Importado de sincronizacao_bunny_25.csv'),
  ('a-herdeira-italo--o-noivo-que-me-substimou-1794178743', '803532', '9cc85981-a91c-4bbf-8cad-d56dbc7157d3', 'Importado de sincronizacao_bunny_25.csv'),
  ('a-princesa-das-cinzas-1794185796', '803532', '54566ca5-f705-4814-aac6-9606bbef52fd', 'Importado de sincronizacao_bunny_25.csv'),
  ('a-princesa-do-don-herdeira-de-um-imperio-1794184001', '803532', '92d2f88d-6f08-473b-9c8d-d9c7e98bc0e0', 'Importado de sincronizacao_bunny_25.csv'),
  ('a-vida-secreta-do-meu-marido-bilionario', '803532', '7d42d799-46c1-4ff2-b77e-343b57932396', 'Importado de sincronizacao_bunny_25.csv'),
  ('abandonada-no-altar-escolhida-pelo-duque-1794183775', '803532', '0060962d-af41-406a-ad5f-6834e17c22b5', 'Importado de sincronizacao_bunny_25.csv'),
  ('bom-demais-pra-demitir-a-medica-genio-1794173619', '803532', '27619588-684a-4276-9c2d-bf630be11168', 'Importado de sincronizacao_bunny_25.csv'),
  ('caindo-pelo-maior-inimigo-1794170427', '803532', '1bcbaf7d-b2b9-4dde-9faa-7b849c19d805', 'Importado de sincronizacao_bunny_25.csv'),
  ('jiaojiao-meu-amor-1794160060', '803532', 'da7353c1-e56b-46d0-810f-33af8c5fbeb4', 'Importado de sincronizacao_bunny_25.csv'),
  ('jogo-na-ilha-a-obsessao-do-meu-ceo-1794154998', '803532', '302a74a4-37cc-402e-93d5-5cf877e2add4', 'Importado de sincronizacao_bunny_25.csv'),
  ('meu-marido-nunca-me-escolheu-1794169335', '803532', '4fa7db56-3187-4145-bd9c-6a6cb3d0fb42', 'Importado de sincronizacao_bunny_25.csv'),
  ('meu-pai-escolheu-outra-familia-1794173605', '803532', 'e5310c09-8de7-44c0-8832-000c16f22ceb', 'Importado de sincronizacao_bunny_25.csv'),
  ('o-calor-da-sua-lingua-1794155444', '803532', '76704901-a9c3-4d48-bd08-35cf69db8783', 'Importado de sincronizacao_bunny_25.csv'),
  ('o-grande-e-poderoso-genio-1787460327', '803532', 'fa65c178-1860-4554-9b3f-35a3f3b4309a', 'Importado de sincronizacao_bunny_25.csv'),
  ('o-mafioso-e-a-noiva-hacker-1794178196', '803532', '7f4f20c6-11f7-4998-b8d7-badbd7fe1e83', 'Importado de sincronizacao_bunny_25.csv'),
  ('o-principe-vampiro-amaldicoado-1794184108', '803532', '5c5800b5-92ee-4df3-afaf-bd0ae64d9e08', 'Importado de sincronizacao_bunny_25.csv'),
  ('o-traidor-da-familia-1794170367', '803532', 'b15626e6-982f-4075-aa01-da867a587936', 'Importado de sincronizacao_bunny_25.csv'),
  ('posso-ler-a-mente-dos-bebes-da-mafia-1794178808', '803532', '4f823b18-da00-4af7-abbc-2fc0630a276b', 'Importado de sincronizacao_bunny_25.csv'),
  ('troca-de-casais-proibida-1794156381', '803532', '62250ea3-2b55-4fa5-b3cc-02fb01b72908', 'Importado de sincronizacao_bunny_25.csv'),
  ('vagando-livre-pelo-mundo-1793984181', '803532', 'a554696c-da43-497b-a88e-3c3d81f7a46c', 'Importado de sincronizacao_bunny_25.csv'),
  ('virei-quarterback-minha-ex-capita-de-torcida-implora-pra-eu-voltar-1794173885', '803532', '9dafc59e-7f88-45e9-b8c5-ecbb539dcde5', 'Importado de sincronizacao_bunny_25.csv')
) as v(slug, lib, vid, nota)
join public.episodes e on e.title_id = v.slug and e.number = 1
on conflict (episode_id) do update set bunny_video_id = excluded.bunny_video_id, bunny_library_id = excluded.bunny_library_id, updated_at = now();

-- Conferencia
select 'titulos' as tabela, count(*) from public.titles
union all select 'episodios', count(*) from public.episodes
union all select 'videos', count(*) from public.episode_sources;
