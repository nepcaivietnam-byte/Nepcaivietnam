/* Đăng ký khách hàng mới. Trigger handle_new_user trong Supabase tự tạo dòng ở bảng customers. */
const params = new URLSearchParams(location.search);
const nextRaw = params.get('next') || '';
const next = /^[a-z-]+\/index\.html$/.test(nextRaw) && nextRaw !== 'admin/index.html' ? '../' + nextRaw : '../customer/index.html';

document.getElementById('brandLogo').innerHTML =
  `<img src="../assets/images/brand/logo-wordmark-cream.png" alt="${escapeHtml(CFG.SITE.name)}" width="189" height="60">`;
if (nextRaw) document.getElementById('loginLink').href += '?next=' + encodeURIComponent(nextRaw);

Auth.load().then(p => { if (p) location.replace(Auth.homeFor(p)); });

document.getElementById('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const val = id => document.getElementById(id).value.trim();
  const full_name = val('fullName');
  const email = val('email');
  const password = document.getElementById('password').value;
  const password2 = document.getElementById('password2').value;
  const phone = val('phone');
  const address = val('address');
  const msg = document.getElementById('msg');
  const btn = document.getElementById('submitBtn');
  const fail = t => { msg.className = 'form-msg error'; msg.textContent = t; };
  msg.className = 'form-msg'; msg.textContent = '';

  if (!full_name) return fail('Vui lòng nhập họ và tên.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Gmail không hợp lệ.');
  if (password.length < 6) return fail('Mật khẩu phải có ít nhất 6 ký tự.');
  if (password !== password2) return fail('Hai mật khẩu không khớp.');
  if (phone && !/^[0-9+\s.-]{8,15}$/.test(phone)) return fail('Số điện thoại không hợp lệ.');

  btn.classList.add('loading');
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { full_name, phone, address },
      emailRedirectTo: location.origin + location.pathname.replace(/register\/.*$/, 'login/index.html')
    }
  });
  btn.classList.remove('loading');

  if (error) return fail(viError(error));

  // Supabase trả về user nhưng identities rỗng khi email đã tồn tại
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return fail('Email này đã được đăng ký.');
  }

  if (data.session) {
    msg.className = 'form-msg success';
    msg.textContent = 'Tạo tài khoản thành công! Đang chuyển trang…';
    setTimeout(() => location.replace(next), 700);
  } else {
    // Project đang bật xác nhận email
    msg.className = 'form-msg success';
    msg.textContent = 'Đăng ký thành công! Vui lòng mở Gmail và bấm link xác nhận, sau đó đăng nhập.';
    e.target.reset();
  }
});
