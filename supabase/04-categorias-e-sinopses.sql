-- ============================================================================
-- KingDrama — categorias + sinopses dos 25 títulos
--
-- Rode inteiro no SQL Editor do Supabase, DEPOIS do 01-schema.sql e do
-- 02-titulos.sql. Pode rodar mais de uma vez: tudo é "on conflict do update"
-- e nenhum título, favorito ou progresso é tocado.
--
-- COMO AS CATEGORIAS FICARAM
-- Primeiro as 11 prateleiras da lista do dono (positions 1 a 10), na ordem em
-- que ele as mandou. Depois, prateleiras específicas tiradas dos próprios
-- títulos (positions 20 a 29), porque as 11 da lista cobriam só 10 dos 25
-- títulos — os outros 15 (herdeiras, CEOs, máfia, vingança, casamento) não
-- tinham onde aparecer. Por último, o idioma (positions 90 e 91).
--
-- A home monta UMA FILEIRA POR CATEGORIA, na ordem do campo "position". Então
-- a ordem daqui é a ordem das fileiras na tela inicial. Categoria sem nenhum
-- título não aparece em lugar nenhum: o próprio site filtra (count > 0). Por
-- isso dá para criar "BL & GL", "Animes" e "Brasileiros" hoje sem custo — elas
-- surgem sozinhas quando o primeiro título entrar.
--
-- IMPORTANTE SOBRE AS SINOPSES
-- Foram escritas a partir do NOME de cada título, não do conteúdo do vídeo —
-- eu não assisti aos episódios. São chamadas de vitrine, de propósito sem nome
-- de personagem e sem contar o final, justamente para não afirmar o que não dá
-- para conferir. Leia antes de divulgar e corrija o que não combinar com a
-- história de verdade: o texto está todo aqui, basta editar e rodar de novo.
-- ============================================================================

-- --------------------------------------------------------------- Categorias
insert into public.categories (id, name, position) values
  -- As 11 da lista. "Início" ficou de fora porque é o menu, não uma gaveta.
  ('novos-lancamentos',   'Novos Lançamentos',        1),
  ('dublado',             'Séries Dubladas',          2),
  ('bebes-e-gravidezes',  'Bebês e Gravidezes',       3),
  ('relacionamento-tabu', 'Relacionamento Tabu',      4),
  ('lobos-e-vampiros',    'Lobos & Vampiros',         5),
  ('bl-e-gl',             'BL & GL',                  6),
  ('brasileiros',         'Brasileiros',              7),
  ('animes',              'Animes',                   8),
  ('identidade-escondida','Identidade Escondida',     9),
  ('recomendados',        'Recomendados Para Você',  10),

  -- Específicas, tiradas dos títulos que já estão no ar.
  ('herdeiras',           'Herdeiras & Heranças',    20),
  ('bilionario',          'Bilionários & CEOs',      21),
  ('mafia',               'Máfia & Submundo',        22),
  ('vinganca',            'Vingança & Virada de Jogo', 23),
  ('realeza',             'Realeza & Época',         24),
  ('magia',               'Magia & Maldições',       25),
  ('casamento-em-crise',  'Casamento em Crise',      26),
  ('segredos-de-familia', 'Segredos de Família',     27),
  ('amores-impossiveis',  'Amores Impossíveis',      28),
  ('superacao',           'Histórias de Superação',  29),

  -- Idioma: informação útil como etiqueta na página do título.
  ('legendado',           'Séries Legendadas',       91)
on conflict (id) do update set name = excluded.name, position = excluded.position;

-- "Dublado" virou "Séries Dubladas" reaproveitando o id antigo, então os 13
-- títulos já marcados continuam valendo. "Legendado" seguiu o mesmo caminho.

-- Duas prateleiras da lista nascem vazias de propósito:
--   Novos Lançamentos    — os 25 títulos entraram todos no mesmo momento, então
--                          nenhum é "novo" ainda. O certo é essa fileira ser
--                          automática, por data de entrada; os títulos que você
--                          está subindo agora serão os primeiros a aparecer.
--   Recomendados Para Você — depende de quem está olhando (favoritos e
--                          histórico), então é fileira calculada, não marcação.
-- Enquanto estiverem vazias elas não aparecem na interface. Se quiser usá-las
-- como vitrine manual enquanto isso, é só marcar títulos nelas abaixo.

-- --------------------------------------------------- Categoria de cada título
-- Cada título recebe de 1 a 4 prateleiras. Para mudar, edite a linha e rode de
-- novo: o insert não duplica.
insert into public.title_categories (title_id, category_id) values
  ('a-camponesa-e-o-lorde-dragao-1794178050',        'realeza'),
  ('a-camponesa-e-o-lorde-dragao-1794178050',        'magia'),
  ('a-camponesa-e-o-lorde-dragao-1794178050',        'amores-impossiveis'),

  ('a-coroa-que-ela-nasceu-pra-usar-1794183408',     'herdeiras'),
  ('a-coroa-que-ela-nasceu-pra-usar-1794183408',     'realeza'),
  ('a-coroa-que-ela-nasceu-pra-usar-1794183408',     'vinganca'),

  ('a-doce-governanta-fugitiva-1794159042',          'identidade-escondida'),
  ('a-doce-governanta-fugitiva-1794159042',          'realeza'),
  ('a-doce-governanta-fugitiva-1794159042',          'amores-impossiveis'),

  ('a-herdeira-rebelde-favorita-1794156584',         'herdeiras'),
  ('a-herdeira-rebelde-favorita-1794156584',         'bilionario'),

  ('a-herdeira-recupera-a-sua-vida-1794159770',      'herdeiras'),
  ('a-herdeira-recupera-a-sua-vida-1794159770',      'vinganca'),
  ('a-herdeira-recupera-a-sua-vida-1794159770',      'superacao'),

  ('a-herdeira-italo--o-noivo-que-me-substimou-1794178743', 'herdeiras'),
  ('a-herdeira-italo--o-noivo-que-me-substimou-1794178743', 'identidade-escondida'),
  ('a-herdeira-italo--o-noivo-que-me-substimou-1794178743', 'bilionario'),
  ('a-herdeira-italo--o-noivo-que-me-substimou-1794178743', 'vinganca'),

  ('a-princesa-das-cinzas-1794185796',               'identidade-escondida'),
  ('a-princesa-das-cinzas-1794185796',               'realeza'),
  ('a-princesa-das-cinzas-1794185796',               'vinganca'),

  ('a-princesa-do-don-herdeira-de-um-imperio-1794184001', 'herdeiras'),
  ('a-princesa-do-don-herdeira-de-um-imperio-1794184001', 'mafia'),

  ('a-vida-secreta-do-meu-marido-bilionario',        'identidade-escondida'),
  ('a-vida-secreta-do-meu-marido-bilionario',        'bilionario'),
  ('a-vida-secreta-do-meu-marido-bilionario',        'casamento-em-crise'),

  ('abandonada-no-altar-escolhida-pelo-duque-1794183775', 'realeza'),
  ('abandonada-no-altar-escolhida-pelo-duque-1794183775', 'vinganca'),

  ('bom-demais-pra-demitir-a-medica-genio-1794173619', 'superacao'),
  ('bom-demais-pra-demitir-a-medica-genio-1794173619', 'vinganca'),

  ('caindo-pelo-maior-inimigo-1794170427',           'amores-impossiveis'),
  ('caindo-pelo-maior-inimigo-1794170427',           'relacionamento-tabu'),

  ('jiaojiao-meu-amor-1794160060',                   'amores-impossiveis'),
  ('jiaojiao-meu-amor-1794160060',                   'segredos-de-familia'),

  ('jogo-na-ilha-a-obsessao-do-meu-ceo-1794154998',  'bilionario'),
  ('jogo-na-ilha-a-obsessao-do-meu-ceo-1794154998',  'relacionamento-tabu'),

  ('meu-marido-nunca-me-escolheu-1794169335',        'casamento-em-crise'),
  ('meu-marido-nunca-me-escolheu-1794169335',        'segredos-de-familia'),

  ('meu-pai-escolheu-outra-familia-1794173605',      'segredos-de-familia'),
  ('meu-pai-escolheu-outra-familia-1794173605',      'vinganca'),

  ('o-calor-da-sua-lingua-1794155444',               'relacionamento-tabu'),
  ('o-calor-da-sua-lingua-1794155444',               'amores-impossiveis'),

  ('o-grande-e-poderoso-genio-1787460327',           'magia'),

  ('o-mafioso-e-a-noiva-hacker-1794178196',          'mafia'),
  ('o-mafioso-e-a-noiva-hacker-1794178196',          'amores-impossiveis'),

  ('o-principe-vampiro-amaldicoado-1794184108',      'lobos-e-vampiros'),
  ('o-principe-vampiro-amaldicoado-1794184108',      'magia'),
  ('o-principe-vampiro-amaldicoado-1794184108',      'realeza'),

  ('o-traidor-da-familia-1794170367',                'mafia'),
  ('o-traidor-da-familia-1794170367',                'segredos-de-familia'),

  ('posso-ler-a-mente-dos-bebes-da-mafia-1794178808', 'bebes-e-gravidezes'),
  ('posso-ler-a-mente-dos-bebes-da-mafia-1794178808', 'mafia'),
  ('posso-ler-a-mente-dos-bebes-da-mafia-1794178808', 'magia'),

  ('troca-de-casais-proibida-1794156381',            'relacionamento-tabu'),
  ('troca-de-casais-proibida-1794156381',            'casamento-em-crise'),

  -- O nome não entrega o gênero deste. "Histórias de Superação" foi onde
  -- coube melhor; corrija quando souber do que ele trata.
  ('vagando-livre-pelo-mundo-1793984181',            'superacao'),

  ('virei-quarterback-minha-ex-capita-de-torcida-implora-pra-eu-voltar-1794173885', 'superacao'),
  ('virei-quarterback-minha-ex-capita-de-torcida-implora-pra-eu-voltar-1794173885', 'vinganca')
on conflict do nothing;

-- Limpeza: tira as gavetas da versão anterior deste arquivo que não existem
-- mais nesta divisão. Se você nunca rodou aquela versão, estas linhas não
-- fazem nada. Apagar a categoria apaga junto só o vínculo com os títulos
-- (on delete cascade) — nenhum título é removido.
--   romance      -> virou as prateleiras específicas
--   proibido     -> virou "Relacionamento Tabu" (da sua lista)
--   familia      -> virou "Segredos de Família"
--   sobrenatural -> virou "Magia & Maldições" e "Lobos & Vampiros"
delete from public.categories where id in ('romance', 'proibido', 'familia', 'sobrenatural');

-- ------------------------------------------------------------------ Sinopses
-- Escritas a partir do nome do título (leia o aviso no topo do arquivo).
update public.titles as t set synopsis = s.texto
from (values

  ('a-camponesa-e-o-lorde-dragao-1794178050',
   'Ela nasceu para cuidar da terra; ele comanda uma linhagem de dragões. Quando o lorde escolhe a camponesa, o reino inteiro decide que o lugar dela é bem longe do castelo — e nenhum dos dois pretende obedecer.'),

  ('a-coroa-que-ela-nasceu-pra-usar-1794183408',
   'Criada longe do palácio, ela descobre que a coroa que lhe pertence está na cabeça de outra pessoa. Entre intrigas da corte e um aliado improvável, cada passo é um lance para reclamar o que é seu por nascimento.'),

  ('a-doce-governanta-fugitiva-1794159042',
   'Ela entra na mansão com outro nome e um passado que não pode alcançá-la. O patrão desconfia de tudo, menos do próprio coração — e a mentira que a mantém a salvo é exatamente a que pode destruí-la.'),

  ('a-herdeira-rebelde-favorita-1794156584',
   'Herdeira de uma fortuna que nunca pediu, ela despreza regras, contratos e o noivo arranjado. A família aposta que ela não dura um mês sem o dinheiro; ela aposta que o mundo é dela de qualquer jeito.'),

  ('a-herdeira-recupera-a-sua-vida-1794159770',
   'Tiraram dela o nome, a herança e o lugar na própria família. Agora ela volta sem pressa e sem perdão, recuperando um pedaço por vez — e quem a descartou vai receber a conta.'),

  ('a-herdeira-italo--o-noivo-que-me-substimou-1794178743',
   'O noivo a tratou como uma interiorana sem posses, perfeita para ser humilhada diante da família dele. Ele só não contou com o sobrenome que ela guardou em silêncio — nem com o império que vem junto.'),

  ('a-princesa-das-cinzas-1794185796',
   'Ela saiu viva do incêndio que apagou sua casa e seu nome. Volta à corte como estranha, com as marcas à vista e a memória intacta, disposta a cobrar de cada um que a deixou queimar.'),

  ('a-princesa-do-don-herdeira-de-um-imperio-1794184001',
   'Filha única do chefe mais temido da cidade, ela cresceu entre guarda-costas e segredos. Quando o império do pai começa a cair, a princesa precisa decidir se vai apenas herdá-lo — ou comandá-lo.'),

  ('a-vida-secreta-do-meu-marido-bilionario',
   'Ele dizia ter um emprego comum, um salário comum e uma vida simples. A verdade sobre o homem com quem ela se casou é grande demais para caber num casamento — e perigosa demais para continuar escondida.'),

  ('abandonada-no-altar-escolhida-pelo-duque-1794183775',
   'Ela ficou sozinha no altar diante de toda a nobreza, humilhada por um noivo que não apareceu. No mesmo dia, o duque mais poderoso do reino estende a mão — e a vergonha dela vira o escândalo de outra pessoa.'),

  ('bom-demais-pra-demitir-a-medica-genio-1794173619',
   'Contratada como a última da fila, ela é tratada como estorvo até chegar o primeiro caso que ninguém resolve. Cada diagnóstico certo deixa os chefes com o mesmo problema: ela é boa demais para ser demitida.'),

  ('caindo-pelo-maior-inimigo-1794170427',
   'Eles disputam o mesmo cargo, a mesma herança e a mesma vontade de ver o outro perder. O plano era destruir o inimigo; ninguém avisou que a linha entre ódio e desejo era fina assim.'),

  ('jiaojiao-meu-amor-1794160060',
   'Um amor que começa simples e cobra caro. Entre famílias que não aprovam e escolhas sem volta, os dois descobrem quanto custa continuar juntos.'),

  ('jogo-na-ilha-a-obsessao-do-meu-ceo-1794154998',
   'Uma viagem de trabalho numa ilha isolada, um jogo com regras que ninguém leu até o fim e um CEO que não disfarça mais a obsessão. Sair da ilha vai dar mais trabalho do que chegar nela.'),

  ('meu-marido-nunca-me-escolheu-1794169335',
   'Anos de casamento, e ela sempre foi a segunda opção: depois da família dele, da carreira, do amor antigo que nunca terminou. Até o dia em que ela para de esperar ser escolhida e escolhe a si mesma.'),

  ('meu-pai-escolheu-outra-familia-1794173605',
   'Ele tinha outra casa, outros filhos e outro nome do outro lado da cidade. Quando a verdade aparece, dois lados da mesma família precisam encarar o homem que mentiu para os dois.'),

  ('o-calor-da-sua-lingua-1794155444',
   'Uma provocação atrás da outra, e nenhum dos dois recua. O que começa como disputa de palavras vira a tensão que nenhum deles admite em voz alta.'),

  ('o-grande-e-poderoso-genio-1787460327',
   'Três desejos, um gênio com opinião própria e alguém completamente despreparado para o poder que acaba de cair na sua mão. Cada pedido realizado cobra um preço que não estava combinado.'),

  ('o-mafioso-e-a-noiva-hacker-1794178196',
   'Ele manda na cidade pela força; ela derruba impérios com um notebook. Um casamento de fachada une os dois contra um inimigo em comum — e contra a vontade de se apaixonar.'),

  ('o-principe-vampiro-amaldicoado-1794184108',
   'Condenado a viver sem sol e sem amor, o príncipe aceitou a maldição como destino. Até encontrar a única pessoa capaz de quebrá-la — e também de matá-lo.'),

  ('o-traidor-da-familia-1794170367',
   'Alguém de dentro entregou a família, e o sangue não protege mais ninguém. Entre juras de lealdade e contas antigas, descobrir o traidor é a única forma de continuar vivo.'),

  ('posso-ler-a-mente-dos-bebes-da-mafia-1794178808',
   'Ela aceita cuidar dos bebês do homem mais temido da cidade e descobre que escuta tudo o que eles pensam. As crianças sabem quem está tramando contra o pai — e só ela pode avisar.'),

  ('troca-de-casais-proibida-1794156381',
   'Dois casais, uma noite que ninguém deveria ter aceitado e um acordo que atravessa todos os limites. Depois que a linha é cruzada, não existe volta para nenhum dos quatro.'),

  ('vagando-livre-pelo-mundo-1793984181',
   'Sem endereço fixo e sem ninguém esperando em casa, a estrada é o único plano. Cada cidade deixa uma história — e uma delas vai pedir que essa viagem finalmente pare.'),

  ('virei-quarterback-minha-ex-capita-de-torcida-implora-pra-eu-voltar-1794173885',
   'Ele era o garoto que ninguém via no corredor, dispensado pela namorada mais popular do colégio. Um ano, um time e um uniforme de quarterback depois, é ela quem aparece pedindo uma segunda chance.')

) as s(id, texto)
where t.id = s.id;

-- --------------------------------------------------------- Nomes com defeito
-- Achados ao revisar o catálogo. Trocar o "name" é seguro: o "id" não muda,
-- então as URLs (/titulo/<id>), os favoritos e o progresso continuam valendo.
--
-- Estas mesmas correções já foram aplicadas no 02-titulos.sql, senão rodar
-- aquele arquivo de novo desfaria tudo aqui (ele tem "do update set name").

-- Maiúsculas fora de padrão.
update public.titles set name = 'A Vida Secreta do Meu Marido Bilionário'
  where id = 'a-vida-secreta-do-meu-marido-bilionario';
update public.titles set name = 'Bom Demais pra Demitir: A Médica Gênio'
  where id = 'bom-demais-pra-demitir-a-medica-genio-1794173619';
update public.titles set name = 'Jogo na Ilha: A Obsessão do Meu CEO'
  where id = 'jogo-na-ilha-a-obsessao-do-meu-ceo-1794154998';

-- Erro de digitação: "Substimou" -> "Subestimou".
update public.titles set name = replace(name, 'Substimou', 'Subestimou')
  where id = 'a-herdeira-italo--o-noivo-que-me-substimou-1794178743';

-- FALTA VOCÊ DECIDIR: o nome deste título está cortado — "A Herdeira Ítalo- :"
-- ficou com um hífen solto, como se tivesse perdido uma palavra
-- (Ítalo-Americana? Ítalo-Brasileira?). Não inventei o que falta. Complete e
-- descomente a linha abaixo:
-- update public.titles set name = 'A Herdeira Ítalo-Americana: O Noivo que Me Subestimou'
--   where id = 'a-herdeira-italo--o-noivo-que-me-substimou-1794178743';

-- ---------------------------------------------------------------- Conferência
-- Esperado: 25 títulos, 25 com sinopse, 21 categorias, nenhum título sem
-- prateleira de conteúdo (idioma não conta).
select 'titulos'           as conferencia, count(*)::text from public.titles
union all select 'com sinopse', count(*)::text from public.titles where synopsis is not null and btrim(synopsis) <> ''
union all select 'categorias',  count(*)::text from public.categories
union all select 'sem prateleira', count(*)::text from public.titles t
  where not exists (
    select 1 from public.title_categories tc
    join public.categories c on c.id = tc.category_id
    where tc.title_id = t.id and c.position < 90
  );

-- Quantos títulos em cada prateleira. As que aparecem com 0 ficam invisíveis
-- no site até ganharem o primeiro título.
select c.position, c.name, count(tc.title_id) as titulos
from public.categories c
left join public.title_categories tc on tc.category_id = c.id
group by c.position, c.name
order by c.position;
