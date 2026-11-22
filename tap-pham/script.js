/* TẬP PHẨM: mỗi bộ sưu tập = ảnh lớn + giới thiệu + 4 sản phẩm */
(async () => {
  await Layout.init('tap-pham');
  const box = document.getElementById('collections');
  box.innerHTML = `<div class="container" style="padding:60px 0">${'<div class="skeleton" style="aspect-ratio:auto;height:280px;margin-bottom:24px"></div>'.repeat(2)}</div>`;

  const { data: cols, error } = await sb.from('collections').select('id, name, tagline, description, image_path').order('sort_order').order('created_at');
  if (error || !cols?.length) {
    box.innerHTML = `<div class="container" style="padding:80px 0"><p class="empty-state">${error ? escapeHtml(viError(error)) : 'Các tập phẩm đang được chuẩn bị — hẹn Nương sớm nhé!'}</p></div>`;
    return;
  }
  const { data: prods } = await sb.from('products').select('id, sku, name, image_path, price, stock, collection_id, created_at')
    .in('collection_id', cols.map(c => c.id)).order('created_at', { ascending: false });

  box.innerHTML = cols.map(c => {
    const first = (c.description || '').split(/\n{2,}/)[0];
    return `
      <section class="col-block" id="c-${c.id}">
        <div class="container">
          <div class="col-intro">
            <a class="col-media reveal" href="${collectionHref(c.id)}"><img class="reveal-img" src="${imageUrl(c.image_path)}" alt="${escapeHtml(c.name)}" loading="lazy"></a>
            <div class="col-text reveal" style="--d:1">
              <span class="ornament" data-lotus><i></i><i></i></span>
              <h2>${escapeHtml(c.name)}</h2>
              ${c.tagline ? `<p class="tag">${escapeHtml(c.tagline)}</p>` : ''}
              ${first ? `<p class="desc">${escapeHtml(first)}</p>` : ''}
              <a class="read-more" href="${collectionHref(c.id)}">Khám phá bộ sưu tập ${icon('chevron')}</a>
            </div>
          </div>
          <div class="product-grid col-products" data-col="${c.id}"></div>
        </div>
      </section>`;
  }).join('');
  decorate(box);
  cols.forEach(c => {
    const el = box.querySelector(`[data-col="${c.id}"]`);
    const list = (prods || []).filter(p => p.collection_id === c.id).slice(0, 4);
    if (list.length) renderProducts(el, list);
    else el.outerHTML = '<p class="col-empty">Sản phẩm của bộ sưu tập đang được hoàn thiện.</p>';
  });
  observeReveal(box);
})();
