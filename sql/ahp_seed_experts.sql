-- =====================================================================
-- MODULE 2 — Seed chuyên gia mẫu để test trang /ahp.html qua link.
-- Xoá bằng: DELETE FROM delphi_experts WHERE ma_chuyen_gia LIKE 'CG0%';
-- =====================================================================
insert into public.delphi_experts (ma_chuyen_gia, ho_ten, don_vi, active)
values
  ('CG01', 'Chuyên gia thử nghiệm 01', 'HCDC', true),
  ('CG02', 'Chuyên gia thử nghiệm 02', 'HCDC', true),
  ('CG03', 'Chuyên gia thử nghiệm 03', 'HCDC', true),
  ('CG04', 'Chuyên gia thử nghiệm 04', 'HCDC', true),
  ('CG05', 'Chuyên gia thử nghiệm 05', 'HCDC', true)
on conflict (ma_chuyen_gia) do update
  set active = excluded.active, ho_ten = excluded.ho_ten;
