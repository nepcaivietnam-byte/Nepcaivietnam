# Thay đổi theo nguyên tắc Emil Kowalski (v2)

| Trước | Sau | Lý do |
|---|---|---|
| Easing chung `cubic-bezier(.22,.61,.36,1)` | `--ease-out (.23,1,.32,1)`, `--ease-in-out (.77,0,.175,1)`, `--ease-drawer (.32,.72,0,1)` | Đường cong mạnh hơn, phản hồi tức thì |
| Hiệu ứng UI 400–1400ms | 140–300ms (ảnh/marketing 700–1100ms) | UI dưới 300ms cảm giác nhanh hơn |
| Nút không phản hồi khi nhấn | `:active { scale(.97) }` 140ms | Người dùng biết web đã "nghe" |
| `:hover` chạy cả trên điện thoại | Gói trong `@media (hover:hover) and (pointer:fine)` | Hết lỗi "kẹt hover" sau khi chạm |
| Menu tài khoản trượt từ giữa | `transform-origin: top right`, scale .97 → 1; ra 150ms, vào 200ms | Mở ra từ chính ảnh tròn; đóng nhanh hơn mở |
| Mở menu bằng bàn phím có animation | Bàn phím / Esc: hiện/đóng tức thì | Không animate thao tác bàn phím |
| Header co lại bằng `height` khi cuộn | Chỉ đổi bóng đổ | Animate height gây tính lại layout |
| Menu điện thoại dùng `max-height` | `clip-path` + stagger 40ms các mục | Chỉ dùng thuộc tính chạy trên GPU |
| Giỏ hàng: bấm +/- cả danh sách nhảy lại | Stagger chỉ ở lần đầu; xoá = transition 200ms | Keyframes chạy lại mỗi lần re-render |
| Admin: mỗi phím gõ tìm kiếm các dòng bay lên | Hiệu ứng chỉ khi tải dữ liệu | Thao tác lặp lại nhiều lần không nên animate |
| Modal admin mở 400ms, đóng tức thì | Mở 240ms, đóng 150ms; Esc đóng tức thì | Ra nhanh hơn vào; bàn phím không chờ |
| Gạch chân tab dùng `left/width` | `translateX() scaleX()` | Không đụng layout |
| "Thêm vào giỏ" chỉ hiện toast | Nút đổi chữ "Đã thêm ✓" với blur 2px + icon giỏ nảy (WAAPI) | Phản hồi ngay tại chỗ bấm |
| Zoom ảnh nhảy theo chuột | Điểm zoom đuổi theo có quán tính (như spring) | Chuyển động trang trí cần có "đà" |
| Ảnh bộ sưu tập chỉ fade | Hé lộ bằng `clip-path` từ dưới lên khi cuộn tới | Kỹ thuật image reveal của Emil |
| Chuyển view dashboard 450ms trượt | Fade 160ms; biểu đồ & số đếm 500ms | Dashboard dùng nhiều lần/ngày phải gọn |
| Giảm chuyển động: tắt hết | Bỏ dịch chuyển, giữ fade | Reduced motion = ít hơn, không phải không có |
| Chạm có vệt xám, ô nhập 15px, `100vh` | `tap-highlight: transparent`, ô nhập 16px trên điện thoại, `100svh`, `viewport-fit=cover` | Hết zoom khi gõ trên iPhone, hero không bị thanh địa chỉ che |
