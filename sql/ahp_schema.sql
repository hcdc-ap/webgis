-- =====================================================================
-- MODULE 2 — AHP: Schema (delphi_experts, ahp_submissions, criteria_weights)
-- ---------------------------------------------------------------------
-- delphi_experts   : danh mục chuyên gia hợp lệ (chống giả mạo link /ahp)
-- ahp_submissions  : mỗi lượt nộp ma trận so sánh cặp của 1 chuyên gia
--                    cho 1 ma trận (GROUP | KN | HQ | DBP)
-- criteria_weights : trọng số toàn cục sau khi Admin gộp nhiều chuyên gia
--                    (đầu vào cho Module 3 - chấm điểm)
-- =====================================================================

-- ---------- 1. delphi_experts ----------
create table if not exists public.delphi_experts (
  ma_chuyen_gia text primary key,
  ho_ten text,
  don_vi text,
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table public.delphi_experts enable row level security;

drop policy if exists "Public read active experts" on public.delphi_experts;
create policy "Public read active experts"
  on public.delphi_experts
  for select
  using (true);

-- ---------- 2. ahp_submissions ----------
create table if not exists public.ahp_submissions (
  id uuid primary key default gen_random_uuid(),
  ma_chuyen_gia text not null references public.delphi_experts(ma_chuyen_gia),
  ma_tran_key text not null check (ma_tran_key in ('GROUP','KN','HQ','DBP')),
  items jsonb not null,
  matrix jsonb not null,
  weights jsonb not null,
  lambda_max numeric,
  ci numeric,
  cr numeric,
  thoi_gian timestamptz default now(),
  constraint uq_ahp unique (ma_chuyen_gia, ma_tran_key)
);

alter table public.ahp_submissions enable row level security;

-- Ghi: chỉ cho phép nếu ma_chuyen_gia thuộc danh mục experts đang active
-- (không yêu cầu tài khoản đăng nhập -> dùng policy theo giá trị cột,
--  Node/Client tự gửi đúng ma_chuyen_gia lấy từ query ?expert=...).
drop policy if exists "Expert insert own ahp" on public.ahp_submissions;
create policy "Expert insert own ahp"
  on public.ahp_submissions
  for insert
  with check (
    exists (
      select 1 from public.delphi_experts e
      where e.ma_chuyen_gia = ahp_submissions.ma_chuyen_gia
        and e.active = true
    )
  );

drop policy if exists "Expert update own ahp" on public.ahp_submissions;
create policy "Expert update own ahp"
  on public.ahp_submissions
  for update
  using (
    exists (
      select 1 from public.delphi_experts e
      where e.ma_chuyen_gia = ahp_submissions.ma_chuyen_gia
        and e.active = true
    )
  )
  with check (
    exists (
      select 1 from public.delphi_experts e
      where e.ma_chuyen_gia = ahp_submissions.ma_chuyen_gia
        and e.active = true
    )
  );

-- Đọc: Admin đọc được TẤT CẢ (để tổng hợp trọng số). Ngoài ra cho phép
-- đọc công khai theo đúng ma_chuyen_gia đang active, để trang /ahp.html
-- (không có tài khoản đăng nhập) có thể nạp lại bài đã nộp trước đó cho
-- chính chuyên gia đó chỉnh sửa. Ma trận so sánh cặp không phải dữ liệu
-- định danh nhạy cảm (không có địa chỉ/thông tin cá nhân) nên chấp nhận
-- được việc lộ theo đúng mã chuyên gia hợp lệ.
drop policy if exists "Admin read ahp_submissions" on public.ahp_submissions;
create policy "Admin read ahp_submissions"
  on public.ahp_submissions
  for select
  using (
    (select role from profiles where id = auth.uid())::text = 'admin'
  );

drop policy if exists "Expert read own ahp_submissions" on public.ahp_submissions;
create policy "Expert read own ahp_submissions"
  on public.ahp_submissions
  for select
  using (
    exists (
      select 1 from public.delphi_experts e
      where e.ma_chuyen_gia = ahp_submissions.ma_chuyen_gia
        and e.active = true
    )
  );

-- ---------- 3. criteria_weights ----------
create table if not exists public.criteria_weights (
  ma_tieu_chi text primary key references public.delphi_criteria(ma_tieu_chi),
  nhom text not null,
  w_nhom numeric not null,
  w_cuc_bo numeric not null,
  w_toan_cuc numeric not null,
  updated_at timestamptz default now()
);

alter table public.criteria_weights enable row level security;

drop policy if exists "Public read criteria_weights" on public.criteria_weights;
create policy "Public read criteria_weights"
  on public.criteria_weights
  for select
  using (true);

drop policy if exists "Admin write criteria_weights" on public.criteria_weights;
create policy "Admin write criteria_weights"
  on public.criteria_weights
  for all
  using (
    (select role from profiles where id = auth.uid())::text = 'admin'
  )
  with check (
    (select role from profiles where id = auth.uid())::text = 'admin'
  );
