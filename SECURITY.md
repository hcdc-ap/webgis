# Chính sách bảo mật

## Báo cáo lỗ hổng
Vui lòng KHÔNG tạo issue công khai. Hãy liên hệ riêng với quản trị viên HCDC WebGIS
(hoặc dùng GitHub → Security → "Report a vulnerability") và nêu rõ cách tái hiện.

## Nguyên tắc
- Không đưa khóa/token (`sbp_...`, `service_role`, `sb_secret_...`, khóa Gemini, `.env`) vào repo.
- Trình duyệt chỉ dùng khóa `publishable`/`anon`; mọi quyền ghi do RLS Supabase quyết định.
- Mọi chuỗi từ CSDL/AI phải qua `escapeHtml()` trước khi chèn vào `innerHTML`.
- Thư viện CDN phải ghim phiên bản cụ thể và có `integrity` (SRI).
- Nghi ngờ khóa bị lộ: xoay khóa ngay trên Supabase/Google, sau đó mới dọn lịch sử git.
