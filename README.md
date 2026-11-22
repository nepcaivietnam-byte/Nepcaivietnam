# Nếp Cài — Web bán châm cài tóc

Web tĩnh HTML/CSS/JS, dữ liệu lưu trên Supabase (chỉ dùng anon key, bảo mật bằng RLS).

## Cấu trúc thư mục
```
index.html          → tự chuyển về home/
assets/
  css/base.css      → màu, font, nút, thẻ sản phẩm, form dùng chung
  css/layout.css    → header (menu 2 bên logo, tìm kiếm), footer, ô đăng ký nhận tin, banner trang con, thẻ bài viết
  js/config.js      → URL + anon key Supabase, tên shop, SĐT, Gmail, Facebook, TikTok, Instagram
  js/common.js      → kết nối Supabase, header (ảnh tròn tài khoản), giỏ hàng, footer
  images/brand/     → logo Nếp Cài (bản màu & bản kem), favicon, banner (768/1280/2048px)
  images/col-*.jpg, story-trio.jpg, auth-*.jpg → ảnh trâm tách nền từ banner, đặt trên nền lụa
  images/hero/, images/blog/ → ảnh banner trang con & ảnh bài viết mẫu (thay được trong admin)
home/      Trang chủ: banner trình chiếu → Tập phẩm nổi bật → Trâm cài nổi bật → Về Nếp → Góc Nếp
tap-pham/           Danh sách bộ sưu tập (Tập phẩm)
tap-pham-chi-tiet/  Một bộ sưu tập: ý nghĩa bộ sưu tập + ý nghĩa từng sản phẩm (?id=...)
tram-cai/  Tất cả trâm cài: tab loại, lọc bộ sưu tập, tìm kiếm, sắp xếp, phân trang
shop/      (chỉ còn để chuyển hướng link cũ sang tram-cai/)
product/   Chi tiết sản phẩm: nhiều ảnh, 4 tab, sản phẩm liên quan (?id=...)
ve-nep/    Về Nếp — các bài kể chuyện do admin đăng
goc-nep/   Góc Nếp — blog theo chủ đề, phân trang
bai-viet/  Chi tiết một bài viết (?id=...)
chinh-sach/ Chính sách mua hàng, đổi trả, hướng dẫn sử dụng & bảo quản, liên hệ
cart/      Giỏ hàng → chuyển sang trang thanh toán
checkout/  Thanh toán: chọn địa chỉ mặc định / địa chỉ khác, COD, ghi chú (hỗ trợ "Mua ngay")
login/     Đăng nhập (admin → admin/, khách → customer/)
register/  Đăng ký khách hàng
customer/  Trang khách hàng (đơn hàng, thông tin cá nhân)
admin/     Trang quản trị — js/ tách theo mục:
           core (dùng chung) · dashboard (Tổng quan) · orders (Đơn hàng, Vận chuyển)
           catalog (Bộ sưu tập, Sản phẩm, Tồn kho) · blog (Về Nếp, Góc Nếp)
           banners (Banner trang chủ) · reports (Doanh thu, Khách hàng, Đăng ký nhận tin)
supabase/  Chạy lần lượt trong SQL Editor (DB thật đã chạy đủ 3 file):
           01_supabase_setup.sql (tạo bảng) · 02_checkout_va_don_hang.sql (thanh toán/đơn hàng)
           03_tap_pham_blog_banner_van_chuyen.sql (bộ sưu tập, ảnh phụ, banner, bài viết, đăng ký nhận tin, 6 trạng thái đơn)
render.yaml  Cấu hình deploy Render
anh-san-pham-mau/  3 ảnh JPG mẫu (1000×1000) để thử upload trong trang admin
```
Mỗi folder gồm `index.html` + `style.css` + `script.js` của trang đó.

## Chạy thử trên máy
Mở terminal tại thư mục này:
```
python -m http.server 8000
```
Rồi vào http://localhost:8000

## Deploy lên Render
1. Đưa toàn bộ thư mục này lên một repo GitHub.
2. Render → **New → Static Site** → chọn repo.
3. Build Command: để trống · Publish Directory: `.`
4. Bấm **Create Static Site**.

## Sau khi có link Render
Supabase → **Authentication → URL Configuration**:
- Site URL: `https://<ten-web>.onrender.com`
- Redirect URLs: thêm `https://<ten-web>.onrender.com/**`

## Trạng thái đơn hàng
Cần xử lý → Đã xác nhận (cần giao) → Đang giao → **Đã giao** (chỉ trạng thái này được cộng doanh thu).
Huỷ (từ Cần xử lý / Đã xác nhận) hoặc Hoàn hàng (từ Đang giao / Đã giao) đều tự trả hàng về kho; “Mở lại đơn” sẽ trừ kho lại.

## Ảnh trong Storage (bucket `product-images`)
`products/` ảnh sản phẩm · `collections/` ảnh bộ sưu tập · `posts/` ảnh bìa bài viết · `banners/` ảnh trình chiếu trang chủ.
Ảnh mẫu đi kèm web nằm trong `assets/images/` — khi thay bằng ảnh thật trong admin, ảnh mẫu không bị xoá.
