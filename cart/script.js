/* Giỏ hàng: lấy giá + tồn kho mới nhất từ DB; thanh toán ở trang checkout/ */
let products = {};   // id -> product
let firstRender = true;

(async () => {
  await Layout.init('');
  await loadProducts();
  render();
  // Thanh toán từ giỏ: bỏ trạng thái "Mua ngay" còn sót (nếu có)
  document.getElementById('checkoutBtn').addEventListener('click', e => {
    if (e.currentTarget.getAttribute('aria-disabled') === 'true') { e.preventDefault(); return; }
    clearBuyNow();
  });
})();

async function loadProducts() {
  const ids = Cart.get().map(i => i.id);
  products = {};
  if (!ids.length) return;
  const { data, error } = await sb.from('products').select('id, sku, name, image_path, price, stock').in('id', ids);
  if (error) { toast(viError(error), 'error'); return; }
  (data || []).forEach(p => { products[p.id] = p; });
  // Bỏ sản phẩm đã bị xoá khỏi kho
  const valid = Cart.get().filter(i => products[i.id]);
  if (valid.length !== ids.length) Cart.save(valid);
}

function render() {
  const items = Cart.get();
  const layout = document.getElementById('cartLayout');
  const list = document.getElementById('cartItems');
  const summary = document.getElementById('cartSummary');

  if (!items.length) {
    layout.classList.add('empty');
    summary.hidden = true;
    list.style.borderTop = '0';
    list.innerHTML = `
      <div class="cart-empty">
        <h2>Giỏ hàng đang trống</h2>
        <p>Hãy chọn cho mình một chiếc trâm cài thật xinh nhé.</p>
        <a class="btn" href="../tram-cai/index.html">Đến cửa hàng</a>
      </div>`;
    return;
  }

  layout.classList.remove('empty');
  summary.hidden = false;
  list.style.borderTop = '';
  list.classList.toggle('intro', firstRender);
  firstRender = false;

  let subtotal = 0;
  let hasProblem = false;
  list.innerHTML = items.map(it => {
    const p = products[it.id];
    if (!p) return '';
    const line = p.price * it.qty;
    subtotal += line;
    let warn = '';
    if (p.stock <= 0) { warn = 'Sản phẩm đã hết hàng, vui lòng xoá khỏi giỏ.'; hasProblem = true; }
    else if (it.qty > p.stock) { warn = `Chỉ còn ${p.stock} chiếc trong kho.`; hasProblem = true; }
    const href = `../product/index.html?id=${encodeURIComponent(p.id)}`;
    return `
      <div class="cart-row" data-id="${escapeHtml(p.id)}">
        <a class="cart-thumb" href="${href}"><img src="${imageUrl(p.image_path)}" alt="${escapeHtml(p.name)}" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'"></a>
        <div>
          <a class="cart-name" href="${href}">${escapeHtml(p.name)}</a>
          <p class="cart-unit">${formatVND(p.price)} · Mã ${escapeHtml(p.sku)}</p>
          <div class="qty">
            <button type="button" data-act="minus" aria-label="Giảm">${icon('minus')}</button>
            <span>${it.qty}</span>
            <button type="button" data-act="plus" aria-label="Tăng" ${it.qty >= p.stock ? 'disabled' : ''}>${icon('plus')}</button>
          </div>
          ${warn ? `<p class="cart-warn">${warn}</p>` : ''}
        </div>
        <div class="cart-right">
          <span class="cart-line">${formatVND(line)}</span>
          <button type="button" class="remove-btn" data-act="remove">${icon('trash')} Xoá</button>
        </div>
      </div>`;
  }).join('');

  document.getElementById('subtotal').textContent = formatVND(subtotal);
  document.getElementById('total').textContent = formatVND(subtotal);

  const btn = document.getElementById('checkoutBtn');
  btn.setAttribute('aria-disabled', hasProblem ? 'true' : 'false');
  document.getElementById('checkoutMsg').textContent = hasProblem ? 'Vui lòng sửa các sản phẩm được đánh dấu trước khi thanh toán.' : '';
  document.getElementById('checkoutMsg').className = 'form-msg' + (hasProblem ? ' error' : '');
}

/* Tăng / giảm / xoá */
document.getElementById('cartItems').addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const row = btn.closest('.cart-row');
  const id = row.dataset.id;
  const it = Cart.get().find(i => i.id === id);
  const p = products[id];
  if (!it || !p) return;

  if (btn.dataset.act === 'plus') Cart.setQty(id, Math.min(it.qty + 1, p.stock));
  if (btn.dataset.act === 'minus') Cart.setQty(id, Math.max(it.qty - 1, 1));
  if (btn.dataset.act === 'remove') {
    row.classList.add('removing');
    setTimeout(() => { Cart.remove(id); render(); }, 200);
    return;
  }
  render();
});
