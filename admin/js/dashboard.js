/* =========================================================
   ADMIN · TỔNG QUAN
   KPI 30 ngày (so với 30 ngày trước) · biểu đồ doanh thu 7/30 ngày · đơn gần đây
   · biểu đồ tồn kho · bài viết mới nhất · thao tác nhanh
   ========================================================= */
VIEWS.dashboard = { title: 'Tổng quan', eyebrow: 'Quản trị', el: 'dashboard', load: loadDashboard };
let dashData = null, dashChart = null, donutChart = null;

function setupDashboard() {
  $('dashRange').addEventListener('change', drawDashChart);
  document.querySelector('.quick-grid').addEventListener('click', e => {
    const b = e.target.closest('[data-quick]'); if (!b) return;
    const k = b.dataset.quick;
    if (k === 'product') { showView('products'); openProductModal(null); }
    if (k === 'post') { showView('goc-nep'); openPostModal(null); }
    if (k === 'collection') { showView('collections'); openCollectionModal(null); }
    if (k === 'banner') { showView('banners'); $('bannerFiles').click(); }
  });
}

async function loadDashboard() {
  const kp = $('dashKpis');
  if (!dashData) kp.innerHTML = '<div class="kpi card"><div class="sk"></div></div>'.repeat(4);
  $('recentBody').innerHTML = rowSkeleton(5, 3);

  const [dash, recent, post] = await Promise.all([
    sb.rpc('admin_dashboard', { p_days: 30 }),
    sb.from('orders').select('id, total_amount, status, created_at, ship_name, customers(full_name, email)').order('created_at', { ascending: false }).limit(6),
    sb.from('posts').select('id, title, section, category, cover_path, published_at, is_published').order('created_at', { ascending: false }).limit(1).maybeSingle()
  ]);
  if (dash.error) { toast(viError(dash.error), 'error'); kp.innerHTML = ''; return; }
  dashData = dash.data;
  const d = dashData, series = d.series || [];

  const pct = (now, prev) => {
    now = Number(now); prev = Number(prev);
    if (!prev) return { t: now ? '↑' : '', cls: now ? 'up' : '', note: '30 ngày trước: 0' };
    const v = ((now - prev) / prev) * 100;
    return { t: (v > 0 ? '+' : '') + v.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%', cls: v > 0 ? 'up' : v < 0 ? 'down' : '' };
  };
  const cards = [
    { label: 'Doanh thu 30 ngày', val: Number(d.revenue_30), fmt: formatVND, p: pct(d.revenue_30, d.revenue_prev), spark: series.map(s => Number(s.revenue)), go: 'reports' },
    { label: 'Đơn hàng 30 ngày', val: Number(d.orders_30), p: pct(d.orders_30, d.orders_prev), spark: series.map(s => Number(s.orders)), go: 'orders' },
    { label: 'Khách hàng mới', val: Number(d.customers_30), p: pct(d.customers_30, d.customers_prev), spark: series.map(s => Number(s.customers)), go: 'customers' },
    { label: 'Cần xử lý / Cần giao / Đang giao', raw: `${d.pending_now} / ${d.to_ship_now} / ${d.shipping_now}`, sub: 'đơn đang chờ bạn', go: d.pending_now ? 'orders' : 'shipping' }
  ];
  kp.innerHTML = cards.map((c, i) => `
    <button class="kpi card kpi-btn" data-go="${c.go}">
      <span>${c.label}</span>
      <strong data-k="${i}">${c.raw ?? '0'}</strong>
      ${c.p ? `<em class="delta ${c.p.cls}">${c.p.t} <small>${c.p.note || 'so với 30 ngày trước'}</small></em>` : `<em class="delta">${c.sub}</em>`}
      ${c.spark ? sparkline(c.spark) : ''}
    </button>`).join('');
  cards.forEach((c, i) => { if (c.raw == null) animateNumber(kp.querySelector(`[data-k="${i}"]`), c.val, c.fmt); });

  drawDashChart();
  drawStockDonut(d.stock || {});

  const list = recent.data || [];
  $('recentBody').innerHTML = list.length ? list.map(o => `
    <tr data-order="${o.id}" tabindex="0">
      <td><strong>#${o.id}</strong></td>
      <td>${escapeHtml(o.customers?.full_name || o.ship_name || '—')}</td>
      <td>${formatDate(o.created_at)}</td>
      <td>${statusPill(o.status)}</td>
      <td class="num"><strong>${formatVND(o.total_amount)}</strong></td>
    </tr>`).join('') : emptyRow(5, 'Chưa có đơn hàng nào.');

  const p = post.data;
  $('latestPost').innerHTML = p ? `
    <div class="card-head row"><h2>Bài viết mới nhất</h2><button class="link-btn" data-go="${p.section}">Quản lý →</button></div>
    <a class="lp" href="../bai-viet/index.html?id=${p.id}" target="_blank" rel="noopener">
      <img src="${imageUrl(p.cover_path)}" alt="" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
      <div>
        <span class="chip-mini">${p.section === 've-nep' ? 'Về Nếp' : escapeHtml(POST_CATEGORIES[p.category] || 'Góc Nếp')}</span>
        <strong>${escapeHtml(p.title)}</strong>
        <small>${p.is_published ? 'Đăng ' + formatDate(p.published_at) : 'Bản nháp'}</small>
      </div>
    </a>` : `<div class="card-head"><h2>Bài viết mới nhất</h2></div><p class="pad muted">Chưa có bài viết. <button class="link-btn" data-quick-post>Viết bài đầu tiên →</button></p>`;
  $('latestPost').querySelector('[data-quick-post]')?.addEventListener('click', () => { showView('goc-nep'); openPostModal(null); });
}

function chartFont() { return { family: "'TeX Gyre Pagella', Palatino, Georgia, serif" }; }

function drawDashChart() {
  if (!dashData) return;
  const n = Number($('dashRange').value);
  const s = (dashData.series || []).slice(-n);
  const labels = s.map(x => { const d = new Date(x.day); return `${d.getDate()}/${d.getMonth() + 1}`; });
  const data = s.map(x => Number(x.revenue));
  if (dashChart) dashChart.destroy();
  const ctx = $('dashChart').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 280);
  grad.addColorStop(0, 'rgba(128,0,32,.22)'); grad.addColorStop(1, 'rgba(128,0,32,0)');
  dashChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ data, borderColor: '#800020', backgroundColor: grad, fill: true, tension: .35, borderWidth: 2, pointRadius: n > 10 ? 0 : 3, pointHoverRadius: 5, pointBackgroundColor: '#800020' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: RM() ? false : { duration: 450, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#2A1A1D', titleFont: chartFont(), bodyFont: chartFont(), padding: 10,
          callbacks: { label: i => 'Doanh thu: ' + formatVND(i.raw), afterLabel: i => 'Đơn mới: ' + s[i.dataIndex].orders } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#7B6A66', font: chartFont(), maxTicksLimit: 10 } },
        y: { beginAtZero: true, suggestedMax: 500000, grid: { color: 'rgba(128,0,32,.08)' }, border: { display: false }, ticks: { color: '#7B6A66', font: chartFont(), callback: v => compactVND(v) } }
      }
    }
  });
}

function drawStockDonut(st) {
  const vals = [Number(st.in || 0), Number(st.low || 0), Number(st.out || 0)];
  const labels = ['Còn hàng (> 3)', 'Sắp hết (1–3)', 'Hết hàng'];
  const colors = ['#2f6b3d', '#B8893E', '#a3122f'];
  const total = vals.reduce((a, b) => a + b, 0);
  $('donutCenter').innerHTML = `<strong>${Number(st.units || 0).toLocaleString('vi-VN')}</strong><span>chiếc trong kho</span>`;
  $('stockLegend').innerHTML = labels.map((l, i) => `<li><i style="background:${colors[i]}"></i>${l}<b>${vals[i]}</b></li>`).join('') +
    `<li class="muted"><i></i>Tổng mẫu<b>${total}</b></li>`;
  if (donutChart) donutChart.destroy();
  donutChart = new Chart($('stockDonut'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data: total ? vals : [1], backgroundColor: total ? colors : ['#EDE3CF'], borderWidth: 0 }] },
    options: { cutout: '72%', responsive: true, maintainAspectRatio: false, animation: RM() ? false : { duration: 500 },
      plugins: { legend: { display: false }, tooltip: { enabled: !!total, backgroundColor: '#2A1A1D', bodyFont: chartFont() } } }
  });
  $('stockDonut').closest('.dash-stock').onclick = () => showView('stock');
}
