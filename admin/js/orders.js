/* =========================================================
   ADMIN · ĐƠN HÀNG & VẬN CHUYỂN
   Vòng đời: pending (Cần xử lý) → confirmed (Đã xác nhận · cần giao) → shipping (Đang giao)
             → delivered (Đã giao · cộng doanh thu)
             huỷ: cancelled · hoàn: returned (đều trả hàng về kho)
   ========================================================= */
const STATUS_TEXT = { pending: 'Cần xử lý', confirmed: 'Đã xác nhận', shipping: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã huỷ', returned: 'Đã hoàn' };
const statusPill = s => `<span class="status ${s}">${STATUS_TEXT[s] || s}</span>`;

// Bộ lọc của 2 trang: “Tất cả đơn hàng” và “Vận chuyển”
const ORDER_MODES = {
  orders: {
    title: 'Tất cả đơn hàng', hint: 'Bấm vào một đơn để xem đầy đủ thông tin và cập nhật trạng thái. Chỉ đơn <strong>Đã giao</strong> mới được cộng vào doanh thu.',
    chips: [
      ['all', 'Tất cả', null],
      ['need', 'Cần xử lý', ['pending']],
      ['ok', 'Đã xác nhận', ['confirmed', 'shipping', 'delivered']],
      ['void', 'Huỷ / Hoàn', ['cancelled', 'returned']]
    ]
  },
  shipping: {
    title: 'Vận chuyển', hint: 'Đơn đã xác nhận cần đi giao. Bấm “Bắt đầu giao” khi đã gửi cho đơn vị vận chuyển, “Đã giao” khi khách nhận hàng.',
    chips: [
      ['all', 'Tất cả', ['confirmed', 'shipping', 'delivered']],
      ['toship', 'Cần giao hàng', ['confirmed']],
      ['shipping', 'Đang giao', ['shipping']],
      ['done', 'Đã giao', ['delivered']]
    ]
  }
};
// Nút chuyển trạng thái theo trạng thái hiện tại
const NEXT_ACTIONS = {
  pending: [['confirmed', 'Xác nhận đơn', 'btn'], ['cancelled', 'Huỷ đơn', 'btn btn-ghost btn-cancel']],
  confirmed: [['shipping', 'Bắt đầu giao', 'btn'], ['cancelled', 'Huỷ đơn', 'btn btn-ghost btn-cancel']],
  shipping: [['delivered', '✓ Đã giao', 'btn btn-success'], ['returned', 'Hoàn hàng', 'btn btn-ghost btn-cancel']],
  delivered: [['returned', 'Hoàn hàng', 'btn btn-ghost btn-cancel']],
  cancelled: [['pending', 'Mở lại đơn', 'btn btn-ghost']],
  returned: [['pending', 'Mở lại đơn', 'btn btn-ghost']]
};
const DESTRUCTIVE = { cancelled: 'Bấm lần nữa để huỷ', returned: 'Bấm lần nữa để hoàn' };

const ORDER_SELECT = 'id, total_amount, status, created_at, confirmed_at, shipped_at, completed_at, ship_type, ship_name, ship_phone, ship_address, payment_method, note, ' +
  'customers(full_name, email, phone, address), purchases(product_name, quantity, unit_price, product_id)';
let orders = [];
let orderMode = 'orders';
let orderChip = 'all';
let openOrderId = null;

VIEWS.orders = { title: 'Tất cả đơn hàng', eyebrow: 'Đơn hàng', el: 'orders', load: loadOrders };
VIEWS.shipping = { title: 'Vận chuyển', eyebrow: 'Đơn hàng', el: 'orders', load: loadOrders };

function setupOrders() {
  $('statusChips').addEventListener('click', e => {
    const c = e.target.closest('.chip'); if (!c) return;
    orderChip = c.dataset.status;
    renderOrders(false);
  });
  $('orderSearch').addEventListener('input', () => renderOrders(false));

  const openFromRow = e => {
    const tr = e.target.closest('tr[data-order]'); if (!tr) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    openOrder(Number(tr.dataset.order));
  };
  ['ordersBody', 'recentBody', 'custBodyDrawer'].forEach(id => {
    $(id).addEventListener('click', openFromRow);
    $(id).addEventListener('keydown', openFromRow);
  });

  $('statusActions').addEventListener('click', e => {
    const b = e.target.closest('[data-set]'); if (!b || b.disabled) return;
    const st = b.dataset.set;
    if (DESTRUCTIVE[st] && !b.classList.contains('confirming')) {   // bấm 2 lần, không dùng hộp thoại
      const label = b.textContent;
      b.classList.add('confirming'); b.textContent = DESTRUCTIVE[st];
      clearTimeout(b._t);
      b._t = setTimeout(() => { b.classList.remove('confirming'); b.textContent = label; }, 3000);
      return;
    }
    setOrderStatus(openOrderId, st, b);
  });
}

async function loadOrders(mode) {
  if (mode !== orderMode) { orderMode = mode; orderChip = 'all'; $('orderSearch').value = ''; }
  $('ordersHint').innerHTML = ORDER_MODES[orderMode].hint;
  renderChips();
  const body = $('ordersBody');
  body.innerHTML = rowSkeleton(6);
  const { data, error } = await sb.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(1000);
  if (error) { body.innerHTML = emptyRow(6, escapeHtml(viError(error))); return; }
  orders = data || [];
  renderOrders(true);
}

function renderChips() {
  $('statusChips').innerHTML = ORDER_MODES[orderMode].chips.map(([k, label, sts]) => {
    const n = orders.filter(o => !sts || sts.includes(o.status)).length;
    return `<button class="chip ${k === orderChip ? 'active' : ''}" data-status="${k}" role="tab" aria-selected="${k === orderChip}">${label} <span>${n}</span></button>`;
  }).join('');
}

function renderOrders(intro) {
  renderChips();
  const sts = ORDER_MODES[orderMode].chips.find(c => c[0] === orderChip)?.[2];
  const q = norm($('orderSearch').value.trim()).replace(/^#/, '');
  const list = orders.filter(o => (!sts || sts.includes(o.status)) && (!q ||
    [o.id, o.ship_name, o.ship_phone, o.ship_address, o.customers?.full_name, o.customers?.email, o.customers?.phone].some(v => norm(v).includes(q))));
  const body = $('ordersBody');
  body.classList.toggle('intro', intro);
  if (!list.length) { body.innerHTML = emptyRow(6, orders.length ? 'Không có đơn phù hợp.' : 'Chưa có đơn hàng nào.'); return; }
  body.innerHTML = list.map((o, i) => `
    <tr data-order="${o.id}" tabindex="0" style="animation-delay:${Math.min(i, 8) * 30}ms">
      <td><strong>#${o.id}</strong></td>
      <td>${escapeHtml(o.customers?.full_name || '—')}<br><span class="sku">${escapeHtml(o.customers?.email || '')}</span></td>
      <td class="ship-cell">${escapeHtml(o.ship_name || '—')} · ${escapeHtml(o.ship_phone || '')}<br>
        <span class="addr">${o.ship_type === 'other' ? '<em class="tag-other">Địa chỉ khác</em> ' : ''}${escapeHtml(o.ship_address || '')}</span></td>
      <td>${formatDate(o.created_at)}</td>
      <td>${statusPill(o.status)}</td>
      <td class="num"><strong>${formatVND(o.total_amount)}</strong></td>
    </tr>`).join('');
}

async function openOrder(id) {
  let o = orders.find(x => x.id === id);
  if (!o) {
    const { data, error } = await sb.from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle();
    if (error || !data) { toast(error ? viError(error) : 'Không tìm thấy đơn hàng', 'error'); return; }
    o = data; orders.push(o);
  }
  if ($('custDrawer').classList.contains('open')) closeDrawer($('custDrawer'), true);
  openOrderId = id;
  renderDrawer(o);
  openDrawer($('orderDrawer'));
}

function renderDrawer(o) {
  const c = o.customers || {};
  const items = o.purchases || [];
  const tel = v => v ? `<a href="tel:${escapeHtml(String(v).replace(/\s+/g, ''))}">${escapeHtml(v)}</a>` : '—';
  const dt = d => d ? new Date(d).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '';
  $('drawerTitle').innerHTML = `Đơn #${o.id} ${statusPill(o.status)}`;
  $('drawerDate').textContent = 'Đặt lúc ' + dt(o.created_at);

  // Dòng thời gian
  const voided = ['cancelled', 'returned'].includes(o.status);
  const steps = [['Đặt hàng', o.created_at, true], ['Xác nhận', o.confirmed_at, ['confirmed', 'shipping', 'delivered'].includes(o.status) || (voided && o.confirmed_at)],
    ['Đang giao', o.shipped_at, ['shipping', 'delivered'].includes(o.status) || (voided && o.shipped_at)], ['Đã giao', o.completed_at, o.status === 'delivered']];
  const timeline = `<ol class="timeline ${voided ? 'void' : ''}">${steps.map(([l, t, on]) => `<li class="${on ? 'on' : ''}"><i></i><span>${l}</span><small>${on && t ? dt(t) : ''}</small></li>`).join('')}</ol>
    ${voided ? `<p class="void-note">${o.status === 'cancelled' ? 'Đơn đã huỷ' : 'Đơn đã hoàn'} — hàng đã được trả về kho.</p>` : ''}`;

  $('drawerBody').innerHTML = `
    <section class="d-sec">${timeline}</section>
    <section class="d-sec d-ship">
      <h3>Giao hàng <span class="ship-type ${o.ship_type}">${o.ship_type === 'other' ? 'Địa chỉ khác' : 'Địa chỉ mặc định'}</span></h3>
      <dl>
        <dt>Người nhận</dt><dd>${escapeHtml(o.ship_name || '—')}</dd>
        <dt>Điện thoại</dt><dd>${tel(o.ship_phone)}</dd>
        <dt>Địa chỉ</dt><dd><strong>${escapeHtml(o.ship_address || '—')}</strong></dd>
        <dt>Thanh toán</dt><dd>${o.payment_method === 'qr' ? 'Chuyển khoản QR' : 'Thanh toán khi nhận hàng (COD)'}</dd>
        ${o.note ? `<dt>Ghi chú</dt><dd class="d-note">${escapeHtml(o.note)}</dd>` : ''}
      </dl>
    </section>
    <section class="d-sec">
      <h3>Khách hàng</h3>
      <dl>
        <dt>Họ tên</dt><dd>${escapeHtml(c.full_name || '—')}</dd>
        <dt>Email</dt><dd>${c.email ? `<a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a>` : '—'}</dd>
        <dt>Điện thoại</dt><dd>${tel(c.phone)}</dd>
        <dt>Địa chỉ hồ sơ</dt><dd>${escapeHtml(c.address || '—')}</dd>
      </dl>
    </section>
    <section class="d-sec">
      <h3>Sản phẩm (${items.reduce((a, b) => a + b.quantity, 0)})</h3>
      <div class="d-items">
        ${items.map(it => `
          <div class="d-item">
            <span>${escapeHtml(it.product_name)}</span>
            <span class="muted">${formatVND(it.unit_price)} × ${it.quantity}</span>
            <strong>${formatVND(it.unit_price * it.quantity)}</strong>
          </div>`).join('')}
        <div class="d-item d-total"><span>Tổng cộng</span><span></span><strong>${formatVND(o.total_amount)}</strong></div>
      </div>
    </section>`;
  $('drawerMsg').textContent = '';
  const acts = NEXT_ACTIONS[o.status] || [];
  $('statusActions').style.gridTemplateColumns = `repeat(${acts.length}, 1fr)`;
  $('statusActions').innerHTML = acts.map(([st, label, cls]) => `<button type="button" class="${cls}" data-set="${st}">${label}</button>`).join('');
}

async function setOrderStatus(id, status, btn) {
  if (!id) return;
  btn.classList.add('loading');
  const { data, error } = await sb.rpc('admin_set_order_status', { p_order_id: id, p_status: status });
  btn.classList.remove('loading');
  if (error) { formFail($('drawerMsg'), viError(error)); return; }
  const o = orders.find(x => x.id === id);
  if (o) Object.assign(o, { status: data.status, confirmed_at: data.confirmed_at, shipped_at: data.shipped_at, completed_at: data.completed_at });
  renderDrawer(o);
  if (currentView === 'orders' || currentView === 'shipping') renderOrders(false);
  if (currentView === 'dashboard') loadDashboard();
  refreshBadges();
  const msg = {
    confirmed: `Đã xác nhận đơn #${id}`, shipping: `Đơn #${id} đang được giao`,
    delivered: `Đơn #${id} đã giao — đã cộng vào doanh thu`, cancelled: `Đã huỷ đơn #${id} và trả hàng về kho`,
    returned: `Đơn #${id} đã hoàn — hàng đã về kho`, pending: `Đã mở lại đơn #${id}`
  };
  toast(msg[status], 'success');
}
