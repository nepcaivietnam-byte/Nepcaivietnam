/* =========================================================
   ADMIN · CORE — điều hướng, modal, ngăn kéo, upload ảnh, tiện ích chung
   Quyền thật sự do RLS trong Supabase kiểm soát; phần kiểm tra ở đây chỉ để điều hướng.
   ========================================================= */
const $ = id => document.getElementById(id);
const VIEWS = {};               // các module tự đăng ký: VIEWS.key = { title, eyebrow, el, load }
let currentView = null;

const norm = s => (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const isStored = p => p && !/^https?:/i.test(p) && !p.startsWith('assets/');   // ảnh nằm trong Storage (được phép xoá)
const compactVND = v => {
  if (v >= 1e9) return (v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tỷ';
  if (v >= 1e6) return (v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tr';
  if (v >= 1e3) return (v / 1e3).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'k';
  return String(v);
};
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const EDIT_SVG = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>';
const rowSkeleton = (cols, n = 4) => Array.from({ length: n }, () => `<tr>${'<td><div class="sk"></div></td>'.repeat(cols)}</tr>`).join('');
const emptyRow = (cols, text) => `<tr class="empty-row"><td colspan="${cols}">${text}</td></tr>`;
const toDateInput = d => { const x = d ? new Date(d) : new Date(); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };

/* ---------- Điều hướng ---------- */
function setupNav() {
  document.querySelectorAll('.side-link').forEach(b => b.addEventListener('click', () => {
    showView(b.dataset.view);
    $('sidebar').classList.remove('open');
  }));
  document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) showView(g.dataset.go); });
  $('menuBtn').onclick = () => $('sidebar').classList.toggle('open');
  $('backdrop').onclick = () => $('sidebar').classList.remove('open');
  window.addEventListener('hashchange', () => {
    const v = location.hash.slice(1);
    if (VIEWS[v] && v !== currentView) showView(v);
  });
}

function showView(name) {
  if (!VIEWS[name]) name = 'dashboard';
  const v = VIEWS[name];
  currentView = name;
  document.querySelectorAll('.side-link').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v.el));
  $('viewTitle').textContent = v.title;
  $('viewEyebrow').textContent = v.eyebrow;
  document.title = `${v.title} · Quản trị | Nếp Cài`;
  history.replaceState(null, '', '#' + name);
  v.load(name);
}

/* ---------- Modal: ra nhanh hơn vào; Esc đóng ngay không animation ---------- */
function openModal(m) {
  clearTimeout(m._closeT);
  m.classList.remove('closing');
  m.hidden = false;
  const msg = m.querySelector('.form-msg'); if (msg) msg.textContent = '';
}
function closeModal(m, instant = false) {
  if (!m || m.hidden) return;
  clearTimeout(m._closeT);
  if (instant || RM()) { m.classList.remove('closing'); m.hidden = true; return; }
  m.classList.add('closing');
  m._closeT = setTimeout(() => { m.hidden = true; m.classList.remove('closing'); }, 150);
}
function setupModals() {
  document.querySelectorAll('.modal').forEach(m => m.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(m))));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.modal:not([hidden])')];
    if (open.length) { open.forEach(m => closeModal(m, true)); return; }
    const d = [...document.querySelectorAll('.drawer.open')].pop();
    if (d) closeDrawer(d, true);
  });
  // Tab nhỏ trong form (mô tả / chất liệu…)
  document.querySelectorAll('.mini-tabs').forEach(t => t.addEventListener('click', e => {
    const b = e.target.closest('[data-pt]'); if (!b) return;
    t.querySelectorAll('[data-pt]').forEach(x => { x.classList.toggle('active', x === b); $(x.dataset.pt).hidden = x !== b; });
    $(b.dataset.pt).focus();
  }));
}
function formFail(msgEl, text) { msgEl.className = 'form-msg error'; msgEl.textContent = text; return false; }

/* ---------- Ngăn kéo ---------- */
function openDrawer(d) {
  d.classList.add('open');
  d.setAttribute('aria-hidden', 'false');
  setTimeout(() => d.querySelector('.modal-x')?.focus({ preventScroll: true }), 50);
}
function closeDrawer(d, instant = false) {
  d.classList.toggle('instant', instant);
  d.classList.remove('open');
  d.setAttribute('aria-hidden', 'true');
  if (d.id === 'orderDrawer') openOrderId = null;
  if (instant) requestAnimationFrame(() => requestAnimationFrame(() => d.classList.remove('instant')));
}
function setupDrawers() {
  document.querySelectorAll('.drawer').forEach(d => d.querySelectorAll('[data-close-drawer]').forEach(b => b.addEventListener('click', () => closeDrawer(d))));
}

/* ---------- Xác nhận xoá (dùng chung) ---------- */
let confirmAction = null;
function askConfirm({ title = 'Xoá?', html, yes = 'Xoá', action }) {
  $('confirmTitle').textContent = title;
  $('confirmText').innerHTML = html;
  $('confirmYes').textContent = yes;
  confirmAction = action;
  openModal($('confirmModal'));
}
function setupConfirm() {
  $('confirmYes').onclick = async () => {
    if (!confirmAction) return;
    const btn = $('confirmYes');
    btn.classList.add('loading');
    try { await confirmAction(); } finally { btn.classList.remove('loading'); closeModal($('confirmModal')); confirmAction = null; }
  };
}

/* ---------- Ảnh: kiểm tra, xem trước, upload lên Storage ---------- */
const IMG_RE = /^image\/(png|jpe?g|webp|gif)$/;
function checkImage(file) {
  if (!IMG_RE.test(file.type)) return 'Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF.';
  if (file.size > 5 * 1024 * 1024) return `Ảnh “${file.name}” vượt quá 5MB.`;
  return null;
}
async function uploadImage(file, folder) {
  const bad = checkImage(file); if (bad) throw new Error(bad);
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { cacheControl: '31536000', contentType: file.type, upsert: false });
  if (error) throw new Error('Upload ảnh thất bại: ' + viError(error));
  return path;
}
async function removeImages(paths) {
  const list = paths.filter(isStored);
  if (list.length) await sb.storage.from(BUCKET).remove(list);
}

/* Ô chọn ảnh có kéo-thả. Trả về đối tượng { file, set(url), reset() } */
function dropzone(inputId, msgEl) {
  const input = $(inputId);
  const dz = input.closest('.dropzone');
  const img = dz.querySelector('img');
  const state = {
    file: null,
    set(url) {
      if (url) { img.src = url; img.hidden = false; dz.classList.add('has-img'); }
      else { img.removeAttribute('src'); img.hidden = true; dz.classList.remove('has-img'); }
    },
    reset(url) { state.file = null; input.value = ''; state.set(url); }
  };
  const pick = f => {
    if (!f) return;
    const bad = checkImage(f);
    if (bad) { formFail(msgEl, bad); return; }
    msgEl.textContent = '';
    state.file = f;
    state.set(URL.createObjectURL(f));
  };
  input.addEventListener('change', e => pick(e.target.files[0]));
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', e => pick(e.dataTransfer.files[0]));
  return state;
}

/* ---------- Đếm số + sparkline ---------- */
function animateNumber(el, target, fmt = v => v.toLocaleString('vi-VN')) {
  if (RM()) { el.textContent = fmt(target); return; }
  const t0 = performance.now(), dur = 500;
  const step = t => {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = fmt(Math.round(target * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function sparkline(values, w = 120, h = 36) {
  if (!values.length) return '';
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * w, h - 3 - ((v - min) / (max - min || 1)) * (h - 6)]);
  const line = pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <polygon points="0,${h} ${line} ${w},${h}" class="spark-fill"/><polyline points="${line}"/></svg>`;
}

/* ---------- Huy hiệu ở menu ---------- */
async function refreshBadges() {
  const [p, s, k] = await Promise.all([
    sb.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
    sb.from('products').select('id', { count: 'exact', head: true }).lte('stock', 0)
  ]);
  [['badge-pending', p.count], ['badge-ship', s.count], ['badge-stock', k.count]].forEach(([id, n]) => {
    $(id).textContent = n || 0; $(id).hidden = !n;
  });
}

/* Danh sách bộ sưu tập dùng chung cho nhiều mục */
let collections = [];
async function loadCollectionList() {
  const { data } = await sb.from('collections').select('*').order('sort_order').order('created_at');
  collections = data || [];
  return collections;
}
const colName = id => collections.find(c => c.id === id)?.name || '';
