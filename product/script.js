/* =========================================================
   CHI TIẾT SẢN PHẨM: ../product/index.html?id=<uuid>
   Ảnh chính + ảnh phụ (product_images) · 4 tab · sản phẩm liên quan · khối bộ sưu tập
   ========================================================= */
const DEFAULT_TABS = {
  desc: 'Trâm cài được nặn tay từ đất sét, vẽ hoạ tiết rồi nung và phủ men. Mỗi chiếc có khác biệt nhỏ về màu men và nét vẽ — đó là dấu tay của người làm.',
  material: '- Chất liệu: đất sét nung, phủ men bóng\n- Que trâm: đất sét / gỗ tự nhiên (tuỳ mẫu)\n- Kích thước và trọng lượng có thể chênh lệch nhẹ vì làm thủ công',
  usage: 'Búi tóc gọn sau gáy, đặt vòng trâm áp lên búi, xuyên que trâm qua vòng — đi sâu vào búi tóc rồi trồi lên ở mép đối diện của vòng. Với cây trâm: vặn tóc thành búi, cắm trâm chéo từ trên xuống và xoay nhẹ để khoá búi.',
  care: '- Đất sét nung có thể vỡ nếu rơi mạnh — hãy cất trâm vào hộp khi không dùng\n- Tránh ngâm nước lâu, tránh nước hoa và hoá chất\n- Lau nhẹ bằng khăn mềm, khô để giữ men luôn bóng'
};
let P = null;

(async () => {
  await Layout.init('tram-cai');
  const id = new URLSearchParams(location.search).get('id');
  const pd = document.getElementById('pd');
  const notFound = () => {
    pd.innerHTML = `<div class="not-found"><h1>Không tìm thấy sản phẩm</h1><a class="btn" href="../tram-cai/index.html">Xem tất cả trâm cài</a></div>`;
    document.getElementById('crumbs').innerHTML = '';
  };
  if (!id) return notFound();

  const [{ data: p }, { data: imgs }] = await Promise.all([
    sb.from('products').select('*, collections(id, name, tagline, image_path)').eq('id', id).maybeSingle(),
    sb.from('product_images').select('image_path').eq('product_id', id).order('sort_order').order('id')
  ]);
  if (!p) return notFound();
  P = p;
  document.title = `${p.name} | Nếp Cài`;
  const col = p.collections;

  document.getElementById('crumbs').innerHTML = `<a href="../home/index.html">Trang chủ</a>${icon('chevron')}` +
    (col ? `<a href="../tap-pham/index.html">Tập phẩm</a>${icon('chevron')}<a href="${collectionHref(col.id)}">${escapeHtml(col.name)}</a>`
         : `<a href="../tram-cai/index.html">Trâm cài</a>`) + `${icon('chevron')}<span>${escapeHtml(p.name)}</span>`;

  const photos = [p.image_path, ...(imgs || []).map(i => i.image_path)].filter(Boolean);
  if (!photos.length) photos.push(null);
  const out = p.stock <= 0;
  const stockText = out ? 'Tạm hết hàng' : p.stock <= 3 ? `Chỉ còn ${p.stock} chiếc` : `Còn ${p.stock} chiếc`;

  pd.innerHTML = `
    <div class="pd-gallery ${photos.length < 2 ? 'single' : ''}">
      <div class="pd-thumbs" id="thumbs">
        ${photos.map((ph, i) => `<button type="button" data-i="${i}" aria-label="Ảnh ${i + 1}" aria-current="${i === 0}"><img src="${imageUrl(ph)}" alt="" loading="lazy"></button>`).join('')}
      </div>
      <div class="pd-main" id="pdMain"><img id="mainImg" src="${imageUrl(photos[0])}" alt="${escapeHtml(p.name)}" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'"></div>
    </div>
    <div class="pd-info">
      <span class="ornament" data-lotus><i></i><i></i></span>
      <h1>${escapeHtml(p.name)}</h1>
      <p class="pd-price">${formatVND(p.price)}</p>
      ${p.tagline ? `<p class="pd-tag">${escapeHtml(p.tagline)}</p>` : ''}
      <div class="pd-meta">
        <span class="pd-stock ${out ? 'out' : p.stock <= 3 ? 'low' : ''}">${stockText}</span>
        <span>Mã: ${escapeHtml(p.sku)}</span>
        <span>${escapeHtml(PRODUCT_CATEGORIES[p.category] || 'Trâm cài')}</span>
        ${col ? `<span>Bộ sưu tập: <a href="${collectionHref(col.id)}">${escapeHtml(col.name)}</a></span>` : ''}
      </div>
      <div class="pd-qty">
        <span>Số lượng:</span>
        <div class="qty">
          <button type="button" id="qtyMinus" aria-label="Giảm">${icon('minus')}</button>
          <input type="number" id="qtyInput" value="1" min="1" max="${Math.max(p.stock, 1)}" inputmode="numeric" ${out ? 'disabled' : ''} aria-label="Số lượng">
          <button type="button" id="qtyPlus" aria-label="Tăng">${icon('plus')}</button>
        </div>
      </div>
      <div class="pd-buy">
        <button class="btn" id="addBtn" ${out ? 'disabled' : ''}>${icon('bag')} Thêm vào giỏ hàng</button>
        <button class="btn btn-outline" id="buyBtn" ${out ? 'disabled' : ''}>Mua ngay</button>
      </div>
      <div class="pd-trust">
        <div>${icon('truck')}Giao hàng<br>toàn quốc</div>
        <div>${icon('refresh')}Đổi trả<br>trong 7 ngày</div>
        <div>${icon('shield')}Thanh toán<br>khi nhận hàng</div>
      </div>
    </div>`;
  decorate(pd);
  setupGallery(photos);
  setupBuy();
  setupTabs();
  loadRelated(col);
  if (col) {
    const cta = document.getElementById('colCta');
    cta.style.backgroundImage = `url('${imageUrl(col.image_path)}')`;
    cta.innerHTML = `<div class="container"><div class="cta-box reveal">
        <span class="ornament" data-lotus><i></i><i></i></span>
        <p class="q">${escapeHtml(col.name)}</p>
        ${col.tagline ? `<p>${escapeHtml(col.tagline)}</p>` : ''}
        <a class="btn" href="${collectionHref(col.id)}">Khám phá thêm bộ sưu tập</a></div></div>`;
    cta.hidden = false;
    decorate(cta); observeReveal(cta);
  }
})();

/* ---------- Ảnh ---------- */
function setupGallery(photos) {
  const main = document.getElementById('pdMain');
  const img = document.getElementById('mainImg');
  const thumbs = document.getElementById('thumbs');
  thumbs.addEventListener('click', e => {
    const b = e.target.closest('[data-i]'); if (!b || b.getAttribute('aria-current') === 'true') return;
    thumbs.querySelectorAll('button').forEach(x => x.setAttribute('aria-current', x === b));
    img.classList.add('swap');
    setTimeout(() => { img.src = imageUrl(photos[+b.dataset.i]); img.onload = () => img.classList.remove('swap'); }, 120);
  });
  // Zoom theo con trỏ có quán tính — chỉ thiết bị có chuột
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion()) {
    let tx = 50, ty = 50, cx = 50, cy = 50, raf = 0;
    const pos = e => { const r = main.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100]; };
    const tick = () => {
      cx += (tx - cx) * .18; cy += (ty - cy) * .18;
      img.style.transformOrigin = `${cx}% ${cy}%`;
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > .05 ? requestAnimationFrame(tick) : 0;
    };
    main.addEventListener('pointerenter', e => { [tx, ty] = pos(e); cx = tx; cy = ty; img.style.transformOrigin = `${cx}% ${cy}%`; main.classList.add('zoom'); });
    main.addEventListener('pointermove', e => { [tx, ty] = pos(e); if (!raf) raf = requestAnimationFrame(tick); });
    main.addEventListener('pointerleave', () => main.classList.remove('zoom'));
  }
}

/* ---------- Mua ---------- */
function setupBuy() {
  const input = document.getElementById('qtyInput');
  const clamp = v => Math.max(1, Math.min(P.stock, Number(v) || 1));
  document.getElementById('qtyMinus').onclick = () => { input.value = clamp(+input.value - 1); };
  document.getElementById('qtyPlus').onclick = () => { input.value = clamp(+input.value + 1); };
  input.addEventListener('change', () => { input.value = clamp(input.value); });
  document.getElementById('addBtn').onclick = e => {
    const ok = Cart.add(P.id, clamp(input.value), P.stock);
    if (ok) { flashButton(e.currentTarget, 'Đã thêm vào giỏ ✓'); bumpCart(); }
    else toast('Giỏ hàng đã có đủ số lượng còn lại', 'error');
  };
  document.getElementById('buyBtn').onclick = () => buyNow(P.id, clamp(input.value));
}

/* ---------- Tab ---------- */
function setupTabs() {
  document.getElementById('tabsWrap').hidden = false;
  const tabs = [...document.querySelectorAll('#tabs [data-tab]')];
  const ink = document.getElementById('tabInk');
  const panel = document.getElementById('tabPanel');
  const content = { desc: P.description, material: P.material, usage: P.usage, care: P.care };
  const move = t => { ink.style.transform = `translateX(${t.offsetLeft}px) scaleX(${t.offsetWidth})`; };
  const show = (t, first) => {
    tabs.forEach(x => { x.classList.toggle('active', x === t); x.setAttribute('aria-selected', x === t); });
    move(t);
    panel.innerHTML = richText(content[t.dataset.tab] || DEFAULT_TABS[t.dataset.tab]);
    if (!first) { panel.style.animation = 'none'; panel.offsetHeight; panel.style.animation = ''; }
  };
  tabs.forEach(t => t.addEventListener('click', () => show(t)));
  ink.classList.add('no-anim');
  show(tabs[0], true);
  requestAnimationFrame(() => requestAnimationFrame(() => ink.classList.remove('no-anim')));
  window.addEventListener('resize', () => move(tabs.find(t => t.classList.contains('active'))));
}

/* ---------- Sản phẩm liên quan: cùng bộ sưu tập trước, rồi các sản phẩm khác ---------- */
async function loadRelated(col) {
  const F = 'id, sku, name, image_path, price, stock, created_at';
  let list = [];
  if (col) {
    const { data } = await sb.from('products').select(F).eq('collection_id', col.id).neq('id', P.id).limit(8);
    list = data || [];
  }
  if (list.length < 8) {
    const { data } = await sb.from('products').select(F).neq('id', P.id).order('created_at', { ascending: false }).limit(12);
    (data || []).forEach(p => { if (list.length < 8 && !list.some(x => x.id === p.id)) list.push(p); });
  }
  if (!list.length) return;
  const sec = document.getElementById('related');
  sec.hidden = false;
  decorate(sec);
  const rail = document.getElementById('relatedRail');
  renderProducts(rail, list);
  const prev = document.getElementById('railPrev'), next = document.getElementById('railNext');
  prev.innerHTML = icon('chevronLeft'); next.innerHTML = icon('chevron');
  const step = () => rail.clientWidth * .8;
  const sync = () => { prev.disabled = rail.scrollLeft < 4; next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4; };
  prev.onclick = () => rail.scrollBy({ left: -step(), behavior: reduceMotion() ? 'auto' : 'smooth' });
  next.onclick = () => rail.scrollBy({ left: step(), behavior: reduceMotion() ? 'auto' : 'smooth' });
  rail.addEventListener('scroll', sync, { passive: true });
  sync();
}
