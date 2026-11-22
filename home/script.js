/* =========================================================
   TRANG CHỦ
   1. Banner trình chiếu (bảng banners — admin thêm ảnh)
   2. Tập phẩm nổi bật (collections.is_featured)
   3. Trâm cài nổi bật (products.is_featured → bổ sung bằng bán chạy / mới nhất)
   4. Về Nếp (bài đầu tiên của mục Về Nếp)
   5. Góc Nếp (3 bài mới nhất)
   ========================================================= */
(async () => {
  await Layout.init('home');
  loadSlides();
  loadCollections();
  loadProducts();
  loadAbout();
  loadCorner();
})();

/* ---------- 1. Banner trình chiếu ---------- */
async function loadSlides() {
  const { data } = await sb.from('banners').select('id, image_path, title, link').eq('is_active', true).order('sort_order').order('id');
  if (!data || !data.length) return;              // không có banner → giữ ảnh mặc định
  const wrap = document.getElementById('slides');
  wrap.innerHTML = data.map((b, i) => {
    const href = siteLink(b.link);
    const cap = b.title ? `
      <div class="slide-caption">
        <img class="cap-logo" src="../assets/images/brand/logo-full.png" alt="" width="260" height="217">
        <h2>${escapeHtml(b.title)}</h2>
        ${href ? `<a class="btn" href="${escapeHtml(href)}" tabindex="${i ? -1 : 0}">Khám phá ngay</a>` : ''}
      </div>` : '';
    return `
      <div class="slide${i === 0 ? ' is-active' : ''}" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${data.length}" ${i ? 'aria-hidden="true"' : ''}>
        <img src="${imageUrl(b.image_path)}" alt="${escapeHtml(b.title || 'Nếp Cài — Cài một nét Xưa, giữ một nếp Việt')}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} draggable="false">
        ${href && !b.title ? `<a class="slide-link" href="${escapeHtml(href)}" aria-label="Xem thêm" tabindex="${i ? -1 : 0}"></a>` : ''}
        ${cap}
      </div>`;
  }).join('');
  if (data.length > 1) initSlider(wrap, data.length);
}

function initSlider(wrap, n) {
  const slides = [...wrap.children];
  const dots = document.getElementById('dots');
  const prev = document.getElementById('slidePrev');
  const next = document.getElementById('slideNext');
  const hero = wrap.closest('.hero');
  prev.innerHTML = icon('chevronLeft'); next.innerHTML = icon('chevron');
  prev.hidden = next.hidden = false;
  dots.innerHTML = slides.map((_, i) => `<button type="button" role="tab" aria-label="Ảnh ${i + 1}" aria-selected="${i === 0}"></button>`).join('');
  let cur = 0, timer = null;
  const DELAY = 6000;

  const go = i => {
    i = (i + n) % n;
    if (i === cur) return;
    slides[cur].classList.remove('is-active'); slides[cur].setAttribute('aria-hidden', 'true');
    slides[cur].querySelectorAll('a').forEach(a => a.tabIndex = -1);
    slides[i].classList.add('is-active'); slides[i].removeAttribute('aria-hidden');
    slides[i].querySelectorAll('a').forEach(a => a.tabIndex = 0);
    [...dots.children].forEach((d, k) => d.setAttribute('aria-selected', k === i));
    cur = i;
  };
  const play = () => { stop(); if (!reduceMotion()) timer = setInterval(() => go(cur + 1), DELAY); };
  const stop = () => { clearInterval(timer); timer = null; };

  dots.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { go([...dots.children].indexOf(b)); play(); } });
  prev.addEventListener('click', () => { go(cur - 1); play(); });
  next.addEventListener('click', () => { go(cur + 1); play(); });
  hero.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { go(cur - 1); play(); } if (e.key === 'ArrowRight') { go(cur + 1); play(); } });
  // Tạm dừng khi rê chuột / đang thao tác / tab bị ẩn
  hero.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') stop(); });
  hero.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') play(); });
  hero.addEventListener('focusin', stop);
  hero.addEventListener('focusout', play);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : play()));

  // Vuốt trên điện thoại: đủ xa HOẶC vuốt nhanh là chuyển ảnh
  let x0 = null, t0 = 0, moved = false;
  hero.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; x0 = e.clientX; t0 = performance.now(); moved = false; stop(); });
  hero.addEventListener('pointermove', e => { if (x0 !== null && Math.abs(e.clientX - x0) > 8) moved = true; });
  const end = e => {
    if (x0 === null) return;
    const dx = e.clientX - x0, v = Math.abs(dx) / Math.max(1, performance.now() - t0);
    if (Math.abs(dx) > 50 || (Math.abs(dx) > 15 && v > 0.11)) go(cur + (dx < 0 ? 1 : -1));
    x0 = null; play();
  };
  hero.addEventListener('pointerup', end);
  hero.addEventListener('pointercancel', () => { x0 = null; play(); });
  hero.addEventListener('click', e => { if (moved) { e.preventDefault(); moved = false; } }, true);
  play();
}

/* ---------- 2. Tập phẩm nổi bật ---------- */
async function loadCollections() {
  const box = document.getElementById('featuredCollections');
  const { data, error } = await sb.from('collections').select('id, name, tagline, image_path').eq('is_featured', true).order('sort_order').order('created_at').limit(4);
  if (error || !data?.length) { box.closest('section').hidden = true; return; }
  box.innerHTML = data.map((c, i) => `
    <a class="col-feature reveal" style="--d:${i}" href="${collectionHref(c.id)}">
      <div class="cf-text">
        <h3>${escapeHtml(c.name).replace(/,\s*/, ',<br>')}</h3>
        ${c.tagline ? `<p>${escapeHtml(c.tagline)}</p>` : ''}
        <span class="read-more">Khám phá bộ sưu tập ${icon('chevron')}</span>
      </div>
      <div class="cf-media"><img src="${imageUrl(c.image_path)}" alt="${escapeHtml(c.name)}" loading="lazy"></div>
    </a>`).join('');
  observeReveal(box);
}

/* ---------- 3. Trâm cài nổi bật ---------- */
const PRODUCT_FIELDS = 'id, sku, name, image_path, price, stock, created_at';
async function loadProducts() {
  const grid = document.getElementById('featuredProducts');
  grid.innerHTML = skeletonCards(4);
  const { data: featured, error } = await sb.from('products').select(PRODUCT_FIELDS).eq('is_featured', true).order('created_at', { ascending: false }).limit(4);
  if (error) { renderProducts(grid, null, error); return; }
  let list = featured || [];
  if (list.length < 4) {
    // Chưa đủ 4 → thêm sản phẩm bán chạy, rồi mới nhất
    const { data: best } = await sb.rpc('best_sellers', { p_limit: 8 });
    const ids = (best || []).map(b => b.product_id).filter(id => !list.some(p => p.id === id));
    if (ids.length) {
      const { data: bp } = await sb.from('products').select(PRODUCT_FIELDS).in('id', ids);
      ids.forEach(id => { const p = (bp || []).find(x => x.id === id); if (p && list.length < 4) list.push(p); });
    }
  }
  if (list.length < 4) {
    const { data: newest } = await sb.from('products').select(PRODUCT_FIELDS).order('created_at', { ascending: false }).limit(8);
    (newest || []).forEach(p => { if (list.length < 4 && !list.some(x => x.id === p.id)) list.push(p); });
  }
  renderProducts(grid, list, null, 'Sản phẩm đang được chuẩn bị — hẹn Nương sớm nhé!');
}

/* ---------- 4. Về Nếp ---------- */
async function loadAbout() {
  const { data } = await sb.from('posts').select('title, excerpt, content, cover_path').eq('section', 've-nep').eq('is_published', true)
    .order('sort_order').order('published_at').limit(1).maybeSingle();
  if (!data) return;
  const text = data.excerpt || (data.content || '').split(/\n{2,}/)[0];
  if (text) document.getElementById('aboutExcerpt').textContent = text;
  if (data.cover_path) {
    const img = document.getElementById('aboutImg');
    img.src = imageUrl(data.cover_path);
    img.alt = data.title;
  }
}

/* ---------- 5. Góc Nếp ---------- */
async function loadCorner() {
  const box = document.getElementById('cornerPosts');
  const { data } = await sb.from('posts').select('id, title, excerpt, category, cover_path').eq('section', 'goc-nep').eq('is_published', true)
    .order('published_at', { ascending: false }).limit(3);
  if (!data?.length) { box.closest('section').hidden = true; return; }
  box.innerHTML = data.map((p, i) => postCardHTML(p, i)).join('');
  observeReveal(box);
}
