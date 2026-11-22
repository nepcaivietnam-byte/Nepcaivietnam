/* =========================================================
   VỀ NẾP — toàn bộ bài viết mục "Về Nếp" (admin đăng ở Blog → Về Nếp),
   xếp theo thứ tự admin đặt, ảnh/chữ xen kẽ trái–phải.
   ========================================================= */
(async () => {
  await Layout.init('ve-nep');
  const box = document.getElementById('stories');
  const { data, error } = await sb.from('posts').select('id, title, excerpt, content, cover_path')
    .eq('section', 've-nep').eq('is_published', true).order('sort_order').order('published_at');
  if (error || !data?.length) {
    box.innerHTML = `<div class="container"><p class="empty-state">${error ? escapeHtml(viError(error)) : 'Câu chuyện của Nếp đang được viết — hẹn Nương sớm nhé.'}</p></div>`;
    return;
  }
  box.innerHTML = `<div class="container">${data.map(p => `
    <article class="story" id="bai-${p.id}">
      <div class="story-media reveal-img"><img src="${imageUrl(p.cover_path)}" alt="${escapeHtml(p.title)}" loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'"></div>
      <div class="story-text reveal">
        <span class="ornament" data-lotus><i></i><i></i></span>
        <h2>${escapeHtml(p.title)}</h2>
        ${p.excerpt ? `<p class="lead">${escapeHtml(p.excerpt)}</p>` : ''}
        <div class="prose">${richText(p.content || '')}</div>
      </div>
    </article>`).join('')}</div>`;
  decorate(box);
  observeReveal(box);
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
})();
