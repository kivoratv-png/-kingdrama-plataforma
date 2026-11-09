-- ============================================================================
-- KingDrama — categorias por gênero + sinopses dos 25 títulos
--
-- Rode inteiro no SQL Editor do Supabase, DEPOIS do 01-schema.sql e do
-- 02-titulos.sql. Pode rodar mais de uma vez sem estragar nada (tudo usa
-- "on conflict do update") e não apaga nenhum dado existente.
--
-- O QUE MUDA
-- 1. Os gêneros passam a existir como categorias. A home monta uma fileira por
--    categoria, na ordem do campo "position" — então a ordem daqui é a ordem em
--    que as fileiras aparecem na tela inicial.
-- 2. "Dublado" e "Legendado" continuam existindo, mas vão para o fim da lista
--    (position 90 e 91). São informação útil para o assinante e aparecem como
--    etiqueta na página do título; só deixam de ser as duas únicas gavetas do
--    catálogo.
-- 3. Cada título recebe de 1 a 3 gêneros e uma sinopse.
--
-- IMPORTANTE SOBRE AS SINOPSES
-- Foram escritas a partir do NOME de cada título, não do conteúdo do vídeo —
-- eu não assisti aos episódios. São chamadas de vitrine, de propósito sem nome
-- de personagem e sem contar o final, justamente para não afirmar o que não dá
-- para confirmar. Leia antes de divulgar e corrija o que não combinar com a
-- história de verdade: o texto está todo aqui, basta editar e rodar de novo.
-- ============================================================================

-- --------------------------------------------------------------- Categorias
insert into public.categories (id, name, position) values
  ('romance',      'Romance',                 1),
  ('bilionario',   'Bilionários e CEOs',      2),
  ('vinganca',     'Vingança e Reviravolta',  3),
  ('mafia',        'Máfia',                   4),
  ('realeza',      'Época e Realeza',         5),
  ('proibido',     'Amor Proibido',           6),
  ('familia',      'Família e Segredos',      7),
  ('sobrenatural', 'Sobrenatural',            8),
  ('dublado',      'Dublado',                90),
  ('legendado',    'Legendado',              91)
on conflict (id) do update set name = excluded.name, position = excluded.position;

-- --------------------------------------------------- Gênero de cada título
-- Deduzido do nome do título. Se algum estiver na gaveta errada, troque a
-- linha aqui e rode de novo (o insert não duplica).
insert into public.title_categories (title_id, category_id) values
  ('a-camponesa-e-o-lorde-dragao-1794178050',        'romance'),
  ('a-camponesa-e-o-lorde-dragao-1794178050',        'sobrenatural'),
  ('a-camponesa-e-o-lorde-dragao-1794178050',        'realeza'),

  ('a-coroa-que-ela-nasceu-pra-usar-1794183408',     'realeza'),
  ('a-coroa-que-ela-nasceu-pra-usar-1794183408',     'vinganca'),
  ('a-coroa-que-ela-nasceu-pra-usar-1794183408',     'romance'),

  ('a-doce-governanta-fugitiva-1794159042',          'romance'),
  ('a-doce-governanta-fugitiva-1794159042',          'proibido'),
  ('a-doce-governanta-fugitiva-1794159042',          'realeza'),

  ('a-herdeira-rebelde-favorita-1794156584',         'romance'),
  ('a-herdeira-rebelde-favorita-1794156584',         'bilionario'),

  ('a-herdeira-recupera-a-sua-vida-1794159770',      'vinganca'),
  ('a-herdeira-recupera-a-sua-vida-1794159770',      'bilionario'),
  ('a-herdeira-recupera-a-sua-vida-1794159770',      'familia'),

  ('a-herdeira-italo--o-noivo-que-me-substimou-1794178743', 'romance'),
  ('a-herdeira-italo--o-noivo-que-me-substimou-1794178743', 'bilionario'),
  ('a-herdeira-italo--o-noivo-que-me-substimou-1794178743', 'vinganca'),

  ('a-princesa-das-cinzas-1794185796',               'realeza'),
  ('a-princesa-das-cinzas-1794185796',               'vinganca'),
  ('a-princesa-das-cinzas-1794185796',               'romance'),

  ('a-princesa-do-don-herdeira-de-um-imperio-1794184001', 'mafia'),
  ('a-princesa-do-don-herdeira-de-um-imperio-1794184001', 'romance'),
  ('a-princesa-do-don-herdeira-de-um-imperio-1794184001', 'familia'),

  ('a-vida-secreta-do-meu-marido-bilionario',        'bilionario'),
  ('a-vida-secreta-do-meu-marido-bilionario',        'romance'),
  ('a-vida-secreta-do-meu-marido-bilionario',        'familia'),

  ('abandonada-no-altar-escolhida-pelo-duque-1794183775', 'realeza'),
  ('abandonada-no-altar-escolhida-pelo-duque-1794183775', 'romance'),
  ('abandonada-no-altar-escolhida-pelo-duque-1794183775', 'vinganca'),

  ('bom-demais-pra-demitir-a-medica-genio-1794173619', 'vinganca'),
  ('bom-demais-pra-demitir-a-medica-genio-1794173619', 'romance'),

  ('caindo-pelo-maior-inimigo-1794170427',           'romance'),
  ('caindo-pelo-maior-inimigo-1794170427',           'proibido'),

  ('jiaojiao-meu-amor-1794160060',                   'romance'),
  ('jiaojiao-meu-amor-1794160060',                   'familia'),

  ('jogo-na-ilha-a-obsessao-do-meu-ceo-1794154998',  'bilionario'),
  ('jogo-na-ilha-a-obsessao-do-meu-ceo-1794154998',  'romance'),
  ('jogo-na-ilha-a-obsessao-do-meu-ceo-1794154998',  'proibido'),

  ('meu-marido-nunca-me-escolheu-1794169335',        'romance'),
  ('meu-marido-nunca-me-escolheu-1794169335',        'familia'),
  ('meu-marido-nunca-me-escolheu-1794169335',        'vinganca'),

  ('meu-pai-escolheu-outra-familia-1794173605',      'familia'),
  ('meu-pai-escolheu-outra-familia-1794173605',      'vinganca'),

  ('o-calor-da-sua-lingua-1794155444',               'romance'),
  ('o-calor-da-sua-lingua-1794155444',               'proibido'),

  ('o-grande-e-poderoso-genio-1787460327',           'sobrenatural'),
  ('o-grande-e-poderoso-genio-1787460327',           'romance'),

  ('o-mafioso-e-a-noiva-hacker-1794178196',          'mafia'),
  ('o-mafioso-e-a-noiva-hacker-1794178196',          'romance'),
  ('o-mafioso-e-a-noiva-hacker-1794178196',          'proibido'),

  ('o-principe-vampiro-amaldicoado-1794184108',      'sobrenatural'),
  ('o-principe-vampiro-amaldicoado-1794184108',      'romance'),
  ('o-principe-vampiro-amaldicoado-1794184108',      'realeza'),

  ('o-traidor-da-familia-1794170367',                'mafia'),
  ('o-traidor-da-familia-1794170367',                'familia'),
  ('o-traidor-da-familia-1794170367',                'vinganca'),

  ('posso-ler-a-mente-dos-bebes-da-mafia-1794178808', 'mafia'),
  ('posso-ler-a-mente-dos-bebes-da-mafia-1794178808', 'sobrenatural'),
  ('posso-ler-a-mente-dos-bebes-da-mafia-1794178808', 'familia'),

  ('troca-de-casais-proibida-1794156381',            'proibido'),
  ('troca-de-casais-proibida-1794156381',            'romance'),

  -- O nome não diz o gênero deste. Deixei só em Romance, que é a aposta mais
  -- segura neste catálogo; corrija quando souber do que ele trata.
  ('vagando-livre-pelo-mundo-1793984181',            'romance'),

  ('virei-quarterback-minha-ex-capita-de-torcida-implora-pra-eu-voltar-1794173885', 'vinganca'),
  ('virei-quarterback-minha-ex-capita-de-torcida-implora-pra-eu-voltar-1794173885', 'romance')
on conflict do nothing;

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

-- ----------------------------------------------------------------- Conferência
-- Esperado: 25 títulos, 25 com sinopse, 10 categorias, nenhum título sem gênero.
select 'titulos'            as conferencia, count(*)::text from public.titles
union all select 'com sinopse',  count(*)::text from public.titles where synopsis is not null and btrim(synopsis) <> ''
union all select 'categorias',   count(*)::text from public.categories
union all select 'sem genero',   count(*)::text from public.titles t
  where not exists (
    select 1 from public.title_categories tc
    join public.categories c on c.id = tc.category_id
    where tc.title_id = t.id and c.position < 90
  );

-- Quantos títulos em cada categoria (a home monta uma fileira por categoria).
select c.position, c.name, count(tc.title_id) as titulos
from public.categories c
left join public.title_categories tc on tc.category_id = c.id
group by c.position, c.name
order by c.position;
