/* =========================================================
   THANH TOÁN
   - Chế độ "cart": thanh toán toàn bộ giỏ hàng
   - Chế độ "buy" : bấm "Mua ngay" → chỉ 1 sản phẩm, giỏ hàng giữ nguyên
   Giá, tồn kho và địa chỉ mặc định đều được kiểm tra lại trong hàm place_order (DB).
   ========================================================= */
const $ = id => document.getElementById(id);
let profile = null;
let mode = 'cart';
let lines = [];         // [{ p: product, qty }]

(async () => {
  const p = await Auth.require('customer');   // chưa đăng nhập → sang trang đăng nhập rồi quay lại đây
  if (!p) return;
  await Layout.init('');
  profile = Auth.profile;

  const bn = getBuyNow();
  mode = bn && bn.id ? 'buy' : 'cart';
  $('editCart').hidden = mode === 'buy';

  await loadLines(bn);
  setupAddress();
  renderSummary();
  document.body.classList.remove('is-loading');
})();

/* ---------- Sản phẩm trong đơn ---------- */
async function loadLines(bn) {
  const wanted = mode === 'buy' ? [{ id: bn.id, qty: Math.max(1, Number(bn.qty) || 1) }] : Cart.get();
  if (!wanted.length) { lines = []; return; }
  const { data, error } = await sb.from('products')
    .select('id, sku, name, image_path, price, stock')
    .in('id', wanted.map(w => w.id));
  if (error) { showMsg(viError(error)); return; }
  const byId = Object.fromEntries((data || []).map(p => [p.id, p]));
  lines = wanted.filter(w => byId[w.id]).map(w => ({ p: byId[w.id], qty: w.qty }));
}

function renderSummary() {
  const box = $('summaryItems');
  if (!lines.length) {
    $('checkoutForm').innerHTML = `
      <div class="cart-empty" style="grid-column:1/-1;text-align:center;padding:60px 0">
        <h2 style="font-size:2.2rem;font-weight:400;margin-bottom:12px">Chưa có sản phẩm để thanh toán</h2>
        <p style="color:var(--muted);margin-bottom:26px">Hãy chọn một chiếc trâm cài bạn thích nhé.</p>
        <a class="btn" href="../tram-cai/index.html">Đến cửa hàng</a>
      </div>`;
    return;
  }
  let total = 0, problem = false;
  box.innerHTML = lines.map((l, i) => {
    const { p, qty } = l;
    total += p.price * qty;
    let warn = '';
    if (p.stock <= 0) { warn = 'Sản phẩm đã hết hàng'; problem = true; }
    else if (qty > p.stock) { warn = `Chỉ còn ${p.stock} chiếc`; problem = true; }
    const qtyCtrl = mode === 'buy'
      ? `<div class="qty">
           <button type="button" data-q="-1" data-i="${i}" aria-label="Giảm" ${qty <= 1 ? 'disabled' : ''}>${icon('minus')}</button>
           <span>${qty}</span>
           <button type="button" data-q="1" data-i="${i}" aria-label="Tăng" ${qty >= p.stock ? 'disabled' : ''}>${icon('plus')}</button>
         </div>`
      : `<span class="s-unit">Số lượng: ${qty}</span>`;
    return `
      <div class="s-item">
        <div class="s-thumb">
          <img src="${imageUrl(p.image_path)}" alt="" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
          ${mode === 'cart' ? `<span class="s-qty-badge">${qty}</span>` : ''}
        </div>
        <div>
          <div class="s-name">${escapeHtml(p.name)}</div>
          <div class="s-unit">${formatVND(p.price)}</div>
          ${qtyCtrl}
          ${warn ? `<div class="s-warn">${warn}</div>` : ''}
        </div>
        <span class="s-line">${formatVND(p.price * qty)}</span>
      </div>`;
  }).join('');
  $('subtotal').textContent = formatVND(total);
  $('total').textContent = formatVND(total);
  $('placeBtn').disabled = problem;
  if (problem) showMsg(mode === 'cart' ? 'Một số sản phẩm không đủ hàng — hãy sửa lại giỏ hàng.' : 'Sản phẩm không đủ hàng.');
}

/* Tăng / giảm số lượng ở chế độ Mua ngay */
$('summaryItems').addEventListener('click', e => {
  const b = e.target.closest('[data-q]');
  if (!b) return;
  const l = lines[+b.dataset.i];
  l.qty = Math.max(1, Math.min(l.p.stock, l.qty + Number(b.dataset.q)));
  try { sessionStorage.setItem(BUYNOW_KEY, JSON.stringify({ id: l.p.id, qty: l.qty })); } catch { /* bỏ qua */ }
  showMsg('');
  renderSummary();
});

/* ---------- Địa chỉ giao hàng ---------- */
function hasDefault() { return !!(profile?.phone && profile?.address); }

function setupAddress() {
  const def = document.querySelector('input[name="ship"][value="default"]');
  const other = document.querySelector('input[name="ship"][value="other"]');

  if (hasDefault()) {
    $('defaultAddr').innerHTML =
      `${escapeHtml(displayName(profile))} · ${escapeHtml(profile.phone)}<br>${escapeHtml(profile.address)}`;
    def.checked = true;
    $('saveDefaultWrap').querySelector('span').textContent = 'Đặt địa chỉ này làm mặc định cho lần sau';
  } else {
    // Hồ sơ chưa có địa chỉ → khoá lựa chọn mặc định, chuyển sang "Địa chỉ khác"
    $('defaultAddr').innerHTML = `Bạn chưa lưu số điện thoại / địa chỉ trong hồ sơ. <a href="../customer/index.html#profile">Cập nhật hồ sơ</a>`;
    def.disabled = true;
    $('optDefault').classList.add('is-disabled');
    other.checked = true;
    $('saveDefault').checked = true;
  }
  // Điền sẵn tên + SĐT của khách cho form địa chỉ khác
  $('shipName').value = profile?.full_name || '';
  $('shipPhone').value = profile?.phone || '';

  document.querySelectorAll('input[name="ship"]').forEach(r => r.addEventListener('change', syncShip));
  syncShip();
}

function syncShip() {
  const isOther = document.querySelector('input[name="ship"]:checked')?.value === 'other';
  $('otherAddr').hidden = !isOther;
  showMsg('');
}

/* ---------- Đặt hàng ---------- */
function showMsg(text, ok = false) {
  $('msg').textContent = text;
  $('msg').className = 'form-msg' + (text ? (ok ? ' success' : ' error') : '');
}

$('checkoutForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!lines.length) return;
  const shipType = document.querySelector('input[name="ship"]:checked')?.value;
  const name = $('shipName').value.trim();
  const phone = $('shipPhone').value.trim();
  const address = $('shipAddress').value.trim();

  if (!shipType) return showMsg('Vui lòng chọn địa chỉ giao hàng.');
  if (shipType === 'other') {
    if (!name) { $('shipName').focus(); return showMsg('Vui lòng nhập tên người nhận.'); }
    if (!/^[0-9+\s.-]{8,15}$/.test(phone)) { $('shipPhone').focus(); return showMsg('Số điện thoại không hợp lệ.'); }
    if (address.length < 8) { $('shipAddress').focus(); return showMsg('Vui lòng nhập địa chỉ nhận hàng đầy đủ.'); }
  }

  const btn = $('placeBtn');
  btn.classList.add('loading');
  showMsg('');
  const { data: orderId, error } = await sb.rpc('place_order', {
    items: lines.map(l => ({ product_id: l.p.id, quantity: l.qty })),
    p_ship_type: shipType,
    p_ship_name: shipType === 'other' ? name : null,
    p_ship_phone: shipType === 'other' ? phone : null,
    p_ship_address: shipType === 'other' ? address : null,
    p_note: $('note').value.trim() || null,
    p_payment: 'cod'
  });
  btn.classList.remove('loading');

  if (error) {
    showMsg(viError(error));
    await loadLines(mode === 'buy' ? getBuyNow() : null); // tồn kho có thể vừa thay đổi
    renderSummary();
    return;
  }

  // Lưu địa chỉ khác làm mặc định (nếu khách chọn)
  if (shipType === 'other' && $('saveDefault').checked) {
    await sb.from('customers').update({ phone, address }).eq('id', Auth.user.id);
  }

  if (mode === 'buy') clearBuyNow(); else Cart.clear();
  Cart.updateBadge();

  const shipTo = shipType === 'other'
    ? { n: name, ph: phone, a: address }
    : { n: displayName(profile), ph: profile.phone, a: profile.address };
  $('orderId').textContent = '#' + orderId;
  $('successShip').innerHTML = `
    <strong>Giao đến:</strong> ${escapeHtml(shipTo.n)} · ${escapeHtml(shipTo.ph)}<br>
    ${escapeHtml(shipTo.a)}<br>
    <strong>Thanh toán:</strong> Khi nhận hàng (COD) · <strong>Tổng:</strong> ${$('total').textContent}`;
  $('checkoutForm').hidden = true;
  $('successBox').hidden = false;
  document.querySelector('.page-banner h1').textContent = 'Đặt hàng thành công';
  window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
});
