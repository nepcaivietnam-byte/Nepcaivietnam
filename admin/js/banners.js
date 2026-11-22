/* =========================================================
   ADMIN · BANNER TRANG CHỦ
   Nút “+ Thêm ảnh banner” cho chọn nhiều ảnh cùng lúc → upload vào banners/ và thêm vào cuối danh sách.
   Mỗi banner: tiêu đề (tuỳ chọn — có tiêu đề sẽ hiện chữ + nút “Khám phá ngay”), đường dẫn, bật/tắt, thứ tự.
   ========================================================= */
VIEWS.banners = { title: 'Banner trang chủ', eyebrow: 'Giao diện', el: 'banners', load: loadBanners };
let banners = [];
const LINK_OPTIONS = [
  ['', '— Không gắn link —'], ['tap-pham/index.html', 'Trang Tập phẩm'], ['tram-cai/index.html', 'Trang Trâm cài'],
  ['ve-nep/index.html', 'Trang Về Nếp'], ['goc-nep/index.html', 'Trang Góc Nếp']
];

function setupBanners() {
  $('bannerFiles').addEventListener('change', e => { addBanners([...e.target.files]); e.target.value = ''; });
  const list = $('bannerList');
  ['dragenter', 'dragover'].forEach(ev => list.addEventListener(ev, e => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); list.classList.add('drag'); } }));
  ['dragleave', 'drop'].forEach(ev => list.addEventListener(ev, e => { e.preventDefault(); list.classList.remove('drag'); }));
  list.addEventListener('drop', e => addBanners([...e.dataTransfer.files]));

  list.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const i = Number(b.dataset.i), bn = banners[i];
    if (b.dataset.act === 'up') moveBanner(i, -1);
    if (b.dataset.act === 'down') moveBanner(i, 1);
    if (b.dataset.act === 'del') askConfirm({
      title: 'Xoá banner?', html: 'Ảnh banner này sẽ bị gỡ khỏi trang chủ.',
      action: async () => {
        const { error } = await sb.from('banners').delete().eq('id', bn.id);
        if (error) { toast(viError(error), 'error'); return; }
        await removeImages([bn.image_path]);
        toast('Đã xoá banner', 'success'); loadBanners();
      }
    });
  });
  list.addEventListener('change', async e => {
    const el = e.target.closest('[data-field]'); if (!el) return;
    const bn = banners[Number(el.dataset.i)];
    const field = el.dataset.field;
    let val = el.type === 'checkbox' ? el.checked : el.value.trim() || null;
    if (field === 'link' && val === '__custom') return;
    const { error } = await sb.from('banners').update({ [field]: val }).eq('id', bn.id);
    if (error) { toast(viError(error), 'error'); return; }
    bn[field] = val;
    if (field === 'is_active') el.closest('.banner-card').classList.toggle('off', !val);
    toast(field === 'is_active' ? (val ? 'Banner đang hiển thị' : 'Đã ẩn banner') : 'Đã lưu', 'success');
  });
}

async function loadBanners() {
  const list = $('bannerList');
  if (!banners.length) list.innerHTML = '<div class="banner-card card"><div class="sk" style="height:160px"></div></div>';
  const { data, error } = await sb.from('banners').select('*').order('sort_order').order('id');
  if (error) { list.innerHTML = `<p class="muted">${escapeHtml(viError(error))}</p>`; return; }
  banners = data || [];
  renderBanners();
}

function renderBanners() {
  const list = $('bannerList');
  if (!banners.length) {
    list.innerHTML = `<label class="empty-card card banner-empty" for="bannerFiles">
      <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="m2 16 6-5 4 4 3-3 7 6"/></svg>
      <p>Chưa có banner — trang chủ đang dùng ảnh mặc định.<br><strong>Bấm vào đây hoặc kéo thả ảnh</strong> để thêm.</p></label>`;
    return;
  }
  const active = banners.filter(b => b.is_active).length;
  list.innerHTML = `<p class="muted banner-count">${banners.length} banner · ${active} đang hiển thị${active > 1 ? ' · tự chuyển sau mỗi 6 giây' : ''}</p>` +
    banners.map((b, i) => {
      const custom = b.link && !LINK_OPTIONS.some(o => o[0] === b.link);
      return `
      <article class="banner-card card ${b.is_active ? '' : 'off'}">
        <div class="bn-order">
          <button class="icon-action" data-act="up" data-i="${i}" aria-label="Lên trước" ${i === 0 ? 'disabled' : ''}>↑</button>
          <span>${i + 1}</span>
          <button class="icon-action" data-act="down" data-i="${i}" aria-label="Xuống sau" ${i === banners.length - 1 ? 'disabled' : ''}>↓</button>
        </div>
        <div class="bn-media"><img src="${imageUrl(b.image_path)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'"></div>
        <div class="bn-fields">
          <div class="field"><label>Tiêu đề trên ảnh (tuỳ chọn)</label>
            <input class="input" data-field="title" data-i="${i}" value="${escapeHtml(b.title || '')}" placeholder="Để trống nếu ảnh đã có chữ"></div>
          <div class="field"><label>Khi bấm vào ảnh, mở</label>
            <select class="select" data-field="link" data-i="${i}">
              ${LINK_OPTIONS.map(([v, l]) => `<option value="${v}" ${(b.link || '') === v ? 'selected' : ''}>${l}</option>`).join('')}
              ${custom ? `<option value="${escapeHtml(b.link)}" selected>${escapeHtml(b.link)}</option>` : ''}
            </select></div>
          <label class="switch"><input type="checkbox" data-field="is_active" data-i="${i}" ${b.is_active ? 'checked' : ''}><span></span>Hiển thị trên trang chủ</label>
        </div>
        <button class="icon-action del bn-del" data-act="del" data-i="${i}" title="Xoá">${icon('trash')}</button>
      </article>`;
    }).join('');
}

async function addBanners(files) {
  files = files.filter(f => f.type.startsWith('image/'));
  if (!files.length) return;
  const btn = $('bannerUploadBtn');
  btn.classList.add('loading');
  let next = banners.length ? Math.max(...banners.map(b => b.sort_order)) + 1 : 1, ok = 0;
  for (const f of files) {
    try {
      const path = await uploadImage(f, 'banners');
      const { error } = await sb.from('banners').insert({ image_path: path, sort_order: next++, is_active: true });
      if (error) { await removeImages([path]); throw new Error(viError(error)); }
      ok++;
    } catch (err) { toast(err.message, 'error'); }
  }
  btn.classList.remove('loading');
  if (ok) toast(`Đã thêm ${ok} ảnh banner`, 'success');
  loadBanners();
}

async function moveBanner(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= banners.length) return;
  [banners[i], banners[j]] = [banners[j], banners[i]];
  // Đánh lại số thứ tự 1..n cho chắc chắn không trùng
  const updates = banners.map((b, k) => ({ b, k: k + 1 })).filter(({ b, k }) => b.sort_order !== k);
  renderBanners();
  const res = await Promise.all(updates.map(({ b, k }) => sb.from('banners').update({ sort_order: k }).eq('id', b.id)));
  updates.forEach(({ b, k }) => { b.sort_order = k; });
  if (res.some(r => r.error)) { toast('Không lưu được thứ tự', 'error'); loadBanners(); }
}
