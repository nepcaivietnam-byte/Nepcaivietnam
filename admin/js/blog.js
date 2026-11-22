/* =========================================================
   ADMIN · BLOG — Về Nếp (bài kể chuyện, có thứ tự) và Góc Nếp (bài theo chủ đề)
   Hai mục dùng chung bảng posts, phân biệt bằng cột section.
   ========================================================= */
VIEWS['ve-nep'] = { title: 'Về Nếp', eyebrow: 'Blog', el: 'blog', load: loadPosts };
VIEWS['goc-nep'] = { title: 'Góc Nếp', eyebrow: 'Blog', el: 'blog', load: loadPosts };

let posts = [], postSection = 'goc-nep', postChip = 'all', editingPost = null, coverDz = null;

function setupBlog() {
  coverDz = dropzone('poCover', $('poMsg'));
  $('addPostBtn').onclick = () => openPostModal(null);
  $('postForm').addEventListener('submit', savePost);
  $('postChips').addEventListener('click', e => {
    const c = e.target.closest('.chip'); if (!c) return;
    postChip = c.dataset.c; renderPosts(false);
  });
  $('postBody').addEventListener('click', async e => {
    const ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]'), pub = e.target.closest('[data-pub]');
    if (ed) openPostModal(posts.find(p => p.id === Number(ed.dataset.edit)));
    if (dl) deletePost(posts.find(p => p.id === Number(dl.dataset.del)));
    if (pub) {
      const p = posts.find(x => x.id === Number(pub.dataset.pub));
      const val = !p.is_published;
      const { error } = await sb.from('posts').update({ is_published: val }).eq('id', p.id);
      if (error) { toast(viError(error), 'error'); return; }
      p.is_published = val; renderPosts(false);
      toast(val ? 'Đã đăng bài' : 'Đã chuyển về bản nháp', 'success');
    }
  });
  // Xem trước nội dung
  document.querySelector('#postModal .mini-tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-pv]'); if (!b) return;
    const pv = b.dataset.pv === 'preview';
    b.parentNode.querySelectorAll('[data-pv]').forEach(x => x.classList.toggle('active', x === b));
    $('poContent').hidden = pv; $('poPreview').hidden = !pv;
    if (pv) $('poPreview').innerHTML = richText($('poContent').value) || '<p class="muted">Chưa có nội dung.</p>';
  });
}

async function loadPosts(section) {
  if (section !== postSection) { postSection = section; postChip = 'all'; }
  const ve = postSection === 've-nep';
  $('postHead').innerHTML = `<tr><th>Ảnh bìa</th><th>Tiêu đề</th>${ve ? '<th class="num">Thứ tự</th>' : '<th>Chủ đề</th>'}<th>Ngày đăng</th><th>Trạng thái</th><th></th></tr>`;
  $('blogHint').innerHTML = ve
    ? 'Các bài Về Nếp hiển thị nối tiếp nhau trên trang <a href="../ve-nep/index.html" target="_blank" rel="noopener">Về Nếp ↗</a> theo số thứ tự (nhỏ trước). Bài đầu tiên cũng hiện ở mục “Về Nếp” trên trang chủ.'
    : 'Bài Góc Nếp hiển thị ở trang <a href="../goc-nep/index.html" target="_blank" rel="noopener">Góc Nếp ↗</a> (mới nhất trước); 3 bài mới nhất hiện ở trang chủ.';
  $('postBody').innerHTML = rowSkeleton(6, 3);
  const { data, error } = await sb.from('posts').select('*').eq('section', postSection)
    .order(ve ? 'sort_order' : 'published_at', { ascending: ve }).order('id');
  if (error) { $('postBody').innerHTML = emptyRow(6, escapeHtml(viError(error))); return; }
  posts = data || [];
  renderPosts(true);
}

function renderPosts(intro) {
  const ve = postSection === 've-nep';
  const chips = ve ? [['all', 'Tất cả'], ['pub', 'Đã đăng'], ['draft', 'Bản nháp']]
    : [['all', 'Tất cả'], ...Object.entries(POST_CATEGORIES), ['draft', 'Bản nháp']];
  const match = (p, k) => k === 'all' || (k === 'pub' ? p.is_published : k === 'draft' ? !p.is_published : p.category === k);
  $('postChips').innerHTML = chips.map(([k, l]) => `<button class="chip ${k === postChip ? 'active' : ''}" data-c="${k}">${l} <span>${posts.filter(p => match(p, k)).length}</span></button>`).join('');
  const list = posts.filter(p => match(p, postChip));
  const body = $('postBody');
  body.classList.toggle('intro', intro);
  if (!list.length) { body.innerHTML = emptyRow(6, posts.length ? 'Không có bài phù hợp.' : 'Chưa có bài viết — bấm “Viết bài mới”.'); return; }
  body.innerHTML = list.map((p, i) => `
    <tr style="animation-delay:${Math.min(i, 8) * 30}ms">
      <td><img class="thumb wide" src="${imageUrl(p.cover_path)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'"></td>
      <td class="post-title"><span class="pname">${escapeHtml(p.title)}</span>${p.excerpt ? `<br><small class="muted clamp">${escapeHtml(p.excerpt)}</small>` : ''}</td>
      <td${ve ? ' class="num"' : ''}>${ve ? p.sort_order : `<span class="chip-mini">${escapeHtml(POST_CATEGORIES[p.category] || '—')}</span>`}</td>
      <td>${formatDate(p.published_at)}</td>
      <td><button class="pub-toggle ${p.is_published ? 'on' : ''}" data-pub="${p.id}" title="Bấm để ${p.is_published ? 'ẩn' : 'đăng'}">${p.is_published ? 'Đã đăng' : 'Bản nháp'}</button></td>
      <td class="actions">
        <a class="icon-action" href="../bai-viet/index.html?id=${p.id}" target="_blank" rel="noopener" title="Xem trên web">↗</a>
        <button class="icon-action" data-edit="${p.id}" title="Sửa">${EDIT_SVG}</button>
        <button class="icon-action del" data-del="${p.id}" title="Xoá">${icon('trash')}</button>
      </td>
    </tr>`).join('');
}

function openPostModal(p) {
  editingPost = p || null;
  const ve = (p?.section || postSection) === 've-nep';
  $('postForm').reset();
  $('poTitle').textContent = (p ? 'Sửa bài · ' : 'Viết bài mới · ') + (ve ? 'Về Nếp' : 'Góc Nếp');
  $('poTitleInput').value = p?.title || '';
  $('poExcerpt').value = p?.excerpt || '';
  $('poContent').value = p?.content || '';
  $('poPublished').checked = p ? p.is_published : true;
  $('poDate').value = toDateInput(p?.published_at);
  $('poCatField').hidden = ve;
  $('poSortField').hidden = !ve;
  $('poCategory').value = p?.category || (POST_CATEGORIES[postChip] ? postChip : 'van-hoa');
  $('poSort').value = p?.sort_order ?? (posts.length ? Math.max(...posts.map(x => x.sort_order || 0)) + 1 : 1);
  document.querySelector('#postModal [data-pv="write"]').click();
  coverDz.reset(p?.cover_path ? imageUrl(p.cover_path) : null);
  openModal($('postModal'));
  setTimeout(() => $('poTitleInput').focus(), 50);
}

async function savePost(e) {
  e.preventDefault();
  const msg = $('poMsg'), btn = $('poSave');
  const section = editingPost?.section || postSection;
  const ve = section === 've-nep';
  const title = $('poTitleInput').value.trim();
  const content = $('poContent').value.trim();
  if (!title) return formFail(msg, 'Vui lòng nhập tiêu đề.');
  if (!content) return formFail(msg, 'Vui lòng viết nội dung bài.');
  btn.classList.add('loading');
  let newPath = null;
  try {
    if (coverDz.file) newPath = await uploadImage(coverDz.file, 'posts');
    const date = $('poDate').value ? new Date($('poDate').value + 'T09:00:00') : new Date();
    const payload = {
      section, title, content, excerpt: $('poExcerpt').value.trim() || null,
      category: ve ? null : $('poCategory').value, sort_order: ve ? Number($('poSort').value) || 0 : (editingPost?.sort_order || 0),
      is_published: $('poPublished').checked, published_at: date.toISOString()
    };
    if (newPath) payload.cover_path = newPath;
    const { error } = editingPost
      ? await sb.from('posts').update(payload).eq('id', editingPost.id)
      : await sb.from('posts').insert(payload);
    if (error) throw new Error(viError(error));
    if (editingPost && newPath) await removeImages([editingPost.cover_path]);
    closeModal($('postModal'));
    toast(editingPost ? 'Đã cập nhật bài viết' : (payload.is_published ? 'Đã đăng bài viết' : 'Đã lưu bản nháp'), 'success');
    if (currentView === section) loadPosts(section); else showView(section);
  } catch (err) {
    if (newPath) await removeImages([newPath]);
    formFail(msg, err.message);
  } finally { btn.classList.remove('loading'); }
}

function deletePost(p) {
  if (!p) return;
  askConfirm({
    title: 'Xoá bài viết?',
    html: `Bài <strong>${escapeHtml(p.title)}</strong> sẽ bị xoá vĩnh viễn. Nếu chỉ muốn tạm ẩn, hãy bấm nút “Đã đăng” để chuyển về bản nháp.`,
    action: async () => {
      const { error } = await sb.from('posts').delete().eq('id', p.id);
      if (error) { toast(viError(error), 'error'); return; }
      await removeImages([p.cover_path]);
      toast('Đã xoá bài viết', 'success');
      loadPosts(postSection);
    }
  });
}
