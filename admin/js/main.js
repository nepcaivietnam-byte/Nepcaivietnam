/* =========================================================
   ADMIN · KHỞI ĐỘNG
   ========================================================= */
(async () => {
  const p = await Auth.require('admin');
  if (!p) return;

  $('brand').innerHTML = `<img src="../assets/images/brand/logo-wordmark-cream.png" alt="${escapeHtml(CFG.SITE.name)}" width="170" height="54"><small>Quản trị</small>`;
  $('meAvatar').textContent = initials(p.full_name, p.email);
  $('meName').textContent = displayName(p);
  $('meEmail').textContent = p.email;
  $('today').textContent = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.body.classList.remove('is-loading');

  setupNav(); setupModals(); setupDrawers(); setupConfirm();
  setupDashboard(); setupOrders(); setupCollections(); setupProducts(); setupStock();
  setupBlog(); setupBanners(); setupReports(); setupCustomers(); setupSubscribers();
  $('logoutBtn').onclick = () => Auth.logout();

  // Link cũ (#inventory, #revenue, #summary) vẫn mở đúng mục mới
  const alias = { inventory: 'products', revenue: 'reports', summary: 'dashboard' };
  const start = location.hash.slice(1);
  showView(alias[start] || start || 'dashboard');
  refreshBadges();
})();
