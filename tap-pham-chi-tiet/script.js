/* CHI TIẾT TẬP PHẨM: ?id=<uuid> — ý nghĩa bộ sưu tập + ý nghĩa từng sản phẩm */
(async () => {
  await Layout.init('tap-pham');
  const id = new URLSearchParams(location.search).get('id');
  const page = document.getElementById('page');
  const notFound = () => {
    page.innerHTML = `<div class="container not-found"><h1>Không tìm thấy tập phẩm</h1><a class="btn" href="../tap-pham/index.html">Xem tất cả tập phẩm</a></div>`;
  };
  if (!id) return notFound();
  const { data: c } = await sb.from('collections').select('*').eq('id', id).maybeSingle();
  if (!c) return notFound();
  document.title = `${c.name} | Nếp Cài`;

  const { data: prods } = await sb.from('products')
    .select('id, sku, name, image_path, price, stock, tagline, description, created_at')
    .eq('collection_id', id).order('created_at');
  const img = imageUrl(c.image_path);

  page.innerHTML = `
    <section class="page-hero col-hero" style="background-image:url('${img}')">
      <div class="container">
        <div class="page-hero-text">
          <span class="ornament" data-lotus><i></i><i></i></span>
          <p class="eyebrow">BỘ SƯU TẬP</p>
          <h1>${escapeHtml(c.name).replace(/,\s*/, ',<br>')}</h1>
          ${c.tagline ? `<p>${escapeHtml(c.tagline)}</p>` : ''}
        </div>
      </div>
    </section>
    <div class="container"><nav class="crumbs" aria-label="Đường dẫn">
      <a href="../home/index.html">Trang chủ</a>${icon('chevron')}<a href="../tap-pham/index.html">Tập phẩm</a>${icon('chevron')}<span>${escapeHtml(c.name)}</span>
    </nav></div>

    <section class="meaning">
      <div class="meaning-media reveal"><img class="reveal-img" src="${img}" alt="${escapeHtml(c.name)}"></div>
      <div class="meaning-text reveal" style="--d:1">
        <div class="title-lotus" data-lotus><h2>Ý nghĩa bộ sưu tập</h2></div>
        <div class="prose">${richText(c.description || c.tagline || '')}</div>
        ${c.quote ? `<p class="quote">${escapeHtml(c.quote)}</p>` : ''}
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="title-lotus reveal" data-lotus><h2>Ý nghĩa từng sản phẩm</h2></div>
        <div class="item-grid" id="items"></div>
      </div>
    </section>

    <section class="cta-band" style="background-image:url('${img}')">
      <div class="container">
        <div class="cta-box reveal">
          <span class="ornament" data-lotus><i></i><i></i></span>
          <p class="q">“${escapeHtml(c.name)}”</p>
          <p>Gửi trọn nét Việt trong từng khoảnh khắc của Nương.</p>
          <a class="btn" href="../tram-cai/index.html?collection=${encodeURIComponent(c.id)}">Khám phá ngay</a>
        </div>
      </div>
    </section>`;
  decorate(page);

  const items = document.getElementById('items');
  if (!prods?.length) {
    items.outerHTML = '<p class="empty-state">Sản phẩm của bộ sưu tập đang được hoàn thiện — hẹn Nương sớm nhé!</p>';
  } else {
    items.innerHTML = prods.map((p, i) => {
      const out = p.stock <= 0;
      const desc = p.description ? p.description.split(/\n{2,}/)[0] : '';
      return `
        <article class="item reveal" style="--d:${i % 2}">
          <a class="item-media" href="${productHref(p.id)}"><img src="${imageUrl(p.image_path)}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'"></a>
          <div>
            <h3><a href="${productHref(p.id)}">${escapeHtml(p.name)}</a></h3>
            ${p.tagline ? `<p class="tag">${escapeHtml(p.tagline)}</p>` : ''}
            <p class="price">${formatVND(p.price)}</p>
            ${desc ? `<p class="desc">${escapeHtml(desc)}</p>` : ''}
            <div class="acts">
              <button class="btn btn-outline" type="button" data-add="${escapeHtml(p.id)}" data-stock="${Number(p.stock) || 0}" ${out ? 'disabled' : ''}>${out ? 'Hết hàng' : 'Thêm vào giỏ'}</button>
              <button class="btn" type="button" data-buy="${escapeHtml(p.id)}" ${out ? 'disabled' : ''}>Mua ngay</button>
            </div>
          </div>
        </article>`;
    }).join('');
  }
  observeReveal(page);
})();
