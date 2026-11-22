/* =========================================================
   CẤU HÌNH CHUNG — chỉ cần sửa file này
   - SUPABASE_URL / SUPABASE_ANON_KEY: lấy ở Supabase > Project Settings > API
   - Anon key được phép công khai (dữ liệu đã được bảo vệ bằng RLS).
   - TUYỆT ĐỐI không dán service_role key vào đây.
   ========================================================= */
window.APP_CONFIG = {
  SUPABASE_URL: 'https://ejcsqfyfhjoaptryhspu.supabase.co',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqY3NxZnlmaGpvYXB0cnloc3B1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyMzA0MDAsImV4cCI6MjEwOTgwNjQwMH0.-DKV1Tg2qY0dHIFGkWtB8OZfBVEsz-bbdeH2NdDUfFs',

  // Thông tin shop — hiển thị ở thanh trên cùng, footer, trang Chính sách
  SITE: {
    name: 'Nếp Cài',
    legalName: 'Nếp Cài Việt Nam',
    tagline: 'Cài một nét Xưa, giữ một nếp Việt',
    intro: 'Trâm cài mang dấu ấn Việt – Thiết kế và chế tác thủ công từ đất sét',
    // Các dòng chữ chạy trên cùng mỗi trang
    announcements: [
      'Cài một nét Xưa, giữ một nếp Việt',
      'Trâm cài mang dấu ấn Việt – Thiết kế và chế tác thủ công từ đất sét',
      'Hỗ trợ khách hàng: 0913 582 134'
    ],
    phone: '0913 582 134',
    email: 'nepcaivietnam@gmail.com',
    facebook: 'https://www.facebook.com/profile.php?id=61596270453256',
    instagram: 'https://www.instagram.com/nepcaivietnam/',
    tiktok: 'https://www.tiktok.com/@nepcaivietnam',
    zalo: 'https://zalo.me/0913582134',
    address: 'Việt Nam'
  }
};
