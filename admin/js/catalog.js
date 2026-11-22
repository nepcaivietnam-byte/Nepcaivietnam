/* =========================================================
   ADMIN · SẢN PHẨM — Bộ sưu tập · Sản phẩm (ảnh chính + thư viện ảnh) · Tồn kho
   ========================================================= */
VIEWS.collections = { title: 'Bộ sưu tập', eyebrow: 'Sản phẩm', el: 'collections', load: loadCollections };
VIEWS.products = { title: 'Sản phẩm', eyebrow: 'Sản phẩm', el: 'products', load: loadProducts };
VIEWS.stock = { title: 'Tồn kho', eyebrow: 'Sản phẩm', el: 'stock', load: loadStock };

let products = [];
const PRODUCT_COLS = 'id, sku, name, image_path, price, stock, created_at, collection_id, category, is_featured, tagline, description, material, usage, care';

/* =========================== BỘ SƯU TẬP =========================== */
let editingCol = null, colDz = null;

function setupCollections() {
  colDz = dropzone('cfImage', $('cfMsg'));
  $('addCollectionBtn').onclick = () => openCollectionModal(null);
  $('collectionForm').addEventListener('submit', saveCollection);
  $('colGrid').addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]');
    if (ed) openCollectionModal(collections.find(c => c.id === ed.dataset.edit));
    if (dl) deleteCollection(collections.find(c => c.id === dl.dataset.del));
  });
}

async function loadCollections() {
  const grid = $('colGrid');
  grid.innerHTML = '<div class="col-card card"><div class="sk" style="height:180px"></div></div>'.repeat(3);
  const [, pr] = await Promise.all([loadCollectionList(), sb.from('products').select('collection_id')]);
  const count = id => (pr.data || []).filter(p => p.collection_id === id).length;
  if (!collections.length) {
    grid.innerHTML = `<div class="empty-card card"><p>Chưa có bộ sưu tập nào.</p><button class="btn" onclick="openCollectionModal(null)">+ Tạo bộ sưu tập đầu tiên</button></div>`;
    return;
  }
  grid.innerHTML = collections.map((c, i) => `
    <article class="col-card card" style="animation-delay:${i * 40}ms">
      <div class="cc-media"><img src="${imageUrl(c.image_path)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
        ${c.is_featured ? '<span class="cc-flag">Nổi bật</span>' : ''}</div>
      <div class="cc-body">
        <h3>${escapeHtml(c.name)}</h3>
        ${c.tagline ? `<p>${escapeHtml(c.tagline)}</p>` : ''}
        <div class="cc-meta"><span>${count(c.id)} sản phẩm</span><span>Thứ tự: ${c.sort_order}</span></div>
      </div>
      <div class="cc-actions">
        <a class="icon-action" href="../tap-pham-chi-tiet/index.html?id=${c.id}" target="_blank" rel="noopener" title="Xem trên web">↗</a>
        <button class="icon-action" data-edit="${c.id}" title="Sửa">${EDIT_SVG}</button>
        <button class="icon-action del" data-del="${c.id}" title="Xoá">${icon('trash')}</button>
      </div>
    </article>`).join('');
}

function openCollectionModal(c) {
  editingCol = c || null;
  $('collectionForm').reset();
  $('cfTitle').textContent = c ? 'Sửa bộ sưu tập' : 'Tạo bộ sưu tập';
  $('cfName').value = c?.name || '';
  $('cfTagline').value = c?.tagline || '';
  $('cfDesc').value = c?.description || '';
  $('cfQuote').value = c?.quote || '';
  $('cfSort').value = c?.sort_order ?? (collections.length ? Math.max(...collections.map(x => x.sort_order)) + 1 : 1);
  $('cfFeatured').checked = c ? c.is_featured : true;
  colDz.reset(c ? imageUrl(c.image_path) : null);
  openModal($('collectionModal'));
  setTimeout(() => $('cfName').focus(), 50);
}

async function saveCollection(e) {
  e.preventDefault();
  const msg = $('cfMsg'), btn = $('cfSave');
  const name = $('cfName').value.trim();
  if (!name) return formFail(msg, 'Vui lòng nhập tên bộ sưu tập.');
  if (!editingCol && !colDz.file) return formFail(msg, 'Vui lòng chọn hình cho bộ sưu tập.');
  btn.classList.add('loading');
  let newPath = null;
  try {
    if (colDz.file) newPath = await uploadImage(colDz.file, 'collections');
    const payload = {
      name, tagline: $('cfTagline').value.trim() || null, description: $('cfDesc').value.trim() || null,
      quote: $('cfQuote').value.trim() || null, sort_order: Number($('cfSort').value) || 0, is_featured: $('cfFeatured').checked
    };
    if (newPath) payload.image_path = newPath;
    const { error } = editingCol
      ? await sb.from('collections').update(payload).eq('id', editingCol.id)
      : await sb.from('collections').insert(payload);
    if (error) throw new Error(error.code === '23505' ? `Đã có bộ sưu tập tên “${name}”.` : viError(error));
    if (editingCol && newPath) await removeImages([editingCol.image_path]);
    closeModal($('collectionModal'));
    toast(editingCol ? 'Đã cập nhật bộ sưu tập' : 'Đã tạo bộ sưu tập', 'success');
    loadCollections();
  } catch (err) {
    if (newPath) await removeImages([newPath]);
    formFail(msg, err.message);
  } finally { btn.classList.remove('loading'); }
}

function deleteCollection(c) {
  if (!c) return;
  askConfirm({
    title: 'Xoá bộ sưu tập?',
    html: `Bộ sưu tập <strong>${escapeHtml(c.name)}</strong> sẽ bị xoá. Các sản phẩm thuộc bộ sưu tập này <strong>không bị xoá</strong> nhưng sẽ chưa có bộ sưu tập — hãy gán lại cho chúng.`,
    action: async () => {
      const { error } = await sb.from('collections').delete().eq('id', c.id);
      if (error) { toast(viError(error), 'error'); return; }
      await removeImages([c.image_path]);
      toast('Đã xoá bộ sưu tập', 'success');
      loadCollections();
    }
  });
}

/* =========================== SẢN PHẨM =========================== */
let editingProd = null, prodDz = null;
let gallery = [];        // [{ id?, path?, file?, url }]
let galleryRemoved = []; // [{ id, path }]

function setupProducts() {
  prodDz = dropzone('pfImage', $('pfMsg'));
  $('addProductBtn').onclick = () => openProductModal(null);
  $('productForm').addEventListener('submit', saveProduct);
  $('prodSearch').addEventListener('input', () => renderProductTable(false));
  $('prodColFilter').addEventListener('change', () => renderProductTable(false));
  $('prodBody').addEventListener('click', async e => {
    const ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]'), st = e.target.closest('[data-star]');
    if (ed) openProductModal(products.find(p => p.id === ed.dataset.edit));
    if (dl) deleteProduct(products.find(p => p.id === dl.dataset.del));
    if (st) {
      const p = products.find(x => x.id === st.dataset.star);
      const val = !p.is_featured;
      st.classList.toggle('on', val); st.setAttribute('aria-pressed', val);
      const { error } = await sb.from('products').update({ is_featured: val }).eq('id', p.id);
      if (error) { st.classList.toggle('on', !val); toast(viError(error), 'error'); return; }
      p.is_featured = val;
      toast(val ? `“${p.name}” đã vào mục Trâm cài nổi bật` : `Đã bỏ “${p.name}” khỏi mục nổi bật`, 'success');
    }
  });

  // Thư viện ảnh phụ
  $('pfGallery').addEventListener('click', e => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    const i = Number(b.dataset.i);
    if (b.dataset.g === 'del') { const [g] = gallery.splice(i, 1); if (g.id) galleryRemoved.push(g); }
    if (b.dataset.g === 'left' && i > 0) [gallery[i - 1], gallery[i]] = [gallery[i], gallery[i - 1]];
    if (b.dataset.g === 'right' && i < gallery.length - 1) [gallery[i + 1], gallery[i]] = [gallery[i], gallery[i + 1]];
    renderGallery();
  });
  $('pfGallery').addEventListener('change', e => {
    if (e.target.id !== 'pfGalleryInput') return;
    for (const f of e.target.files) {
      const bad = checkImage(f);
      if (bad) { formFail($('pfMsg'), bad); continue; }
      gallery.push({ file: f, url: URL.createObjectURL(f) });
    }
    renderGallery();
  });
}

async function loadProducts() {
  $('prodBody').innerHTML = rowSkeleton(8);
  const [, res] = await Promise.all([loadCollectionList(), sb.from('products').select(PRODUCT_COLS).order('created_at', { ascending: false })]);
  if (res.error) { $('prodBody').innerHTML = emptyRow(8, escapeHtml(viError(res.error))); return; }
  products = res.data || [];
  const sel = $('prodColFilter'), cur = sel.value;
  sel.innerHTML = '<option value="">Tất cả bộ sưu tập</option>' + collections.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('') +
    '<option value="none">— Chưa có bộ sưu tập</option>';
  sel.value = cur;
  renderProductTable(true);
}

function renderProductTable(intro) {
  const q = norm($('prodSearch').value.trim());
  const cf = $('prodColFilter').value;
  const list = products.filter(p => (!q || norm(p.name).includes(q) || norm(p.sku).includes(q)) &&
    (!cf || (cf === 'none' ? !p.collection_id : p.collection_id === cf)));
  const body = $('prodBody');
  body.classList.toggle('intro', intro);
  if (!list.length) { body.innerHTML = emptyRow(8, products.length ? 'Không tìm thấy sản phẩm.' : 'Chưa có sản phẩm — bấm “Thêm sản phẩm” để bắt đầu.'); return; }
  body.innerHTML = list.map((p, i) => `
    <tr style="animation-delay:${Math.min(i, 8) * 30}ms">
      <td><img class="thumb" src="${imageUrl(p.image_path)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'"></td>
      <td><span class="pname">${escapeHtml(p.name)}</span><br><span class="sku">${escapeHtml(p.sku)}</span></td>
      <td>${p.collection_id ? escapeHtml(colName(p.collection_id)) : '<span class="warn-text">Chưa gán</span>'}</td>
      <td>${escapeHtml(PRODUCT_CATEGORIES[p.category] || '')}</td>
      <td><button class="star ${p.is_featured ? 'on' : ''}" data-star="${p.id}" aria-pressed="${p.is_featured}" title="Bật/tắt nổi bật">★</button></td>
      <td class="num">${formatVND(p.price)}</td>
      <td class="num"><span class="stock-pill ${p.stock <= 0 ? 'out' : p.stock <= 3 ? 'low' : ''}">${p.stock}</span></td>
      <td class="actions">
        <a class="icon-action" href="../product/index.html?id=${p.id}" target="_blank" rel="noopener" title="Xem trên web">↗</a>
        <button class="icon-action" data-edit="${p.id}" title="Sửa">${EDIT_SVG}</button>
        <button class="icon-action del" data-del="${p.id}" title="Xoá">${icon('trash')}</button>
      </td>
    </tr>`).join('');
}

async function openProductModal(p) {
  if (!collections.length) await loadCollectionList();
  editingProd = p || null;
  gallery = []; galleryRemoved = [];
  $('productForm').reset();
  $('pfTitle').textContent = p ? 'Sửa sản phẩm' : 'Thêm sản phẩm';
  $('pfCollection').innerHTML = '<option value="">— Chọn bộ sưu tập —</option>' +
    collections.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  const set = (id, v) => { $(id).value = v ?? ''; };
  set('pfSku', p?.sku); set('pfName', p?.name); set('pfPrice', p?.price); set('pfStock', p?.stock);
  set('pfCollection', p?.collection_id || ($('prodColFilter').value !== 'none' ? $('prodColFilter').value : ''));
  set('pfCategory', p?.category || 'tram-cai'); set('pfTagline', p?.tagline);
  set('pfDesc', p?.description); set('pfMaterial', p?.material); set('pfUsage', p?.usage); set('pfCare', p?.care);
  $('pfFeatured').checked = !!p?.is_featured;
  document.querySelector('#productModal .mini-tabs [data-pt="pfDesc"]').click();
  prodDz.reset(p?.image_path ? imageUrl(p.image_path) : null);
  renderGallery();
  openModal($('productModal'));
  if (!collections.length) formFail($('pfMsg'), 'Chưa có bộ sưu tập nào — hãy tạo bộ sưu tập trước (mục Sản phẩm → Bộ sưu tập).');
  if (p) {
    const { data } = await sb.from('product_images').select('id, image_path').eq('product_id', p.id).order('sort_order').order('id');
    gallery = (data || []).map(g => ({ id: g.id, path: g.image_path, url: imageUrl(g.image_path) }));
    renderGallery();
  }
  setTimeout(() => $('pfSku').focus(), 50);
}

function renderGallery() {
  $('pfGallery').innerHTML = gallery.map((g, i) => `
    <figure class="g-item">
      <img src="${g.url}" alt="">
      ${g.file ? '<span class="g-new">Mới</span>' : ''}
      <div class="g-bar">
        <button type="button" data-g="left" data-i="${i}" aria-label="Sang trái" ${i === 0 ? 'disabled' : ''}>←</button>
        <button type="button" data-g="del" data-i="${i}" aria-label="Bỏ ảnh">×</button>
        <button type="button" data-g="right" data-i="${i}" aria-label="Sang phải" ${i === gallery.length - 1 ? 'disabled' : ''}>→</button>
      </div>
    </figure>`).join('') + `
    <label class="g-add" title="Thêm ảnh phụ">
      <input type="file" id="pfGalleryInput" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden>
      <span>+</span><small>Thêm ảnh</small>
    </label>`;
}

async function saveProduct(e) {
  e.preventDefault();
  const msg = $('pfMsg'), btn = $('pfSave');
  const sku = $('pfSku').value.trim().toUpperCase();
  const name = $('pfName').value.trim();
  const price = Number($('pfPrice').value), stock = Number($('pfStock').value);
  const collection_id = $('pfCollection').value;
  msg.textContent = '';
  if (!sku) return formFail(msg, 'Vui lòng nhập mã sản phẩm.');
  if (!name) return formFail(msg, 'Vui lòng nhập tên sản phẩm.');
  if (!collection_id) return formFail(msg, 'Vui lòng chọn bộ sưu tập cho sản phẩm.');
  if ($('pfPrice').value === '' || !Number.isFinite(price) || price < 0) return formFail(msg, 'Giá không hợp lệ.');
  if ($('pfStock').value === '' || !Number.isInteger(stock) || stock < 0) return formFail(msg, 'Số lượng phải là số nguyên ≥ 0.');
  if (!editingProd && !prodDz.file) return formFail(msg, 'Vui lòng chọn ảnh chính cho sản phẩm.');
  const wasEditing = !!editingProd;

  btn.classList.add('loading');
  const uploaded = [];
  let savedOk = false;
  try {
    // 1) Ảnh chính
    let mainPath = null;
    if (prodDz.file) { mainPath = await uploadImage(prodDz.file, 'products'); uploaded.push(mainPath); }
    // 2) Ghi sản phẩm
    const txt = id => $(id).value.trim() || null;
    const payload = {
      sku, name, price: Math.round(price), stock, collection_id, category: $('pfCategory').value, is_featured: $('pfFeatured').checked,
      tagline: txt('pfTagline'), description: txt('pfDesc'), material: txt('pfMaterial'), usage: txt('pfUsage'), care: txt('pfCare')
    };
    if (mainPath) payload.image_path = mainPath;
    const { data: saved, error } = editingProd
      ? await sb.from('products').update(payload).eq('id', editingProd.id).select('id').single()
      : await sb.from('products').insert(payload).select('id').single();
    if (error) throw new Error(error.code === '23505' ? `Mã sản phẩm “${sku}” đã tồn tại.` : viError(error));
    const pid = saved.id;
    savedOk = true;
    if (editingProd && mainPath) await removeImages([editingProd.image_path]);
    // Nếu bước ảnh phụ lỗi, lần bấm Lưu tiếp theo sẽ cập nhật chứ không tạo trùng
    editingProd = { ...(editingProd || {}), ...payload, id: pid, image_path: payload.image_path || editingProd?.image_path };

    // 3) Thư viện ảnh: xoá ảnh bị bỏ, upload ảnh mới, cập nhật thứ tự
    if (galleryRemoved.length) {
      await sb.from('product_images').delete().in('id', galleryRemoved.map(g => g.id));
      await removeImages(galleryRemoved.map(g => g.path));
      galleryRemoved = [];
    }
    for (let i = 0; i < gallery.length; i++) {
      const g = gallery[i];
      if (g.file) {
        const path = await uploadImage(g.file, 'products');
        const { data: gRow, error: gErr } = await sb.from('product_images').insert({ product_id: pid, image_path: path, sort_order: i }).select('id').single();
        if (gErr) { await removeImages([path]); throw new Error('Lưu ảnh phụ thất bại: ' + viError(gErr)); }
        Object.assign(g, { id: gRow.id, path, file: null });
      } else if (g.id) {
        await sb.from('product_images').update({ sort_order: i }).eq('id', g.id);
      }
    }
    closeModal($('productModal'));
    toast(wasEditing ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm', 'success');
    loadProducts();
    refreshBadges();
  } catch (err) {
    if (!savedOk) await removeImages(uploaded);
    formFail(msg, err.message);
  } finally { btn.classList.remove('loading'); }
}

function deleteProduct(p) {
  if (!p) return;
  askConfirm({
    title: 'Xoá sản phẩm?',
    html: `Sản phẩm <strong>${escapeHtml(p.name)}</strong> (${escapeHtml(p.sku)}) và toàn bộ ảnh của nó sẽ bị xoá. Lịch sử đơn hàng cũ vẫn được giữ nguyên.`,
    action: async () => {
      const { data: imgs } = await sb.from('product_images').select('image_path').eq('product_id', p.id);
      const { error } = await sb.from('products').delete().eq('id', p.id);
      if (error) { toast(viError(error), 'error'); return; }
      await removeImages([p.image_path, ...(imgs || []).map(i => i.image_path)]);
      toast('Đã xoá sản phẩm', 'success');
      if (currentView === 'stock') loadStock(); else loadProducts();
      refreshBadges();
    }
  });
}

/* =========================== TỒN KHO =========================== */
let stockFilter = 'all', soldMap = {};

function setupStock() {
  $('stockChips').addEventListener('click', e => {
    const c = e.target.closest('.chip'); if (!c) return;
    stockFilter = c.dataset.f;
    document.querySelectorAll('#stockChips .chip').forEach(x => x.classList.toggle('active', x === c));
    renderStock(false);
  });
  $('stockSearch').addEventListener('input', () => renderStock(false));
  const body = $('stockBody');
  body.addEventListener('click', e => {
    const b = e.target.closest('[data-step]'); if (!b) return;
    const input = b.parentNode.querySelector('input');
    input.value = Math.max(0, (Number(input.value) || 0) + Number(b.dataset.step));
    clearTimeout(input._t);
    input._t = setTimeout(() => saveStock(input), 450);   // gom nhiều lần bấm thành 1 lần lưu
  });
  body.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input[data-id]')) { e.preventDefault(); saveStock(e.target); } });
  body.addEventListener('change', e => { if (e.target.matches('input[data-id]')) saveStock(e.target); });
}

async function loadStock() {
  $('stockBody').innerHTML = rowSkeleton(6);
  const [, res, sold] = await Promise.all([
    loadCollectionList(),
    sb.from('products').select(PRODUCT_COLS).order('stock').order('name'),
    sb.rpc('best_sellers', { p_limit: 1000 })
  ]);
  if (res.error) { $('stockBody').innerHTML = emptyRow(6, escapeHtml(viError(res.error))); return; }
  products = res.data || [];
  soldMap = Object.fromEntries((sold.data || []).map(r => [r.product_id, Number(r.sold)]));
  renderStock(true);
}

function renderStock(intro) {
  const counts = { all: products.length, low: products.filter(p => p.stock > 0 && p.stock <= 3).length, out: products.filter(p => p.stock <= 0).length };
  Object.entries(counts).forEach(([k, v]) => { document.querySelector(`[data-sc="${k}"]`).textContent = v; });
  const q = norm($('stockSearch').value.trim());
  const list = products.filter(p => (stockFilter === 'all' || (stockFilter === 'low' ? p.stock > 0 && p.stock <= 3 : p.stock <= 0)) &&
    (!q || norm(p.name).includes(q) || norm(p.sku).includes(q)));
  const body = $('stockBody');
  body.classList.toggle('intro', intro);
  if (!list.length) { body.innerHTML = emptyRow(6, products.length ? 'Không có sản phẩm phù hợp.' : 'Chưa có sản phẩm.'); return; }
  body.innerHTML = list.map((p, i) => `
    <tr style="animation-delay:${Math.min(i, 8) * 30}ms">
      <td><img class="thumb" src="${imageUrl(p.image_path)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'"></td>
      <td><span class="pname">${escapeHtml(p.name)}</span><br><span class="sku">${escapeHtml(p.sku)}</span></td>
      <td>${escapeHtml(colName(p.collection_id) || '—')}</td>
      <td class="num">${soldMap[p.id] || 0}</td>
      <td>${stockLabel(p.stock)}</td>
      <td class="num">
        <div class="stepper">
          <button type="button" data-step="-1" aria-label="Giảm">−</button>
          <input type="number" min="0" step="1" inputmode="numeric" value="${p.stock}" data-id="${p.id}" aria-label="Tồn kho ${escapeHtml(p.name)}">
          <button type="button" data-step="1" aria-label="Tăng">+</button>
        </div>
      </td>
    </tr>`).join('');
}
const stockLabel = n => n <= 0 ? '<span class="stock-pill out">Hết hàng</span>' : n <= 3 ? '<span class="stock-pill low">Sắp hết</span>' : '<span class="stock-pill">Còn hàng</span>';

async function saveStock(input) {
  const p = products.find(x => x.id === input.dataset.id); if (!p) return;
  const v = Math.max(0, Math.floor(Number(input.value)));
  if (!Number.isFinite(v)) { input.value = p.stock; return; }
  input.value = v;
  if (v === p.stock) return;
  input.classList.add('saving');
  const { error } = await sb.from('products').update({ stock: v }).eq('id', p.id);
  input.classList.remove('saving');
  if (error) { input.value = p.stock; toast(viError(error), 'error'); return; }
  p.stock = v;
  input.classList.add('saved'); setTimeout(() => input.classList.remove('saved'), 900);
  input.closest('tr').children[4].innerHTML = stockLabel(v);
  refreshBadges();
}
