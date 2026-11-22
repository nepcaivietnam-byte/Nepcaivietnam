/* =========================================================
   ADMIN · DOANH THU & BÁO CÁO · KHÁCH HÀNG · ĐĂNG KÝ NHẬN TIN
   ========================================================= */
VIEWS.reports = { title: 'Doanh thu & Báo cáo', eyebrow: 'Báo cáo', el: 'reports', load: loadReports };
VIEWS.customers = { title: 'Khách hàng', eyebrow: 'Báo cáo', el: 'customers', load: loadCustomers };
VIEWS.subscribers = { title: 'Đăng ký nhận tin', eyebrow: 'Báo cáo', el: 'subscribers', load: loadSubscribers };

/* =========================== DOANH THU =========================== */
let revChart = null;
function setupReports() {
  const sel = $('yearSelect');
  const y = new Date().getFullYear();
  for (let i = 0; i < 5; i++) sel.add(new Option(`Năm ${y - i}`, y - i));
  sel.onchange = loadReports;
}

async function loadReports() {
  const year = Number($('yearSelect').value);
  const from = new Date(year, 0, 1).toISOString(), to = new Date(year + 1, 0, 1).toISOString();
  const [monthly, sum, top] = await Promise.all([
    sb.rpc('admin_monthly_revenue', { p_year: year }),
    sb.rpc('admin_summary'),
    sb.from('purchases').select('product_id, product_name, quantity, unit_price, orders!inner(status, completed_at)')
      .eq('orders.status', 'delivered').gte('orders.completed_at', from).lt('orders.completed_at', to)
  ]);
  if (monthly.error) { toast(viError(monthly.error), 'error'); return; }

  const rows = monthly.data || [];
  const revenue = Array.from({ length: 12 }, (_, i) => Number(rows.find(r => r.month === i + 1)?.revenue || 0));
  const counts = Array.from({ length: 12 }, (_, i) => Number(rows.find(r => r.month === i + 1)?.order_count || 0));
  const total = revenue.reduce((a, b) => a + b, 0), n = counts.reduce((a, b) => a + b, 0), best = Math.max(...revenue);
  $('yrRevenue').textContent = formatVND(total);
  $('yrOrders').textContent = n;
  $('yrBest').textContent = best > 0 ? `Tháng ${revenue.indexOf(best) + 1}` : '—';
  $('yrAvg').textContent = n ? formatVND(Math.round(total / n)) : '—';

  const nowMonth = new Date().getFullYear() === year ? new Date().getMonth() : -1;
  if (revChart) revChart.destroy();
  revChart = new Chart($('revenueChart'), {
    type: 'bar',
    data: { labels: Array.from({ length: 12 }, (_, i) => 'T' + (i + 1)),
      datasets: [{ data: revenue, backgroundColor: revenue.map((_, i) => i === nowMonth ? '#B8893E' : '#800020'), hoverBackgroundColor: '#5c0017', borderRadius: 4, maxBarThickness: 46 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: RM() ? false : { duration: 500, easing: 'easeOutQuart' },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#2A1A1D', titleFont: chartFont(), bodyFont: chartFont(), padding: 12,
        callbacks: { title: it => `Tháng ${it[0].dataIndex + 1}/${year}`, label: it => `Doanh thu: ${formatVND(it.raw)}`, afterLabel: it => `Số đơn: ${counts[it.dataIndex]}` } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#7B6A66', font: chartFont() } },
        y: { beginAtZero: true, suggestedMax: 1000000, grid: { color: 'rgba(128,0,32,.08)' }, border: { display: false }, ticks: { color: '#7B6A66', font: chartFont(), callback: v => compactVND(v) } }
      }
    }
  });

  // Sản phẩm bán chạy trong năm (theo đơn đã giao)
  const agg = {};
  (top.data || []).forEach(r => {
    const k = r.product_id || r.product_name;
    agg[k] ||= { name: r.product_name, qty: 0, rev: 0 };
    agg[k].qty += r.quantity; agg[k].rev += r.quantity * Number(r.unit_price);
  });
  const ranked = Object.values(agg).sort((a, b) => b.qty - a.qty || b.rev - a.rev).slice(0, 10);
  $('topBody').innerHTML = ranked.length ? ranked.map((r, i) => `
    <tr><td>${i + 1}</td><td class="pname">${escapeHtml(r.name)}</td><td class="num">${r.qty}</td><td class="num">${formatVND(r.rev)}</td></tr>`).join('')
    : emptyRow(4, `Chưa có đơn đã giao trong năm ${year}.`);

  const s = (sum.data && sum.data[0]) || { total_revenue: 0, total_orders: 0, total_items_sold: 0 };
  $('allTime').innerHTML = `
    <dt>Tổng doanh thu</dt><dd>${formatVND(s.total_revenue)}</dd>
    <dt>Đơn đã giao</dt><dd>${Number(s.total_orders).toLocaleString('vi-VN')}</dd>
    <dt>Sản phẩm đã bán</dt><dd>${Number(s.total_items_sold).toLocaleString('vi-VN')}</dd>`;
}

/* =========================== KHÁCH HÀNG =========================== */
let customers = [];
function setupCustomers() {
  $('custSearch').addEventListener('input', () => renderCustomers(false));
  const open = e => {
    const tr = e.target.closest('tr[data-cust]'); if (!tr) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault(); openCustomer(tr.dataset.cust);
  };
  $('custBody').addEventListener('click', open);
  $('custBody').addEventListener('keydown', open);
}

async function loadCustomers() {
  $('custBody').innerHTML = rowSkeleton(6);
  const { data, error } = await sb.from('customers').select('id, email, full_name, phone, address, role, created_at, orders(id, total_amount, status, created_at)')
    .order('created_at', { ascending: false });
  if (error) { $('custBody').innerHTML = emptyRow(6, escapeHtml(viError(error))); return; }
  customers = (data || []).map(c => {
    const valid = (c.orders || []).filter(o => !['cancelled', 'returned'].includes(o.status));
    return { ...c, nOrders: valid.length, spent: (c.orders || []).filter(o => o.status === 'delivered').reduce((a, o) => a + Number(o.total_amount), 0) };
  });
  renderCustomers(true);
}

function renderCustomers(intro) {
  const q = norm($('custSearch').value.trim());
  const list = customers.filter(c => !q || [c.full_name, c.email, c.phone, c.address].some(v => norm(v).includes(q)));
  $('custCount').textContent = `${customers.filter(c => c.role === 'customer').length} khách hàng`;
  const body = $('custBody');
  body.classList.toggle('intro', intro);
  if (!list.length) { body.innerHTML = emptyRow(6, customers.length ? 'Không tìm thấy khách hàng.' : 'Chưa có khách hàng.'); return; }
  body.innerHTML = list.map((c, i) => `
    <tr data-cust="${c.id}" data-order tabindex="0" style="animation-delay:${Math.min(i, 8) * 30}ms">
      <td><span class="cust"><span class="av">${escapeHtml(initials(c.full_name, c.email))}</span>
        <span><span class="pname">${escapeHtml(c.full_name || '—')}</span>${c.role === 'admin' ? ' <span class="chip-mini">Admin</span>' : ''}<br><span class="sku">${escapeHtml(c.email)}</span></span></span></td>
      <td>${escapeHtml(c.phone || '—')}</td>
      <td class="ship-cell"><span class="addr">${escapeHtml(c.address || '—')}</span></td>
      <td class="num">${c.nOrders}</td>
      <td class="num"><strong>${formatVND(c.spent)}</strong></td>
      <td>${formatDate(c.created_at)}</td>
    </tr>`).join('');
}

function openCustomer(id) {
  const c = customers.find(x => x.id === id); if (!c) return;
  $('custTitle').textContent = c.full_name || c.email;
  $('custSince').textContent = 'Tham gia ' + formatDate(c.created_at);
  const ords = [...(c.orders || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  $('custBodyDrawer').innerHTML = `
    <section class="d-sec">
      <dl>
        <dt>Email</dt><dd><a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a></dd>
        <dt>Điện thoại</dt><dd>${c.phone ? `<a href="tel:${escapeHtml(c.phone.replace(/\s+/g, ''))}">${escapeHtml(c.phone)}</a>` : '—'}</dd>
        <dt>Địa chỉ</dt><dd>${escapeHtml(c.address || '—')}</dd>
      </dl>
    </section>
    <section class="d-sec">
      <div class="mini-kpis"><div><span>Đơn hàng</span><strong>${c.nOrders}</strong></div><div><span>Đã chi (đơn đã giao)</span><strong>${formatVND(c.spent)}</strong></div></div>
    </section>
    <section class="d-sec">
      <h3>Lịch sử đơn hàng</h3>
      ${ords.length ? `<table class="table table-click compact mini"><tbody>${ords.map(o => `
        <tr data-order="${o.id}" tabindex="0"><td><strong>#${o.id}</strong></td><td>${formatDate(o.created_at)}</td><td>${statusPill(o.status)}</td><td class="num">${formatVND(o.total_amount)}</td></tr>`).join('')}
      </tbody></table>` : '<p class="muted">Chưa có đơn hàng.</p>'}
    </section>`;
  openDrawer($('custDrawer'));
}

/* =========================== ĐĂNG KÝ NHẬN TIN =========================== */
let subscribers = [];
function setupSubscribers() {
  $('copyEmails').onclick = async () => {
    if (!subscribers.length) { toast('Chưa có email nào', 'error'); return; }
    try { await navigator.clipboard.writeText(subscribers.map(s => s.email).join(', ')); toast(`Đã sao chép ${subscribers.length} email`, 'success'); }
    catch { toast('Trình duyệt chặn sao chép', 'error'); }
  };
  $('subBody').addEventListener('click', e => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    const s = subscribers.find(x => String(x.id) === b.dataset.del);
    askConfirm({ title: 'Xoá email?', html: `Gỡ <strong>${escapeHtml(s.email)}</strong> khỏi danh sách nhận tin.`, action: async () => {
      const { error } = await sb.from('subscribers').delete().eq('id', s.id);
      if (error) { toast(viError(error), 'error'); return; }
      toast('Đã xoá', 'success'); loadSubscribers();
    } });
  });
}
async function loadSubscribers() {
  $('subBody').innerHTML = rowSkeleton(3, 3);
  const { data, error } = await sb.from('subscribers').select('*').order('created_at', { ascending: false });
  if (error) { $('subBody').innerHTML = emptyRow(3, escapeHtml(viError(error))); return; }
  subscribers = data || [];
  $('subBody').innerHTML = subscribers.length ? subscribers.map(s => `
    <tr><td><a href="mailto:${escapeHtml(s.email)}">${escapeHtml(s.email)}</a></td><td>${formatDate(s.created_at)}</td>
      <td class="actions"><button class="icon-action del" data-del="${s.id}" title="Xoá">${icon('trash')}</button></td></tr>`).join('')
    : emptyRow(3, 'Chưa có ai đăng ký.');
}
