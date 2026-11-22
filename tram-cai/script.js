/* =========================================================
   TRÂM CÀI — tất cả sản phẩm
   Lọc: ?cat=tram-cai|vong-tram|cay-tram|new|featured · ?collection=<id> · ?q=<từ khoá> · ?page=<n>
   ========================================================= */
const PER_PAGE = 8;
const NEW_DAYS = 30;              // "Sản phẩm mới" = thêm trong 30 ngày (nếu không có thì lấy 8 SP mới nhất)
let all = [];
let state = { cat: 'all', collection: '', q: '', sort: 'new', page: 1 };

(async () => {
  await Layout.init('tram-cai');
  const params = new URLSearchParams(location.search);
  state.cat = params.get('cat') || 'all';
  state.collection = params.get('collection') || '';
  state.q = params.get('q') || '';
  state.page = Math.max(1, Number(params.get('page')) || 1);
  document.getElementById('searchInput').value = state.q;

  const grid = document.getElementById('productGrid');
  grid.innerHTML = skeletonCards(8);
  const [{ data, error }, { data: cols }] = await Promise.all([
    sb.from('products').select('id, sku, name, image_path, price, stock, category, is_featured, collection_id, created_at').order('created_at', { ascending: false }),
    sb.from('collections').select('id, name').order('sort_order')
  ]);
  if (error) { renderProducts(grid, null, error); return; }
  all = data || [];

  const sel = document.getElementById('colSelect');
  (cols || []).forEach(c => sel.add(new Option(c.name, c.id)));
  sel.value = state.collection;
  if (!(cols || []).length) sel.hidden = true;

  bind();
  apply(false);
})();

function bind() {
  document.getElementById('catTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    state.cat = b.dataset.cat; state.page = 1; apply(true);
  });
  let t;
  document.getElementById('searchInput').addEventListener('input', e => {
    clearTimeout(t); t = setTimeout(() => { state.q = e.target.value.trim(); state.page = 1; apply(false); }, 200);
  });
  document.getElementById('colSelect').addEventListener('change', e => { state.collection = e.target.value; state.page = 1; apply(false); });
  document.getElementById('sortSelect').addEventListener('change', e => { state.sort = e.target.value; apply(false); });
  document.getElementById('pager').addEventListener('click', e => {
    const b = e.target.closest('[data-page]'); if (!b || b.disabled) return;
    state.page = Number(b.dataset.page); apply(true);
  });
}

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

function apply(scroll) {
  document.querySelectorAll('#catTabs [data-cat]').forEach(b => {
    const on = b.dataset.cat === state.cat;
    b.classList.toggle('active', on); b.setAttribute('aria-selected', on);
  });
  const q = norm(state.q);
  const newCut = Date.now() - NEW_DAYS * 864e5;
  let list = all.filter(p =>
    (!q || norm(p.name).includes(q) || norm(p.sku).includes(q)) &&
    (!state.collection || p.collection_id === state.collection));
  if (state.cat === 'featured') list = list.filter(p => p.is_featured);
  else if (state.cat === 'new') {
    const recent = list.filter(p => new Date(p.created_at) >= newCut);
    list = recent.length ? recent : list.slice(0, 8);
  } else if (state.cat !== 'all') list = list.filter(p => p.category === state.cat);

  switch (state.sort) {
    case 'price-asc': list.sort((a, b) => a.price - b.price); break;
    case 'price-desc': list.sort((a, b) => b.price - a.price); break;
    case 'name': list.sort((a, b) => a.name.localeCompare(b.name, 'vi')); break;
    default: list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  state.page = Math.min(state.page, pages);
  const slice = list.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE);
  document.getElementById('resultCount').textContent = `${list.length} sản phẩm`;
  renderProducts(document.getElementById('productGrid'), slice, null,
    q ? 'Không tìm thấy sản phẩm phù hợp.' : 'Chưa có sản phẩm trong mục này.');
  renderPager(pages);

  const url = new URL(location.href);
  const setP = (k, v, def) => (v && v !== def ? url.searchParams.set(k, v) : url.searchParams.delete(k));
  setP('cat', state.cat, 'all'); setP('collection', state.collection, ''); setP('q', state.q, ''); setP('page', state.page > 1 ? String(state.page) : '', '');
  history.replaceState(null, '', url);
  if (scroll) document.getElementById('catalog').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
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
