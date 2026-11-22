-- =====================================================================
-- MODULE 3 — Schema (monitoring_points) + RLS (point_attributes, analysis_runs)
-- ---------------------------------------------------------------------
-- monitoring_points: kết quả gộp mẫu -> điểm (3.1) + kết quả chấm điểm
--                     nguy cơ R (3.3). Đơn vị phân tích = ĐIỂM.
-- point_attributes  : đã tồn tại sẵn (chưa có RLS) — thuộc tính GIS/hạ
--                     tầng của từng điểm, dùng để chuẩn hóa tiêu chí (3.2)
-- analysis_runs     : đã tồn tại sẵn (chưa có RLS) — bằng chứng bất biến
--                     mỗi lần chạy chấm điểm.
-- =====================================================================

-- ---------- 1. monitoring_points ----------
create table if not exists public.monitoring_points (
  point_code text primary key,
  lat numeric not null,
  lng numeric not null,
  khu_vuc text,
  n_mau integer not null default 0,
  khong_dat smallint not null default 0 check (khong_dat in (0,1)),
  ty_le_khong_dat numeric,
  diem_r numeric,
  xep_hang integer,
  nhom_uu_tien text check (nhom_uu_tien in ('Ưu tiên cao','Trung bình-cao','Trung bình','Thấp')),
  weights_version timestamptz,
  updated_at timestamptz default now()
);

alter table public.monitoring_points enable row level security;

drop policy if exists "Admin read monitoring_points" on public.monitoring_points;
create policy "Admin read monitoring_points"
  on public.monitoring_points
  for select
  using (
    (select role from profiles where id = auth.uid())::text = 'admin'
  );

drop policy if exists "Admin write monitoring_points" on public.monitoring_points;
create policy "Admin write monitoring_points"
  on public.monitoring_points
  for all
  using (
    (select role from profiles where id = auth.uid())::text = 'admin'
  )
  with check (
    (select role from profiles where id = auth.uid())::text = 'admin'
  );

-- ---------- 2. point_attributes (bảng đã có sẵn, chỉ thêm RLS) ----------
-- Không chứa dữ liệu định danh cá nhân (chỉ thuộc tính hạ tầng/GIS của
-- điểm lấy mẫu) nhưng vẫn giới hạn quyền đọc/ghi cho Admin để nhất quán
-- với các bảng nguồn khác của bộ tiêu chí.
drop policy if exists "Admin read point_attributes" on public.point_attributes;
create policy "Admin read point_attributes"
  on public.point_attributes
  for select
  using (
    (select role from profiles where id = auth.uid())::text = 'admin'
  );

drop policy if exists "Admin write point_attributes" on public.point_attributes;
create policy "Admin write point_attributes"
  on public.point_attributes
  for all
  using (
    (select role from profiles where id = auth.uid())::text = 'admin'
  )
  with check (
    (select role from profiles where id = auth.uid())::text = 'admin'
  );

-- ---------- 3. analysis_runs (bảng đã có sẵn, chỉ thêm RLS) ----------
drop policy if exists "Admin read analysis_runs" on public.analysis_runs;
create policy "Admin read analysis_runs"
  on public.analysis_runs
  for select
  using (
    (select role from profiles where id = auth.uid())::text = 'admin'
  );

drop policy if exists "Admin insert analysis_runs" on public.analysis_runs;
create policy "Admin insert analysis_runs"
  on public.analysis_runs
  for insert
  with check (
    (select role from profiles where id = auth.uid())::text = 'admin'
  );
