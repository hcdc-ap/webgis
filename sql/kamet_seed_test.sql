-- =====================================================================
-- MODULE 1 - KAMET: Dữ liệu Delphi mẫu (8 chuyên gia, vòng 1 & 2)
-- Dùng để TEST ĐỘC LẬP thuật toán tính Mdqi/Mqi/Qqi/Vqi và quy tắc chốt
-- trang_thai trước khi nạp dữ liệu thật. Có thể xoá sạch bằng:
--   DELETE FROM delphi_responses WHERE ma_chuyen_gia LIKE 'CG0%';
-- ---------------------------------------------------------------------
-- Kịch bản thiết kế (để đối chiếu tay):
--  - GIỮ  (7 tiêu chí bắt buộc): KN01,KN02,KN06,KN07,KN08,HQ01,DBP01
--        -> Mqi=4.75 ; Qqi=0.25 ; Vqi=0%    => giu_lai
--  - LOẠI (3 tiêu chí): KN09,KN10,KN11
--        -> Mqi=2.375 (<3.5)                => loai
--  - VÒNG SAU do Qqi>0.5 (3 tiêu chí): KN03,KN04,HQ02
--        -> Mqi=4.0 ; Qqi=1.0               => vong_sau
--  - VÒNG SAU do Vqi>=15% (3 tiêu chí): KN05,HQ03,DBP02
--        -> Mqi(v2)=4.5 ; Qqi(v2)=0.5 ; Vqi=25% => vong_sau
-- =====================================================================

-- Dọn dữ liệu test cũ (nếu chạy lại)
DELETE FROM delphi_responses WHERE ma_chuyen_gia LIKE 'CG0%';

DO $$
DECLARE
  experts text[] := ARRAY['CG01','CG02','CG03','CG04','CG05','CG06','CG07','CG08'];
  giu_codes text[] := ARRAY['KN01','KN02','KN06','KN07','KN08','HQ01','DBP01'];
  loai_codes text[] := ARRAY['KN09','KN10','KN11'];
  qqi_codes text[] := ARRAY['KN03','KN04','HQ02'];
  vqi_codes text[] := ARRAY['KN05','HQ03','DBP02'];
  v1_giu int[] := ARRAY[5,5,5,4,5,4,5,5];
  v1_loai int[] := ARRAY[2,2,3,2,3,2,2,3];
  v1_qqi int[] := ARRAY[5,5,2,2,5,5,4,4];
  v1_vqi int[] := ARRAY[5,5,5,4,5,4,5,5];
  v2_vqi int[] := ARRAY[4,4,5,4,5,4,5,5];
  code text;
  i int;
  nhom_of text;
BEGIN
  -- GIỮ: cùng điểm ở 2 vòng
  FOREACH code IN ARRAY giu_codes LOOP
    SELECT nhom INTO nhom_of FROM delphi_criteria WHERE ma_tieu_chi = code;
    FOR i IN 1..8 LOOP
      INSERT INTO delphi_responses (ma_chuyen_gia, vong, ma_tieu_chi, nhom, can_thiet, phu_hop, kha_thi, kha_nang_do)
      VALUES (experts[i], 1, code, nhom_of, v1_giu[i], v1_giu[i], v1_giu[i], v1_giu[i]);
      INSERT INTO delphi_responses (ma_chuyen_gia, vong, ma_tieu_chi, nhom, can_thiet, phu_hop, kha_thi, kha_nang_do)
      VALUES (experts[i], 2, code, nhom_of, v1_giu[i], v1_giu[i], v1_giu[i], v1_giu[i]);
    END LOOP;
  END LOOP;

  -- LOẠI: điểm thấp, cùng cả 2 vòng
  FOREACH code IN ARRAY loai_codes LOOP
    SELECT nhom INTO nhom_of FROM delphi_criteria WHERE ma_tieu_chi = code;
    FOR i IN 1..8 LOOP
      INSERT INTO delphi_responses (ma_chuyen_gia, vong, ma_tieu_chi, nhom, can_thiet, phu_hop, kha_thi, kha_nang_do)
      VALUES (experts[i], 1, code, nhom_of, v1_loai[i], v1_loai[i], v1_loai[i], v1_loai[i]);
      INSERT INTO delphi_responses (ma_chuyen_gia, vong, ma_tieu_chi, nhom, can_thiet, phu_hop, kha_thi, kha_nang_do)
      VALUES (experts[i], 2, code, nhom_of, v1_loai[i], v1_loai[i], v1_loai[i], v1_loai[i]);
    END LOOP;
  END LOOP;

  -- VÒNG SAU (Qqi cao): điểm phân tán mạnh, cùng cả 2 vòng (Vqi=0% nhưng Qqi>0.5)
  FOREACH code IN ARRAY qqi_codes LOOP
    SELECT nhom INTO nhom_of FROM delphi_criteria WHERE ma_tieu_chi = code;
    FOR i IN 1..8 LOOP
      INSERT INTO delphi_responses (ma_chuyen_gia, vong, ma_tieu_chi, nhom, can_thiet, phu_hop, kha_thi, kha_nang_do)
      VALUES (experts[i], 1, code, nhom_of, v1_qqi[i], v1_qqi[i], v1_qqi[i], v1_qqi[i]);
      INSERT INTO delphi_responses (ma_chuyen_gia, vong, ma_tieu_chi, nhom, can_thiet, phu_hop, kha_thi, kha_nang_do)
      VALUES (experts[i], 2, code, nhom_of, v1_qqi[i], v1_qqi[i], v1_qqi[i], v1_qqi[i]);
    END LOOP;
  END LOOP;

  -- VÒNG SAU (Vqi cao): 2/8 chuyên gia (25%) đổi điểm giữa 2 vòng
  FOREACH code IN ARRAY vqi_codes LOOP
    SELECT nhom INTO nhom_of FROM delphi_criteria WHERE ma_tieu_chi = code;
    FOR i IN 1..8 LOOP
      INSERT INTO delphi_responses (ma_chuyen_gia, vong, ma_tieu_chi, nhom, can_thiet, phu_hop, kha_thi, kha_nang_do)
      VALUES (experts[i], 1, code, nhom_of, v1_vqi[i], v1_vqi[i], v1_vqi[i], v1_vqi[i]);
      INSERT INTO delphi_responses (ma_chuyen_gia, vong, ma_tieu_chi, nhom, can_thiet, phu_hop, kha_thi, kha_nang_do)
      VALUES (experts[i], 2, code, nhom_of, v2_vqi[i], v2_vqi[i], v2_vqi[i], v2_vqi[i]);
    END LOOP;
  END LOOP;
END $$;
