-- 2026-11-19: Mẫu ngoại kiểm hiển thị mã (vd. XABINHM) thay vì tên đơn vị vì view nối units phân biệt hoa/thường.
-- 1) Sửa mã nhập sai 'xabinhmy' -> 'xabinhm' (7 mẫu).
-- 2) Nối view không phân biệt hoa/thường; giữ security_invoker.
-- (units.maphuong là duy nhất theo lower() nên không nhân đôi dòng.)
BEGIN;
UPDATE public.water_reports SET maphuong_temp = 'xabinhm' WHERE maphuong_temp = 'xabinhmy';
-- Chỉ đổi phép nối của view_report_results:
--   LEFT JOIN units u ON (r.maphuong_temp = u.maphuong)
-- thành:
--   LEFT JOIN units u ON (lower(btrim(r.maphuong_temp)) = lower(u.maphuong))
-- (đã áp dụng bằng CREATE OR REPLACE VIEW trên định nghĩa hiện hành)
ALTER VIEW public.view_report_results SET (security_invoker = on);
COMMIT;
