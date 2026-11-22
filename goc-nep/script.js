/* =========================================================
   GÓC NẾP — blog theo chủ đề (admin đăng ở Blog → Góc Nếp)
   ?cat=van-hoa|thu-cong|lam-dep|cam-hung  ·  ?page=n
   Trang 1 của "Tất cả": bài mới nhất hiển thị lớn.
   ========================================================= */
const PER_PAGE = 9;
const state = { cat: 'all', page: 1 };
let posts = [];

(async () => {
  await Layout.init('goc-nep');
  const qs = new URLSearchParams(location.search);
  state.cat = POST_CATEGORIES[qs.get('cat')] ? qs.get('cat') : 'all';
  state.page = Math.max(1, Number(qs.get('page')) || 1);

  const tabs = document.getElementById('catTabs');
  tabs.innerHTML = [['all', 'Tất cả'], ...Object.entries(POST_CATEGORIES)]
    .map(([k, v]) => `<button type="button" data-cat="${k}" role="tab">${v}</button>`).join('');
  tabs.addEventListener('click', e => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    state.cat = b.dataset.cat; state.page = 1; render(true);
  });
  document.getElementById('pager').addEventListener('click', e => {
    const b = e.target.closest('[data-page]'); if (!b || b.disabled) return;
    state.page = Number(b.dataset.page); render(true);
  });

  const grid = document.getElementById('postGrid');
  grid.innerHTML = '<div class="skeleton" style="height:260px"></div>'.repeat(3);
  const { data, error } = await sb.from('posts').select('id, title, excerpt, category, cover_path, published_at')
    .eq('section', 'goc-nep').eq('is_published', true).order('published_at', { ascending: false });
  if (error) { grid.innerHTML = `<p class="empty-state">${escapeHtml(viError(error))}</p>`; return; }
  posts = data || [];
  render(false);
})();

function render(scroll) {
  document.querySelectorAll('#catTabs [data-cat]').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === state.cat);
    b.setAttribute('aria-selected', b.dataset.cat === state.cat);
  });
  let list = posts.filter(p => state.cat === 'all' || p.category === state.cat);
  const feat = document.getElementById('featured');
  const grid = document.getElementById('postGrid');

  // Bài nổi bật (lớn) chỉ ở trang đầu của "Tất cả"
  let lead = null;
  if (state.cat === 'all' && state.page === 1 && list.length > 3) lead = list[0];
  if (state.cat === 'all' && list.length > 3) list = list.slice(1);
  feat.innerHTML = lead ? `
    <a class="post-feature reveal" href="${postHref(lead.id)}">
      <div class="pf-media"><img src="${imageUrl(lead.cover_path)}" alt="" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'"></div>
      <div class="pf-body">
        ${lead.category ? `<span class="chip-tag">${escapeHtml(POST_CATEGORIES[lead.category] || '')}</span>` : ''}
        <h2>${escapeHtml(lead.title)}</h2>
        ${lead.excerpt ? `<p>${escapeHtml(lead.excerpt)}</p>` : ''}
        <time>${formatDate(lead.published_at)}</time>
        <span class="read-more">Đọc bài viết ${icon('arrow')}</span>
      </div>
    </a>` : '';

  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  state.page = Math.min(state.page, pages);
  const slice = list.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE);
  grid.innerHTML = slice.length ? slice.map((p, i) => postCardHTML(p, i)).join('')
    : `<p class="empty-state">${posts.length ? 'Chưa có bài viết trong chủ đề này.' : 'Góc Nếp đang được vun đắp — hẹn Nương sớm nhé.'}</p>`;
  renderPager(pages);
  observeReveal(feat); observeReveal(grid);

  const url = new URL(location.href);
  state.cat !== 'all' ? url.searchParams.set('cat', state.cat) : url.searchParams.delete('cat');
  state.page > 1 ? url.searchParams.set('page', state.page) : url.searchParams.delete('page');
  history.replaceState(null, '', url);
  if (scroll) document.getElementById('catTabs').scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
}

function renderPager(pages) {
  const el = document.getElementById('pager');
  if (pages <= 1) { el.innerHTML = ''; return; }
  const btn = (p, label, extra = '') => `<button type="button" data-page="${p}" ${extra}>${label}</button>`;
  el.innerHTML =
    btn(state.page - 1, icon('chevronLeft'), `aria-label="Trang trước" ${state.page === 1 ? 'disabled' : ''}`) +
    Array.from({ length: pages }, (_, i) => btn(i + 1, i + 1, `class="${i + 1 === state.page ? 'active' : ''}" aria-label="Trang ${i + 1}"`)).join('') +
    btn(state.page + 1, icon('chevron'), `aria-label="Trang sau" ${state.page === pages ? 'disabled' : ''}`);
}
