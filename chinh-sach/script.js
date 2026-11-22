/* Chính sách & Hỗ trợ: điền thông tin liên hệ từ config + đánh dấu mục đang xem */
(async () => {
  await Layout.init('');
  document.querySelector('.page-hero .lotus').outerHTML = LOTUS_SVG;
  const s = CFG.SITE;
  const card = (ic, label, text, href, svg) => `<a class="contact-card" href="${escapeHtml(href)}" ${/^https?:/.test(href) ? 'target="_blank" rel="noopener"' : ''}>${svg || icon(ic)}<span><small>${label}</small>${escapeHtml(text)}</span></a>`;
  document.getElementById('contactCards').innerHTML = [
    card('phone', 'Hotline', s.phone, 'tel:' + s.phone.replace(/\s+/g, '')),
    card('mail', 'Email', s.email, 'mailto:' + s.email),
    card('', 'Zalo', s.phone, s.zalo, socialIcon('zalo')),
    card('', 'Facebook', 'Nếp Cài', s.facebook, socialIcon('facebook'))
  ].join('');

  // Đánh dấu mục lục theo vị trí cuộn
  const links = [...document.querySelectorAll('.policy-nav a')];
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) links.forEach(a => a.classList.toggle('active', a.hash === '#' + en.target.id));
  }), { rootMargin: '-40% 0px -55% 0px' });
  document.querySelectorAll('.policy-body section').forEach(sec => io.observe(sec));
})();
