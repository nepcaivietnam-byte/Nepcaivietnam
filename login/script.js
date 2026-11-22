/* Đăng nhập: admin -> trang admin, khách hàng -> trang khách hàng */
const params = new URLSearchParams(location.search);
// Chỉ cho phép quay lại các trang nội bộ dạng "ten-folder/index.html"
const nextRaw = params.get('next') || '';
const next = /^[a-z-]+\/index\.html$/.test(nextRaw) ? '../' + nextRaw : null;

document.getElementById('brandLogo').innerHTML =
  `<img src="../assets/images/brand/logo-wordmark-cream.png" alt="${escapeHtml(CFG.SITE.name)}" width="189" height="60">`;
if (nextRaw) document.getElementById('registerLink').href += '?next=' + encodeURIComponent(nextRaw);

function goByRole(p) {
  if (p?.role === 'admin') location.replace('../admin/index.html');
  else location.replace(next && next !== '../admin/index.html' ? next : '../customer/index.html');
}

// Đã đăng nhập rồi thì chuyển luôn
Auth.load().then(p => { if (p) goByRole(p); });

document.getElementById('pwToggle').addEventListener('click', e => {
  const pw = document.getElementById('password');
  const show = pw.type === 'password';
  pw.type = show ? 'text' : 'password';
  e.currentTarget.textContent = show ? 'Ẩn' : 'Hiện';
});

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const msg = document.getElementById('msg');
  const btn = document.getElementById('submitBtn');
  msg.className = 'form-msg'; msg.textContent = '';

  if (!email || !password) {
    msg.className = 'form-msg error';
    msg.textContent = 'Vui lòng nhập Gmail và mật khẩu.';
    return;
  }

  btn.classList.add('loading');
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    btn.classList.remove('loading');
    msg.className = 'form-msg error';
    msg.textContent = viError(error);
    return;
  }

  const p = await Auth.load();
  msg.className = 'form-msg success';
  msg.textContent = `Xin chào ${displayName(p)}!`;
  setTimeout(() => goByRole(p), 400);
});
