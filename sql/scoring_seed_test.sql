-- =====================================================================
-- MODULE 3 — Seed dữ liệu MÔ PHỎNG để kiểm định phần chấm điểm (3.2-3.3)
-- ---------------------------------------------------------------------
-- Sinh ~24 điểm giả trong point_attributes với giá trị BIẾT TRƯỚC để đối
-- chiếu tay trong test/scoring_test.js. Bao gồm:
--   - 20 điểm có ĐỦ 3 tiêu chí test (KN01 ordinal, KN02 binary, KN03 continuous)
--   - 4 điểm THIẾU 1 tiêu chí (kiểm nhánh "chuẩn hóa lại trọng số")
-- Cũng seed 3 dòng criteria_weights giả (KN01=0.5, KN02=0.3, KN03=0.2) và
-- các dòng monitoring_points tương ứng (điểm giả TEST_P01..TEST_P24).
--
-- DỌN SẠCH sau khi test xong bằng:
--   DELETE FROM point_attributes WHERE point_code LIKE 'TEST_P%';
--   DELETE FROM monitoring_points WHERE point_code LIKE 'TEST_P%';
--   DELETE FROM criteria_weights WHERE ma_tieu_chi IN ('KN01','KN02','KN03');
-- (Script này chỉ INSERT — không tự xóa, để test/scoring_test.js kiểm tra
--  xong sẽ tự gọi lệnh dọn dẹp tương ứng qua REST API.)
-- =====================================================================

-- 1. Trọng số giả (đơn giản, tổng = 1, không phụ thuộc AHP thật)
insert into public.criteria_weights (ma_tieu_chi, nhom, w_nhom, w_cuc_bo, w_toan_cuc, updated_at)
values
  ('KN01', 'KN', 1, 0.5, 0.5, now()),
  ('KN02', 'KN', 1, 0.3, 0.3, now()),
  ('KN03', 'KN', 1, 0.2, 0.2, now())
on conflict (ma_tieu_chi) do update set
  w_nhom = excluded.w_nhom, w_cuc_bo = excluded.w_cuc_bo,
  w_toan_cuc = excluded.w_toan_cuc, updated_at = excluded.updated_at;

-- 2. 20 điểm ĐỦ dữ liệu cả 3 tiêu chí
-- KN01 (vi_tri_mang): luân phiên Đầu/Giữa/Cuối -> 0/0.5/1
-- KN02 (ap_luc_yeu): luân phiên true/false -> 1/0
-- KN03 (water_age_gio): 1..20 giờ -> continuous min=1,max=20
insert into public.point_attributes (point_code, lat, lng, vi_tri_mang, ap_luc_yeu, water_age_gio, updated_at)
select
  'TEST_P' || lpad(gs::text, 2, '0'),
  10.7 + gs * 0.001,
  106.6 + gs * 0.001,
  (array['Đầu','Giữa','Cuối'])[1 + (gs % 3)],
  (gs % 2 = 0),
  gs::numeric,
  now()
from generate_series(1, 20) as gs
on conflict (point_code) do update set
  vi_tri_mang = excluded.vi_tri_mang, ap_luc_yeu = excluded.ap_luc_yeu,
  water_age_gio = excluded.water_age_gio, updated_at = excluded.updated_at;

-- 3. 4 điểm THIẾU 1 tiêu chí (để kiểm nhánh chuẩn hóa lại trọng số)
-- TEST_P21, TEST_P22: thiếu KN03 (water_age_gio = NULL)
-- TEST_P23, TEST_P24: thiếu KN01 (vi_tri_mang = NULL)
insert into public.point_attributes (point_code, lat, lng, vi_tri_mang, ap_luc_yeu, water_age_gio, updated_at)
values
  ('TEST_P21', 10.721, 106.621, 'Cuối', true, null, now()),
  ('TEST_P22', 10.722, 106.622, 'Giữa', false, null, now()),
  ('TEST_P23', 10.723, 106.623, null, true, 10, now()),
  ('TEST_P24', 10.724, 106.624, null, false, 15, now())
on conflict (point_code) do update set
  vi_tri_mang = excluded.vi_tri_mang, ap_luc_yeu = excluded.ap_luc_yeu,
  water_age_gio = excluded.water_age_gio, updated_at = excluded.updated_at;

-- 4. monitoring_points tương ứng (giả lập đã gộp mẫu -> điểm)
insert into public.monitoring_points (point_code, lat, lng, khu_vuc, n_mau, khong_dat, ty_le_khong_dat, updated_at)
select
  pa.point_code, pa.lat, pa.lng, 'TEST_ZONE', 1,
  case when (right(pa.point_code, 2))::int % 5 = 0 then 1 else 0 end,
  case when (right(pa.point_code, 2))::int % 5 = 0 then 1.0 else 0.0 end,
  now()
from public.point_attributes pa
where pa.point_code like 'TEST_P%'
on conflict (point_code) do update set
  lat = excluded.lat, lng = excluded.lng, updated_at = excluded.updated_at;
