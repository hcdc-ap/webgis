-- =====================================================================
-- MODULE 4 — Seed dữ liệu MÔ PHỎNG để kiểm thử end-to-end /api/validate
-- ---------------------------------------------------------------------
-- Sinh ~250 điểm giả trong monitoring_points với quan hệ R <-> khong_dat
-- ĐÃ BIẾT TRƯỚC (giống cơ chế sinh verify_dataset.csv: logistic thật với
-- beta0=-2.5, beta1=4.0 -> OR thật ~54.6, AUC kỳ vọng ~0.75-0.85) để khi
-- chạy qua /api/validate ra kết quả có ý nghĩa thống kê rõ ràng, dùng đối
-- chiếu trong test/validation_test.js.
-- Đồng thời seed point_attributes (KN01 = R + nhiễu nhỏ) và
-- criteria_weights (KN01 trọng số 1.0) để test luồng "features" động.
--
-- DỌN SẠCH sau khi test bằng:
--   DELETE FROM monitoring_points WHERE point_code LIKE 'VAL_P%';
--   DELETE FROM point_attributes WHERE point_code LIKE 'VAL_P%';
--   DELETE FROM criteria_weights WHERE ma_tieu_chi = 'KN01';
-- =====================================================================

-- 1. Trọng số giả (chỉ 1 tiêu chí, đơn giản hóa để kiểm định pipeline)
insert into public.criteria_weights (ma_tieu_chi, nhom, w_nhom, w_cuc_bo, w_toan_cuc, updated_at)
values ('KN01', 'KN', 1, 1, 1, now())
on conflict (ma_tieu_chi) do update set
  w_toan_cuc = excluded.w_toan_cuc, updated_at = excluded.updated_at;

-- 2. Sinh 250 điểm: R ngẫu nhiên [0,1], khong_dat theo logistic thật
--    logit(p) = -2.5 + 4.0*R (dùng random() có seed cố định qua setseed)
select setseed(0.20250101);

do $$
declare
  gs int;
  r_val numeric;
  logit_p numeric;
  p_val numeric;
  kd int;
  grp text;
  q1 numeric; q2 numeric; q3 numeric;
  r_array numeric[];
begin
  -- Sinh mảng R trước để tính tứ phân vị (dùng cho nhóm ưu tiên)
  select array_agg(random()) into r_array from generate_series(1,250);

  select percentile_cont(0.25) within group (order by v),
         percentile_cont(0.50) within group (order by v),
         percentile_cont(0.75) within group (order by v)
  into q1, q2, q3
  from unnest(r_array) as v;

  for gs in 1..250 loop
    r_val := r_array[gs];
    logit_p := -2.5 + 4.0 * r_val;
    p_val := 1.0 / (1.0 + exp(-logit_p));
    kd := case when random() < p_val then 1 else 0 end;
    -- Dùng đúng nhãn tiếng Việt theo CHECK constraint của monitoring_points
    -- (khớp scoring-core.js). Node sẽ map sang mã ngắn cao/tb_cao/tb/thap
    -- khi gửi sang stats_service (xem test/validation_test.js).
    grp := case
      when r_val >= q3 then 'Ưu tiên cao'
      when r_val >= q2 then 'Trung bình-cao'
      when r_val >= q1 then 'Trung bình'
      else 'Thấp'
    end;

    insert into public.monitoring_points
      (point_code, lat, lng, khu_vuc, n_mau, khong_dat, ty_le_khong_dat, diem_r, nhom_uu_tien, weights_version, updated_at)
    values (
      'VAL_P' || lpad(gs::text, 4, '0'),
      10.7 + gs * 0.0001, 106.6 + gs * 0.0001, 'VAL_ZONE_TEST',
      1, kd, kd::numeric, r_val, grp, now(), now()
    )
    on conflict (point_code) do update set
      diem_r = excluded.diem_r, khong_dat = excluded.khong_dat,
      nhom_uu_tien = excluded.nhom_uu_tien, updated_at = excluded.updated_at;

    insert into public.point_attributes (point_code, lat, lng, vi_tri_mang, updated_at)
    values ('VAL_P' || lpad(gs::text, 4, '0'), 10.7 + gs * 0.0001, 106.6 + gs * 0.0001, null, now())
    on conflict (point_code) do nothing;
  end loop;
end $$;

-- 3. KN01 trong point_attributes = chính diem_r (mô phỏng feature tương quan
--    thuận với R, dùng water_age_gio làm cột số liên tục sẵn có để tái sử
--    dụng, không cần thêm cột KN01 riêng)
update public.point_attributes pa
set water_age_gio = mp.diem_r * 100  -- scale 0-100 giờ để hợp lý về đơn vị
from public.monitoring_points mp
where pa.point_code = mp.point_code and mp.point_code like 'VAL_P%';
