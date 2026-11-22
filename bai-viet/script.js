/* =========================================================
   CHI TIẾT BÀI VIẾT: ../bai-viet/index.html?id=<số>
   Dùng chung cho Về Nếp và Góc Nếp.
   ========================================================= */
(async () => {
  const id = Number(new URLSearchParams(location.search).get('id'));
  const main = document.getElementById('article');
  const { data: p } = id ? await sb.from('posts').select('*').eq('id', id).maybeSingle() : { data: null };
  const sec = p?.section === 've-nep' ? 've-nep' : 'goc-nep';
  await Layout.init(sec);
  if (!p) {
    main.innerHTML = `<div class="container not-found"><h1>Không tìm thấy bài viết</h1><a class="btn" href="../goc-nep/index.html">Về Góc Nếp</a></div>`;
    return;
  }
  const secName = sec === 've-nep' ? 'Về Nếp' : 'Góc Nếp';
  const secHref = `../${sec}/index.html`;
  document.title = `${p.title} | Nếp Cài`;
  main.innerHTML = `
    <div class="container narrow">
      <nav class="crumbs"><a href="../home/index.html">Trang chủ</a>${icon('chevron')}<a href="${secHref}">${secName}</a>${icon('chevron')}<span>${escapeHtml(p.title)}</span></nav>
      <header class="art-head">
        ${p.category ? `<a class="chip-tag" href="../goc-nep/index.html?cat=${p.category}">${escapeHtml(POST_CATEGORIES[p.category] || '')}</a>` : ''}
        <h1>${escapeHtml(p.title)}</h1>
        ${p.excerpt ? `<p class="lead">${escapeHtml(p.excerpt)}</p>` : ''}
        <time datetime="${p.published_at}">${formatDate(p.published_at)}</time>
      </header>
      ${p.cover_path ? `<figure class="art-cover"><img src="${imageUrl(p.cover_path)}" alt="${escapeHtml(p.title)}" onerror="this.parentNode.remove()"></figure>` : ''}
      <div class="prose art-body">${richText(p.content || '')}</div>
      <div class="art-end"><span class="ornament" data-lotus><i></i><i></i></span></div>
      <div class="art-back">
        <a class="read-more" href="${secHref}">${icon('chevronLeft')} Quay lại ${secName}</a>
        <a class="btn btn-sm" href="../tram-cai/index.html">Xem trâm cài</a>
      </div>
    </div>
    <section class="related-posts" id="relatedPosts" hidden>
      <div class="container">
        <div class="title-lotus" data-lotus><h2>Bài viết khác</h2></div>
        <div class="related-grid" id="relatedGrid"></div>
      </div>
    </section>`;
  decorate(main);

  // Bài liên quan: cùng chủ đề trước, rồi bài mới nhất cùng mục
  let q = sb.from('posts').select('id, title, excerpt, category, cover_path, published_at').eq('section', p.section)
    .eq('is_published', true).neq('id', p.id).order('published_at', { ascending: false }).limit(12);
  const { data: others } = await q;
  const list = (others || []).sort((a, b) => (b.category === p.category) - (a.category === p.category)).slice(0, 3);
  if (list.length) {
    document.getElementById('relatedGrid').innerHTML = list.map((x, i) => postCardHTML(x, i)).join('');
    document.getElementById('relatedPosts').hidden = false;
    observeReveal(document.getElementById('relatedPosts'));
  }
})();
