# KingDrama — estrutura do site

Esqueleto da plataforma, feito primeiro para o celular: marca, banners, navegação e todas as telas de conta. **Sem catálogo** (entra depois) e **sem servidor** — é um site estático, pronto para subir na Netlify.

---

## Rodar no seu computador

```bash
npm start          # http://localhost:3000
```

Não precisa instalar nada para isso (o servidor local usa só o Node). Para ver como fica no celular: `F12` → ícone de celular (`Ctrl+Shift+M`).

| Comando | O que faz |
|---|---|
| `npm start` | abre o site em http://localhost:3000 |
| `npm run banners` | regera `public/banners/*.webp` a partir de `BANNERS/` (precisa de `npm install`) |
| `npm run zip` | gera `KingDrama-site.zip` para subir na Netlify |

---

## Publicar na Netlify

**Jeito mais rápido (arrastar o zip):**

1. `npm run zip` → gera `KingDrama-site.zip` na raiz do projeto.
2. Entre em [app.netlify.com](https://app.netlify.com) → **Add new site** → **Deploy manually**.
3. Arraste o `.zip`. Pronto.

**Pelo GitHub (recomendado depois, porque publica sozinho a cada alteração):**

Suba o projeto e, em *Site configuration → Build & deploy*, deixe:

- Base directory: `public`
- Build command: *(vazio)*
- Publish directory: `public`

O `public/netlify.toml`, o `_redirects` (rotas da SPA) e o `_headers` (segurança e cache) já estão prontos.

---

## Onde mexer em cada coisa

```
public/                   ← o site inteiro (é isto que vai para a Netlify)
├── index.html            título, descrição, ícones
├── config/banners.json   ★ os 8 banners da página inicial
├── css/app.css           todo o visual
├── js/
│   ├── data.js           ★ camada de dados — vira Supabase depois
│   ├── app.js            rotas e layout (barra de cima, barra de baixo)
│   ├── pages.js          telas: início, busca, categorias, título, player, lista
│   └── auth-pages.js     telas: entrar, criar conta, acesso, retorno do pagamento
├── img/                  logo e ícones
├── banners/              banners já convertidos (.webp)
└── vendor/hls.min.js     player HLS (para o vídeo da Bunny)

BANNERS/                  artes originais (.jpg) + titulos dos banners.txt
scripts/                  servidor local, gerador de banners, gerador do zip
```

### Trocar ou acrescentar um banner

1. Coloque as duas artes em `BANNERS/`:
   - **celular**: 1080 × 1440 px (3:4), a capa em pé;
   - **computador**: 1920 × 640 px (3:1), com os personagens à direita — a esquerda recebe o título, a sinopse e o botão.
2. Em `public/config/banners.json`, preencha o slot: `source.mobile`, `source.desktop`, `headline`, `subtitle`, `tags` e `active: true`.
3. `npm install` (só na primeira vez) e `npm run banners`.
4. `npm run zip` e publique de novo.

Um banner só aparece com `active: true` **e** as duas imagens. Com mais de um ativo, eles se revezam a cada `rotationSeconds` (hoje: 8s).

Se quiser só mudar o texto de um banner, edite o JSON e publique — não precisa rodar nada.

### Trocar o logo

Substitua `public/img/logo.png` (horizontal, fundo transparente, proporção 3:1) e os ícones `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` e `favicon-32.png`.

---

## O que já funciona e o que é só aparência

**Funciona de verdade:** toda a navegação, os banners com rotação e deslize do dedo, o visual em qualquer tamanho de tela, e os estados de "ainda não tem conteúdo".

**É só demonstração (`public/js/data.js`):** criar conta, entrar, pagamento e "Minha lista" respondem dentro do próprio navegador e guardam tudo no `localStorage`. Qualquer e-mail entra e **qualquer código de 6 dígitos é aceito**. Serve para percorrer as telas — não é autenticação nem cobrança.

> Não divulgue o endereço como se fosse a plataforma final enquanto o login for esse. Qualquer pessoa "entra".

---

## Próximos passos (na ordem)

### 1. Supabase — contas e catálogo

Tabelas mínimas:

- `profiles` — o usuário (ligado ao `auth.users` do Supabase)
- `titles` — título, slug, sinopse, capa, categorias
- `episodes` — título, número, nome, **`bunny_video_id`**
- `subscriptions` — status do acesso (`active`, `pending`, `canceled`…), validade
- `favorites`, `watch_progress`

Ative o **RLS** em todas. A regra que importa: `episodes` só pode ser lida por quem tem assinatura ativa.

Depois é só trocar o corpo de cada rota em `public/js/data.js` por chamadas ao Supabase. O resto do site não muda, porque só conhece os endereços `/api/*`.

### 2. Bunny Stream — vídeo

Os vídeos já estão lá. Faltam duas coisas, e a primeira não é opcional:

- **Token Authentication ligado na biblioteca.** Sem isso, qualquer pessoa abre o inspetor do navegador, copia a URL do `.m3u8` e assiste (e distribui) fora do site. A assinatura da URL tem de ser feita **no servidor**, com a chave secreta — numa Netlify Function ou numa Supabase Edge Function. Nunca no navegador: o que está no `js/` é público.
- **Referrer / hotlink protection** travado no seu domínio. É camada extra, não substitui o token.

O fluxo fica: o navegador pede `/api/play/<título>/<episódio>` → a função confere no Supabase se a assinatura está ativa → só então devolve a URL assinada, com validade curta.

### 3. Pagamento

Gateway (Mercado Pago, Stripe, ou um dos nacionais) + um webhook que escreve o status em `subscriptions`. O acesso é liberado pelo webhook, nunca pela tela de retorno do checkout — a tela de retorno o cliente consegue abrir sozinho.

---

## Observação sobre direitos

Os banners desta estrutura trazem artes e sinopses de produções de terceiros (ReelShort e outras). Para o site no ar, use material que você tenha licença para exibir — além do risco jurídico, a Bunny derruba a conta mediante notificação de direitos autorais, e isso tira a plataforma inteira do ar.
