// Utilitários compartilhados: API, escape de HTML, ícones e componentes.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export class ApiError extends Error {
  constructor(status, body) { super(body?.error || `Erro ${status}`); this.status = status; this.code = body?.code; this.body = body; }
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* sem corpo */ }
  if (!res.ok) {
    // Esta aba está rodando uma versão antiga e pediu algo que o site não
    // atende mais. Recarregar é o que resolve, e a ação já falhou de
    // qualquer forma — não há nada em andamento para atrapalhar.
    if (data?.code === 'versao_antiga') location.reload();
    throw new ApiError(res.status, data);
  }
  return data;
}

const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const icon = {
  pause: svg('<path d="M8 5v14M16 5v14"/>'),
  whatsapp: svg('<path d="M21 11.5a9 9 0 0 1-13.4 7.9L3 21l1.6-4.6A9 9 0 1 1 21 11.5Z"/><path d="m9 7-1.2.6c-.9 2.4 3 6.3 5.7 6.9l1.3-1.3-2-1-1 .8a7 7 0 0 1-2.8-2.8l.8-1L9 7Z"/>'),
  gift: svg('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13"/><path d="M12 8H8a3 3 0 1 1 3-3l1 3ZM12 8h4a3 3 0 1 0-3-3l-1 3Z"/>'),
  request: svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h5M12 15v4M10 17h4"/>'),
  home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  grid: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  heart: svg('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>'),
  heartFill: svg('<path fill="currentColor" d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  play: svg('<path fill="currentColor" stroke="none" d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>'),
  back: svg('<path d="m15 18-6-6 6-6"/>'),
  next: svg('<path d="m9 18 6-6-6-6"/>'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  film: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>'),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  lock: svg('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  card: svg('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>'),
  check: svg('<path d="m5 12 5 5 9-10"/>'),
  image: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'),
  chev: svg('<path d="m9 18 6-6-6-6"/>', 'class="chev"'),
  refresh: svg('<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>'),
};

export const smallCover = (url) => url.replace(/\.webp$/, '-sm.webp');

export function card(t, { favorite = false } = {}) {
  return `<a class="card" href="/titulo/${encodeURIComponent(t.id)}" aria-label="${esc(t.name)}">
    <div class="card-cover loading">
      <img src="${esc(smallCover(t.cover))}" srcset="${esc(smallCover(t.cover))} 360w, ${esc(t.cover)} 720w"
        sizes="(min-width: 900px) 210px, (min-width: 600px) 180px, 31vw" alt="" loading="lazy" decoding="async" width="360" height="480">
      ${favorite ? `<span class="fav-dot">${icon.heartFill}</span>` : ''}
    </div>
    <div class="card-title">${esc(t.name)}</div>
  </a>`;
}

export function row({ id, title, link, titles }) {
  if (!titles || !titles.length) return '';
  return `<section class="row" aria-labelledby="row-${esc(id)}">
    <div class="row-head"><h2 id="row-${esc(id)}">${esc(title)}</h2>${link ? `<a href="${esc(link)}">Ver tudo</a>` : ''}</div>
    <div class="row-body">
      <button class="row-nav prev" type="button" aria-label="Rolar para a esquerda" hidden>${icon.back}</button>
      <div class="scroller" role="list">${titles.map((t) => `<div role="listitem">${card(t)}</div>`).join('')}</div>
      <button class="row-nav next" type="button" aria-label="Rolar para a direita">${icon.next}</button>
    </div>
  </section>`;
}

// Setas das fileiras no computador + estado de carregamento das capas.
export function enhance(root) {
  root.querySelectorAll('.row-body').forEach((body) => {
    const sc = body.querySelector('.scroller');
    const prev = body.querySelector('.prev'), next = body.querySelector('.next');
    const update = () => {
      prev.hidden = sc.scrollLeft < 8;
      next.hidden = sc.scrollLeft + sc.clientWidth >= sc.scrollWidth - 8;
    };
    prev.addEventListener('click', () => sc.scrollBy({ left: -sc.clientWidth * 0.85, behavior: 'smooth' }));
    next.addEventListener('click', () => sc.scrollBy({ left: sc.clientWidth * 0.85, behavior: 'smooth' }));
    sc.addEventListener('scroll', update, { passive: true });
    update();
  });
  root.querySelectorAll('.card-cover.loading img').forEach((img) => {
    const done = () => img.parentElement.classList.remove('loading');
    if (img.complete && img.naturalWidth) done(); else img.addEventListener('load', done, { once: true });
  });
}

// Capa que falhar ao carregar: troca para a versão grande e, se falhar de novo, mostra o nome.
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img instanceof HTMLImageElement && img.closest('.cat-art')) {
    if (!img.dataset.retried && img.src.includes('-sm.webp')) { img.dataset.retried = '1'; img.src = img.src.replace('-sm.webp','.webp'); }
    else img.remove();
    return;
  }
  if (!(img instanceof HTMLImageElement) || !img.closest('.card-cover, .feature-poster, .detail-poster')) return;
  if (!img.dataset.retried && img.src.includes('-sm.webp')) {
    img.dataset.retried = '1';
    img.removeAttribute('srcset');
    img.src = img.src.replace('-sm.webp', '.webp');
    return;
  }
  img.parentElement.classList.remove('loading');
  img.replaceWith(Object.assign(document.createElement('div'), { className: 'cover-fallback', textContent: 'Capa indisponível' }));
}, true);

let toastTimer;
export function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

export const initials = (u) => (u?.name || u?.email || '?').trim()[0].toUpperCase();
export const firstName = (u) => (u?.name ? u.name.split(' ')[0] : null);
