-- =====================================================================
-- MODULE 1 - KAMET: RLS Policies cho delphi_criteria & delphi_responses
-- ---------------------------------------------------------------------
-- delphi_criteria: metadata tiêu chí (không nhạy cảm) -> cho phép đọc
--   công khai (cần cho Module 2 - trang AHP không cần đăng nhập), nhưng
--   CHỈ admin mới được cập nhật (trang_thai, mqi, mdqi, qqi, vqi).
-- delphi_responses: chứa điểm số từng chuyên gia (ma_chuyen_gia) -> có
--   thể định danh chuyên gia -> CHỈ admin được đọc/ghi (không lộ ra lớp
--   công khai).
-- =====================================================================

-- ---------- delphi_criteria ----------
DROP POLICY IF EXISTS "Public read delphi_criteria" ON delphi_criteria;
CREATE POLICY "Public read delphi_criteria"
  ON delphi_criteria
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin update delphi_criteria" ON delphi_criteria;
CREATE POLICY "Admin update delphi_criteria"
  ON delphi_criteria
  FOR UPDATE
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid())::text = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid())::text = 'admin'
  );

-- ---------- delphi_responses ----------
DROP POLICY IF EXISTS "Admin read delphi_responses" ON delphi_responses;
CREATE POLICY "Admin read delphi_responses"
  ON delphi_responses
  FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid())::text = 'admin'
  );

DROP POLICY IF EXISTS "Admin insert delphi_responses" ON delphi_responses;
CREATE POLICY "Admin insert delphi_responses"
  ON delphi_responses
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid())::text = 'admin'
  );
