/* Trang khách hàng: chỉ khách đã đăng nhập (admin sẽ bị chuyển sang trang admin) */
(async () => {
  const p = await Auth.require('customer');
  if (!p) return;

  await Layout.init('');
  document.body.classList.remove('is-loading');
  fillWelcome(Auth.profile);
  fillProfileForm(Auth.profile);
  setupTabs();
  loadOrders();
  loadSuggestions();
})();

function fillWelcome(p) {
  document.getElementById('bigAvatar').textContent = initials(p.full_name, p.email);
  document.getElementById('helloName').textContent = displayName(p);
}

/* ---------- Tabs ---------- */
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const ink = document.getElementById('tabInk');
  const moveInk = t => { ink.style.transform = `translateX(${t.offsetLeft}px) scaleX(${t.offsetWidth})`; };

  const activate = name => {
    tabs.forEach(t => {
      const on = t.dataset.tab === name;
      t.classList.toggle('active', on);
      if (on) moveInk(t);
    });
    document.querySelectorAll('.tab-panel').forEach(pn => pn.classList.toggle('active', pn.id === 'panel-' + name));
  };
  tabs.forEach(t => t.addEventListener('click', () => {
    activate(t.dataset.tab);
    history.replaceState(null, '', '#' + t.dataset.tab);
  }));
  window.addEventListener('resize', () => moveInk(document.querySelector('.tab.active')));
  // Lần đầu: đặt gạch chân đúng chỗ ngay, không trượt từ mép trái vào
  ink.classList.add('no-anim');
  activate(location.hash === '#profile' ? 'profile' : 'orders');
  requestAnimationFrame(() => requestAnimationFrame(() => ink.classList.remove('no-anim')));
}

/* ---------- Đơn hàng ---------- */
async function loadOrders() {
  const list = document.getElementById('ordersList');
  const stats = document.getElementById('stats');
  list.innerHTML = '<div class="skeleton" style="aspect-ratio:auto;height:120px"></div>';

  const { data, error } = await sb
    .from('orders')
    .select('id, total_amount, status, created_at, ship_type, ship_name, ship_phone, ship_address, payment_method, purchases(product_name, quantity, unit_price)')
    .eq('customer_id', Auth.user.id)
    .order('created_at', { ascending: false });

  if (error) { list.innerHTML = `<p class="empty-state">${escapeHtml(viError(error))}</p>`; return; }

  const orders = data || [];
  const done = orders.filter(o => !['cancelled', 'returned'].includes(o.status));
  const spent = done.reduce((s, o) => s + Number(o.total_amount), 0);
  const items = done.reduce((s, o) => s + o.purchases.reduce((a, b) => a + b.quantity, 0), 0);
  stats.innerHTML = `
    <div class="stat"><span>Số đơn hàng</span><strong>${orders.length}</strong></div>
    <div class="stat"><span>Sản phẩm đã mua</span><strong>${items}</strong></div>
    <div class="stat"><span>Tổng chi tiêu</span><strong>${formatVND(spent)}</strong></div>`;

  if (!orders.length) {
    list.innerHTML = `<p class="empty-state">Bạn chưa có đơn hàng nào.<br><a href="../tram-cai/index.html">Bắt đầu mua sắm</a></p>`;
    return;
  }

  const statusText = { pending: 'Đang xử lý', confirmed: 'Đã xác nhận', shipping: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã huỷ', returned: 'Đã hoàn' };
  list.innerHTML = orders.map(o => `
    <article class="order">
      <header class="order-head">
        <span class="oid">#${o.id}</span>
        <span class="date">${formatDate(o.created_at)}</span>
        <span class="status ${o.status}">${statusText[o.status] || o.status}</span>
        <span class="total">${formatVND(o.total_amount)}</span>
      </header>
      ${o.ship_address ? `<p class="order-ship">Giao đến: <strong>${escapeHtml(o.ship_name || '')}</strong> · ${escapeHtml(o.ship_phone || '')} — ${escapeHtml(o.ship_address)} · ${o.payment_method === 'qr' ? 'Chuyển khoản QR' : 'COD'}</p>` : ''}
      <div class="order-items">
        ${o.purchases.map(it => `
          <div class="order-item">
            <span>${escapeHtml(it.product_name)}</span>
            <span class="q">× ${it.quantity}</span>
            <span>${formatVND(it.unit_price * it.quantity)}</span>
          </div>`).join('')}
      </div>
    </article>`).join('');
}

/* ---------- Hồ sơ ---------- */
function fillProfileForm(p) {
  document.getElementById('pfEmail').value = p.email || '';
  document.getElementById('pfName').value = p.full_name || '';
  document.getElementById('pfPhone').value = p.phone || '';
  document.getElementById('pfAddress').value = p.address || '';
}

document.getElementById('profileForm').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = document.getElementById('pfMsg');
  const btn = document.getElementById('pfSave');
  const full_name = document.getElementById('pfName').value.trim();
  const phone = document.getElementById('pfPhone').value.trim();
  const address = document.getElementById('pfAddress').value.trim();
  msg.className = 'form-msg'; msg.textContent = '';

  if (!full_name) { msg.className = 'form-msg error'; msg.textContent = 'Họ và tên không được để trống.'; return; }
  if (phone && !/^[0-9+\s.-]{8,15}$/.test(phone)) { msg.className = 'form-msg error'; msg.textContent = 'Số điện thoại không hợp lệ.'; return; }

  btn.classList.add('loading');
  const { data, error } = await sb
    .from('customers')
    .update({ full_name, phone: phone || null, address: address || null })
    .eq('id', Auth.user.id)
    .select()
    .single();
  btn.classList.remove('loading');

  if (error) { msg.className = 'form-msg error'; msg.textContent = viError(error); return; }

  Auth.profile = { ...Auth.profile, ...data };
  fillWelcome(Auth.profile);
  Layout.renderAccount(Auth.profile);
  msg.className = 'form-msg success';
  msg.textContent = 'Đã lưu thông tin.';
  toast('Đã cập nhật thông tin cá nhân', 'success');
});

/* ---------- Gợi ý sản phẩm ---------- */
async function loadSuggestions() {
  const grid = document.getElementById('suggestGrid');
  grid.innerHTML = skeletonCards(4);
  const { data, error } = await sb
    .from('products')
    .select('id, sku, name, image_path, price, stock')
    .gt('stock', 0)
    .order('created_at', { ascending: false })
    .limit(4);
  renderProducts(grid, data, error, 'Sản phẩm mới đang được chuẩn bị.');
}
