/* =========================================================
   COMMON JS — kết nối Supabase + header/footer + giỏ hàng
   Mọi trang (trừ admin) đều nạp file này sau config.js.
   ========================================================= */
const CFG = window.APP_CONFIG;
const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
const BUCKET = 'product-images';
const CART_KEY = 'tram_cart_v1';
const PLACEHOLDER_IMG = '../assets/images/placeholder.svg';

/* ---------- Icons (SVG nét mảnh) ---------- */
const ICON_PATHS = {
  bag: '<path d="M5 8h14l-1.2 12.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9L5 8Z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.6-4 4.6-6 8-6s6.4 2 8 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m3 7 9 6 9-6"/>',
  chat: '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 20 12Z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  note: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  chevronLeft: '<path d="m15 6-6 6 6 6"/>',
  truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',
  shield: '<path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>'
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}

/* ---------- Tiện ích ---------- */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function formatVND(n) {
  return new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + '₫';
}
function formatDate(d) {
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function imageUrl(path) {
  if (!path) return PLACEHOLDER_IMG;
  if (/^https?:\/\//i.test(path)) return path;
  if (/^assets\//.test(path)) return '../' + path;   // ảnh có sẵn trong web (dữ liệu mẫu)
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
function initials(name, email) {
  const s = (name || '').trim();
  if (s) {
    const parts = s.split(/\s+/);
    return parts[parts.length - 1].charAt(0).toUpperCase(); // tên gọi (chữ cuối)
  }
  return (email || '?').charAt(0).toUpperCase();
}
function displayName(p) {
  return (p && (p.full_name || '').trim()) || (p?.email || '').split('@')[0] || 'Khách';
}
function viError(err) {
  const m = (err && (err.message || err.error_description)) || String(err || '');
  if (/invalid login credentials/i.test(m)) return 'Email hoặc mật khẩu không đúng.';
  if (/email not confirmed/i.test(m)) return 'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư.';
  if (/already registered|already been registered/i.test(m)) return 'Email này đã được đăng ký.';
  if (/password should be at least/i.test(m)) return 'Mật khẩu phải có ít nhất 6 ký tự.';
  if (/rate limit/i.test(m)) return 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.';
  if (/failed to fetch|network/i.test(m)) return 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.';
  return m || 'Đã có lỗi xảy ra.';
}

/* ---------- Toast ---------- */
function toast(msg, type = '') {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  wrap.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2600);
}

/* ---------- Giỏ hàng (lưu trong trình duyệt) ---------- */
const Cart = {
  get() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
  },
  save(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch { /* bỏ qua */ }
    Cart.updateBadge();
  },
  add(id, qty = 1, max = Infinity) {
    const items = Cart.get();
    const it = items.find(i => i.id === id);
    const cur = it ? it.qty : 0;
    const next = Math.min(cur + qty, max);
    if (next <= cur) return false;
    if (it) it.qty = next; else items.push({ id, qty: next });
    Cart.save(items);
    return true;
  },
  setQty(id, qty) {
    Cart.save(Cart.get().map(i => (i.id === id ? { ...i, qty } : i)).filter(i => i.qty > 0));
  },
  remove(id) { Cart.save(Cart.get().filter(i => i.id !== id)); },
  clear() { Cart.save([]); },
  count() { return Cart.get().reduce((s, i) => s + i.qty, 0); },
  updateBadge() {
    const c = Cart.count();
    document.querySelectorAll('[data-cart-count]').forEach(el => { el.textContent = c; el.dataset.count = c; });
  }
};

/* ---------- Đăng nhập / phân quyền ---------- */
const Auth = {
  user: null,
  profile: null,
  async load() {
    const { data: { session } } = await sb.auth.getSession();
    this.user = session?.user ?? null;
    this.profile = null;
    if (this.user) {
      const { data } = await sb
        .from('customers')
        .select('id, email, full_name, phone, address, role')
        .eq('id', this.user.id)
        .maybeSingle();
      this.profile = data || { id: this.user.id, email: this.user.email, full_name: '', role: 'customer' };
    }
    return this.profile;
  },
  homeFor(p) { return p?.role === 'admin' ? '../admin/index.html' : '../customer/index.html'; },
  async logout() {
    await sb.auth.signOut();
    location.href = '../home/index.html';
  },
  // Dùng ở trang cần đăng nhập. role: 'customer' | 'admin' | 'any'
  async require(role = 'any') {
    const p = await this.load();
    const here = location.pathname.split('/').filter(Boolean).slice(-2).join('/');
    if (!p) { location.replace('../login/index.html?next=' + encodeURIComponent(here)); return null; }
    if (role === 'admin' && p.role !== 'admin') { location.replace('../customer/index.html'); return null; }
    if (role === 'customer' && p.role === 'admin') { location.replace('../admin/index.html'); return null; }
    return p;
  }
};

/* ---------- Hoạ tiết sen (dùng ở tiêu đề mục, footer) ---------- */
const LOTUS_SVG = `<svg class="lotus" viewBox="0 0 48 28" aria-hidden="true"><g fill="currentColor">
  <path d="M24 2c3.6 4 5 8.6 4.2 13.4-.6 3.4-2.3 6-4.2 8-1.9-2-3.6-4.6-4.2-8C19 10.6 20.4 6 24 2Z"/>
  <path d="M10.5 8.5c5 .6 9 3.2 11.4 7.6 1 1.9 1.4 4 1.3 6.3-3.6-.4-7-1.9-9.4-4.6-2.2-2.5-3.3-5.6-3.3-9.3Z" opacity=".85"/>
  <path d="M37.5 8.5c-5 .6-9 3.2-11.4 7.6-1 1.9-1.4 4-1.3 6.3 3.6-.4 7-1.9 9.4-4.6 2.2-2.5 3.3-5.6 3.3-9.3Z" opacity=".85"/>
  <path d="M2 16c4.6-1 9 .2 12.4 3.4 1.2 1.1 2.1 2.4 2.8 3.9-3.6 1-7.3.6-10.4-1.4C4.8 20.6 3.2 18.6 2 16Z" opacity=".7"/>
  <path d="M46 16c-4.6-1-9 .2-12.4 3.4-1.2 1.1-2.1 2.4-2.8 3.9 3.6 1 7.3.6 10.4-1.4 2-1.3 3.6-3.3 4.8-5.9Z" opacity=".7"/>
  <path d="M8 25.5h32" stroke="currentColor" stroke-width="1.2" fill="none"/></g></svg>`;
/* Gắn hoa sen / mũi tên vào các chỗ đánh dấu data-lotus, data-chev trong HTML */
function decorate(root = document) {
  root.querySelectorAll('.ornament[data-lotus]').forEach(el => { el.removeAttribute('data-lotus'); el.querySelector('i')?.insertAdjacentHTML('afterend', LOTUS_SVG); });
  root.querySelectorAll('.title-lotus[data-lotus]').forEach(el => { el.removeAttribute('data-lotus'); el.insertAdjacentHTML('afterbegin', '<i></i>' + LOTUS_SVG); el.insertAdjacentHTML('beforeend', '<i></i>'); });
  root.querySelectorAll('[data-chev]').forEach(el => { el.outerHTML = icon('chevron'); });
}
/* Tiêu đề mục kiểu "✿ SẢN PHẨM BÁN CHẠY" */
function ornament() { return `<span class="ornament" aria-hidden="true"><i></i>${LOTUS_SVG}<i></i></span>`; }

/* Nội dung bài viết / mô tả: xuống dòng trống = đoạn mới, "## " = tiêu đề nhỏ, "- " = gạch đầu dòng */
function richText(text) {
  const blocks = String(text || '').replace(/\r/g, '').split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  return blocks.map(b => {
    const lines = b.split('\n');
    let html = '';
    let list = [];
    const flush = () => { if (list.length) { html += `<ul>${list.map(li => `<li>${inline(li)}</li>`).join('')}</ul>`; list = []; } };
    const para = [];
    lines.forEach(l => {
      if (/^##\s+/.test(l)) { flush(); if (para.length) { html += `<p>${para.map(inline).join('<br>')}</p>`; para.length = 0; } html += `<h3>${inline(l.replace(/^##\s+/, ''))}</h3>`; }
      else if (/^[-•]\s+/.test(l)) { if (para.length) { html += `<p>${para.map(inline).join('<br>')}</p>`; para.length = 0; } list.push(l.replace(/^[-•]\s+/, '')); }
      else { flush(); para.push(l); }
    });
    flush();
    if (para.length) html += `<p>${para.map(inline).join('<br>')}</p>`;
    return html;
  }).join('');
  function inline(s) { return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>'); }
}

const PRODUCT_CATEGORIES = { 'tram-cai': 'Trâm cài', 'vong-tram': 'Vòng trâm', 'cay-tram': 'Cây trâm' };
const POST_CATEGORIES = { 'van-hoa': 'Văn hoá Việt', 'thu-cong': 'Thủ công đất sét', 'lam-dep': 'Làm đẹp cùng Nếp', 'cam-hung': 'Cảm hứng từ Nếp' };
const collectionHref = id => `../tap-pham-chi-tiet/index.html?id=${encodeURIComponent(id)}`;
const productHref = id => `../product/index.html?id=${encodeURIComponent(id)}`;
const postHref = id => `../bai-viet/index.html?id=${encodeURIComponent(id)}`;
/* link lưu trong DB dạng "tram-cai/index.html" → thêm "../" để đi đúng chỗ */
const siteLink = l => !l ? '' : /^(https?:|mailto:|tel:|#|\.\.\/)/i.test(l) ? l : '../' + l.replace(/^\/+/, '');

/* ---------- Header / Footer ---------- */
const Layout = {
  async init(active = '') {
    this.renderHeader(active);
    this.renderFooter();
    decorate();
    Cart.updateBadge();
    observeReveal();
    this.bindScroll();
    const p = await Auth.load();
    this.renderAccount(p);
    return p;
  },

  renderHeader(active) {
    const el = document.getElementById('site-header');
    if (!el) return;
    const s = CFG.SITE;
    const left = [['home', 'Trang chủ', '../home/index.html'], ['tap-pham', 'Tập phẩm', '../tap-pham/index.html'], ['tram-cai', 'Trâm cài', '../tram-cai/index.html']];
    const right = [['ve-nep', 'Về Nếp', '../ve-nep/index.html'], ['goc-nep', 'Góc Nếp', '../goc-nep/index.html'], ['lien-he', 'Liên hệ', '#lien-he']];
    const link = ([k, t, h]) => `<a href="${h}" class="${k === active ? 'active' : ''}">${t}</a>`;
    const msgs = s.announcements || [s.tagline];
    el.outerHTML = `
      <div class="topbar">
        <div class="topbar-track">${[...msgs, ...msgs].map((m, i) => `<span ${i >= msgs.length ? 'aria-hidden="true" class="dup"' : ''}>${escapeHtml(m)}</span>`).join('')}</div>
      </div>
      <header class="site-header" id="siteHeader">
        <div class="container header-inner">
          <button class="icon-btn menu-toggle" id="menuToggle" aria-label="Mở menu" aria-expanded="false">${icon('menu')}</button>
          <nav class="main-nav nav-left" aria-label="Menu chính">${left.map(link).join('')}</nav>
          <a class="logo logo-img" href="../home/index.html" aria-label="${escapeHtml(s.name)} — Trang chủ">
            <img src="../assets/images/brand/logo-wordmark.png" alt="${escapeHtml(s.name)}" width="189" height="60">
          </a>
          <nav class="main-nav nav-right" aria-label="Menu phụ">${right.map(link).join('')}</nav>
          <div class="header-actions">
            <button class="icon-btn" type="button" id="searchToggle" aria-label="Tìm kiếm" aria-expanded="false">${icon('search')}</button>
            <div id="accountSlot"></div>
            <a class="icon-btn" href="../cart/index.html" aria-label="Giỏ hàng" title="Giỏ hàng">
              ${icon('bag')}<span class="badge" data-cart-count data-count="0">0</span>
            </a>
          </div>
        </div>
        <nav class="mobile-nav" id="mobileNav" aria-label="Menu">${[...left, ...right].map(link).join('')}</nav>
        <div class="search-panel" id="searchPanel">
          <form class="container search-form" id="searchForm" role="search">
            ${icon('search')}
            <input type="search" id="searchInput" name="q" placeholder="Tìm trâm cài, bộ sưu tập…" autocomplete="off" enterkeyhint="search" aria-label="Tìm kiếm">
            <button type="button" class="icon-btn" id="searchClose" aria-label="Đóng tìm kiếm">${icon('close')}</button>
          </form>
          <div class="container search-results" id="searchResults"></div>
        </div>
      </header>`;

    const header = document.getElementById('siteHeader');
    const toggle = document.getElementById('menuToggle');
    const setNav = open => {
      header.classList.toggle('nav-open', open);
      toggle.innerHTML = icon(open ? 'close' : 'menu');
      toggle.setAttribute('aria-expanded', open);
    };
    toggle.addEventListener('click', () => { setSearch(false); setNav(!header.classList.contains('nav-open')); });
    header.querySelectorAll('.mobile-nav a, .main-nav a').forEach(a => a.addEventListener('click', () => setNav(false)));

    // ---- Tìm kiếm ----
    const panel = document.getElementById('searchPanel');
    const input = document.getElementById('searchInput');
    const results = document.getElementById('searchResults');
    const setSearch = open => {
      header.classList.toggle('search-open', open);
      document.getElementById('searchToggle').setAttribute('aria-expanded', open);
      if (open) { setNav(false); setTimeout(() => input.focus(), 30); } else results.innerHTML = '';
    };
    document.getElementById('searchToggle').addEventListener('click', () => setSearch(!header.classList.contains('search-open')));
    document.getElementById('searchClose').addEventListener('click', () => setSearch(false));
    document.getElementById('searchForm').addEventListener('submit', e => {
      e.preventDefault();
      const q = input.value.trim();
      if (q) location.href = '../tram-cai/index.html?q=' + encodeURIComponent(q);
    });
    let t, last = '';
    input.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        const q = input.value.trim();
        if (q === last) return; last = q;
        if (q.length < 2) { results.innerHTML = ''; return; }
        const safe = q.replace(/[%_,()]/g, ' ');
        const { data } = await sb.from('products').select('id, name, price, image_path').or(`name.ilike.%${safe}%,sku.ilike.%${safe}%`).limit(5);
        if (input.value.trim() !== q) return;
        results.innerHTML = (data && data.length)
          ? data.map(p => `<a class="search-hit" href="${productHref(p.id)}"><img src="${imageUrl(p.image_path)}" alt=""><span>${escapeHtml(p.name)}</span><em>${formatVND(p.price)}</em></a>`).join('')
            + `<a class="search-all link-line" href="../tram-cai/index.html?q=${encodeURIComponent(q)}">Xem tất cả kết quả</a>`
          : `<p class="search-empty">Không tìm thấy sản phẩm cho “${escapeHtml(q)}”.</p>`;
      }, 220);
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (header.classList.contains('search-open')) setSearch(false);
      if (header.classList.contains('nav-open')) setNav(false);
    });
  },

  renderAccount(p) {
    const slot = document.getElementById('accountSlot');
    if (!slot) return;
    if (!p) {
      slot.innerHTML = `<a class="icon-btn" href="../login/index.html" aria-label="Đăng nhập" title="Đăng nhập">${icon('user')}</a>`;
      return;
    }
    const mainLink = p.role === 'admin'
      ? `<a href="../admin/index.html">Trang quản trị ${icon('arrow')}</a>`
      : `<a href="../customer/index.html">Tài khoản của tôi ${icon('arrow')}</a>`;
    slot.innerHTML = `
      <div class="account" id="account">
        <button class="avatar" type="button" aria-haspopup="true" aria-label="Tài khoản">${escapeHtml(initials(p.full_name, p.email))}</button>
        <div class="account-menu" role="menu">
          <div class="account-menu-inner">
            <div class="account-head">
              <strong>${escapeHtml(displayName(p))}</strong>
              <span>${escapeHtml(p.email)}</span>
            </div>
            ${mainLink}
            <a href="../cart/index.html">Giỏ hàng <span class="pill" data-cart-count>${Cart.count()}</span></a>
            <button class="logout" type="button" id="logoutBtn">Đăng xuất ${icon('logout')}</button>
          </div>
        </div>
      </div>`;
    const acc = document.getElementById('account');
    acc.querySelector('.avatar').addEventListener('click', e => { e.stopPropagation(); acc.classList.toggle('open'); });
    document.addEventListener('click', e => { if (!acc.contains(e.target)) acc.classList.remove('open'); });
    // Phím Esc: đóng ngay, không animation (thao tác bàn phím không nên chờ)
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !acc.matches('.open, :focus-within')) return;
      acc.classList.add('instant');
      acc.classList.remove('open');
      document.activeElement?.blur();
      requestAnimationFrame(() => requestAnimationFrame(() => acc.classList.remove('instant')));
    });
    document.getElementById('logoutBtn').addEventListener('click', () => Auth.logout());
  },

  renderFooter() {
    const el = document.getElementById('site-footer');
    if (!el) return;
    const s = CFG.SITE;
    const tel = s.phone.replace(/\s+/g, '');
    const social = [
      ['Facebook', s.facebook, 'facebook'], ['Instagram', s.instagram, 'instagram'],
      ['TikTok', s.tiktok, 'tiktok'], ['Zalo', s.zalo, 'zalo']
    ];
    el.outerHTML = `
      <section class="newsletter" id="lien-he" aria-labelledby="nlTitle">
        <div class="container newsletter-inner">
          <div class="nl-text">
            <span class="nl-lotus">${LOTUS_SVG}</span>
            <div>
              <h2 id="nlTitle">Nương ơi, cùng Nếp lưu giữ nếp Việt</h2>
              <p>Đăng ký nhận tin để không bỏ lỡ những bộ sưu tập mới nhất nhé!</p>
            </div>
          </div>
          <form class="nl-form" id="nlForm" novalidate>
            <input type="email" id="nlEmail" placeholder="Nhập email của bạn…" autocomplete="email" inputmode="email" aria-label="Email" required>
            <button class="btn" type="submit" id="nlBtn">Đăng ký</button>
          </form>
        </div>
      </section>
      <footer class="site-footer" id="site-footer">
        <svg class="footer-lotus-art" viewBox="0 0 220 200" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.1">
          <path d="M110 150c-14-20-16-48 0-78 16 30 14 58 0 78Z"/><path d="M110 150c-30-6-50-30-52-62 26 8 44 30 52 62Z"/><path d="M110 150c30-6 50-30 52-62-26 8-44 30-52 62Z"/>
          <path d="M110 150c-40 4-70-12-86-40 34-4 64 12 86 40Z"/><path d="M110 150c40 4 70-12 86-40-34-4-64 12-86 40Z"/>
          <path d="M110 150v48M80 196c10-14 22-22 30-22M140 196c-10-14-22-22-30-22"/><path d="M40 170c30-12 54-8 70 6M180 170c-30-12-54-8-70 6"/></g></svg>
        <div class="container">
          <div class="footer-grid">
            <div class="footer-brand">
              <a class="footer-logo" href="../home/index.html" aria-label="${escapeHtml(s.name)}">
                <img src="../assets/images/brand/logo-full-cream.png" alt="${escapeHtml(s.name)} — ${escapeHtml(s.tagline)}" width="220" height="184" loading="lazy">
              </a>
            </div>
            <div class="footer-col">
              ${ornament()}
              <h4>Chính sách</h4>
              <a href="../chinh-sach/index.html#mua-hang">Chính sách mua hàng</a>
              <a href="../chinh-sach/index.html#doi-tra">Chính sách đổi trả</a>
            </div>
            <div class="footer-col">
              ${ornament()}
              <h4>Hỗ trợ</h4>
              <a href="../chinh-sach/index.html#su-dung">Hướng dẫn sử dụng</a>
              <a href="../chinh-sach/index.html#bao-quan">Hướng dẫn bảo quản</a>
              <a href="../chinh-sach/index.html#thong-tin-lien-he">Liên hệ</a>
            </div>
            <div class="footer-col">
              ${ornament()}
              <h4>Kết nối với Nếp</h4>
              <div class="socials">
                ${social.map(([n, url, ic]) => `<a class="social" href="${escapeHtml(url)}" target="_blank" rel="noopener" aria-label="${n}" title="${n}">${socialIcon(ic)}</a>`).join('')}
              </div>
              <a class="contact-line" href="tel:${escapeHtml(tel)}">${icon('phone')}${escapeHtml(s.phone)}</a>
              <a class="contact-line" href="mailto:${escapeHtml(s.email)}">${icon('mail')}${escapeHtml(s.email)}</a>
            </div>
          </div>
          <div class="footer-divider" aria-hidden="true"><i></i>${LOTUS_SVG}<i></i></div>
          <div class="footer-bottom">
            <span>© ${new Date().getFullYear()} ${escapeHtml(s.legalName || s.name).toUpperCase()}. All rights reserved.</span>
            <span>${escapeHtml(s.tagline)}</span>
          </div>
        </div>
      </footer>`;

    // Đăng ký nhận tin
    document.getElementById('nlForm').addEventListener('submit', async e => {
      e.preventDefault();
      const inp = document.getElementById('nlEmail');
      const btn = document.getElementById('nlBtn');
      const email = inp.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Email chưa đúng định dạng', 'error'); inp.focus(); return; }
      btn.classList.add('loading');
      const { error } = await sb.from('subscribers').insert({ email });
      btn.classList.remove('loading');
      if (error && error.code !== '23505') { toast(viError(error), 'error'); return; }
      inp.value = '';
      flashButton(btn, error ? 'Đã đăng ký' : 'Cảm ơn Nương ✓', 2200);
      toast(error ? 'Email này đã đăng ký nhận tin rồi' : 'Đăng ký thành công! Nếp sẽ gửi tin mới cho bạn.', 'success');
    });
  },

  bindScroll() {
    const header = document.getElementById('siteHeader');
    if (!header) return;
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
};

/* Biểu tượng mạng xã hội (vẽ đơn giản, không dùng logo thương hiệu chính thức) */
function socialIcon(name) {
  const P = {
    facebook: '<path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21"/>',
    instagram: '<rect x="4" y="4" width="16" height="16" rx="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="16.8" cy="7.2" r="1"/>',
    tiktok: '<path d="M14.5 4h2.6c.2 1.8 1.4 3.1 3.2 3.3v2.6c-1.2 0-2.3-.4-3.2-1v5.9a5 5 0 1 1-5-5v2.7a2.3 2.3 0 1 0 2.4 2.3V4Z"/>',
    zalo: '<text x="12" y="15.2" text-anchor="middle" font-family="TeX Gyre Pagella, Palatino, serif" font-size="7.4" font-weight="700">Zalo</text>'
  };
  return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${P[name] || ''}</svg>`;
}

/* ---------- Scroll reveal ---------- */
let revealObserver = null;
const revealTargets = new Map(); // phần tử được theo dõi -> các phần tử cần hiện
function observeReveal(root = document) {
  const els = root.querySelectorAll('.reveal:not(.is-visible), .reveal-img:not(.is-visible)');
  if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('is-visible')); return; }
  revealObserver = revealObserver || new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      (revealTargets.get(en.target) || []).forEach(el => el.classList.add('is-visible'));
      revealTargets.delete(en.target);
      revealObserver.unobserve(en.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
  els.forEach(el => {
    // Ảnh .reveal-img đang bị clip-path che 100% → Chrome tính diện tích giao = 0 nên
    // không bao giờ báo "đã vào màn hình". Vì vậy theo dõi phần tử cha thay cho ảnh.
    const target = el.classList.contains('reveal-img') ? el.parentElement : el;
    if (!revealTargets.has(target)) { revealTargets.set(target, []); revealObserver.observe(target); }
    revealTargets.get(target).push(el);
  });
}

/* ---------- Thẻ sản phẩm ---------- */
function productCardHTML(p, i = 0) {
  const out = p.stock <= 0;
  const tag = out ? '<span class="product-tag soldout">Hết hàng</span>'
    : p.stock <= 3 ? '<span class="product-tag">Sắp hết</span>' : '';
  const href = `../product/index.html?id=${encodeURIComponent(p.id)}`;
  return `
    <article class="product-card reveal" style="--d:${i % 4}">
      <div class="product-media">
        <a href="${href}" aria-label="${escapeHtml(p.name)}">
          <img src="${imageUrl(p.image_path)}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
        </a>
        ${tag}
      </div>
      <a class="product-info" href="${href}">
        <h3>${escapeHtml(p.name)}</h3>
        <p class="price">${formatVND(p.price)}</p>
      </a>
      <div class="product-actions">
        <button class="btn btn-outline btn-sm" type="button" data-add="${escapeHtml(p.id)}" data-stock="${Number(p.stock) || 0}" ${out ? 'disabled' : ''}>
          ${out ? 'Hết hàng' : 'Thêm vào giỏ'}
        </button>
        <button class="btn btn-sm" type="button" data-buy="${escapeHtml(p.id)}" ${out ? 'disabled' : ''}>Mua ngay</button>
      </div>
    </article>`;
}

/* ---------- Thẻ bài viết (Góc Nếp) ---------- */
function postCardHTML(p, i = 0) {
  return `
    <a class="post-card reveal" style="--d:${i % 3}" href="${postHref(p.id)}">
      <div class="pc-media"><img src="${imageUrl(p.cover_path)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'"></div>
      <div class="pc-body">
        ${p.category ? `<span class="chip-tag">${escapeHtml(POST_CATEGORIES[p.category] || p.category)}</span>` : ''}
        <h3>${escapeHtml(p.title)}</h3>
        ${p.excerpt ? `<p>${escapeHtml(p.excerpt)}</p>` : ''}
        <span class="read-more">Đọc thêm ${icon('arrow')}</span>
      </div>
    </a>`;
}

/* ---------- Mua ngay: đi thẳng tới trang thanh toán với 1 sản phẩm, không đụng giỏ hàng ---------- */
const BUYNOW_KEY = 'nepcai_buynow';
function buyNow(id, qty = 1) {
  try { sessionStorage.setItem(BUYNOW_KEY, JSON.stringify({ id, qty })); } catch { /* bỏ qua */ }
  location.href = '../checkout/index.html?mode=buy';
}
function getBuyNow() {
  try { return JSON.parse(sessionStorage.getItem(BUYNOW_KEY)); } catch { return null; }
}
function clearBuyNow() {
  try { sessionStorage.removeItem(BUYNOW_KEY); } catch { /* bỏ qua */ }
}
function skeletonCards(n = 4) {
  return Array.from({ length: n }, () => '<div><div class="skeleton"></div><div class="skeleton skeleton-line"></div></div>').join('');
}
function renderProducts(el, list, error, emptyText = 'Chưa có sản phẩm nào. Hãy quay lại sau nhé!') {
  if (error) { el.innerHTML = `<p class="empty-state">Không tải được sản phẩm: ${escapeHtml(viError(error))}</p>`; return; }
  if (!list || !list.length) { el.innerHTML = `<p class="empty-state">${escapeHtml(emptyText)}</p>`; return; }
  el.innerHTML = list.map(productCardHTML).join('');
  observeReveal(el);
}

/* ---------- Phản hồi chuyển động ---------- */
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Đổi chữ trên nút với blur nhẹ (che khoảnh khắc 2 trạng thái chồng nhau) rồi trả lại */
function flashButton(btn, text, ms = 1400) {
  let label = btn.querySelector('.btn-label');
  if (!label) {
    label = document.createElement('span');
    label.className = 'btn-label';
    label.textContent = btn.textContent.trim();
    btn.textContent = '';
    btn.appendChild(label);
  }
  const original = btn.dataset.label || (btn.dataset.label = label.textContent);
  const swap = t => {
    label.classList.add('swapping');
    setTimeout(() => { label.textContent = t; label.classList.remove('swapping'); }, 120);
  };
  clearTimeout(btn._flashT);
  swap(text);
  btn._flashT = setTimeout(() => swap(original), ms);
}

/* Icon giỏ hàng "nảy" nhẹ — dùng WAAPI để chạy trên GPU và ngắt được giữa chừng */
function bumpCart() {
  if (reduceMotion()) return;
  document.querySelectorAll('.header-actions a[href*="cart"]').forEach(el => {
    el.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
      { duration: 360, easing: 'cubic-bezier(.23, 1, .32, 1)' }
    );
  });
}

/* Nút "Thêm vào giỏ" trên mọi thẻ sản phẩm */
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-add]');
  if (!btn) return;
  e.preventDefault();
  const ok = Cart.add(btn.dataset.add, 1, Number(btn.dataset.stock) || 0);
  if (ok) { flashButton(btn, 'Đã thêm ✓'); bumpCart(); }
  else toast('Số lượng trong giỏ đã bằng số hàng còn lại', 'error');
});

/* Nút "Mua ngay" trên mọi thẻ sản phẩm */
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-buy]');
  if (!btn) return;
  e.preventDefault();
  buyNow(btn.dataset.buy, 1);
});

/* Đồng bộ giỏ hàng giữa nhiều tab */
window.addEventListener('storage', e => { if (e.key === CART_KEY) Cart.updateBadge(); });
