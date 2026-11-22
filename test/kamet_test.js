// =====================================================================
// KIỂM ĐỊNH ĐỘC LẬP - MODULE 1 KAMET
// ---------------------------------------------------------------------
// Script này trích xuất (copy) đúng các hàm tính toán KAMET từ app.js
// (percentileLinear, meanOf, computeKametStats) để chạy ngoài trình
// duyệt bằng Node, đối chiếu tay với kịch bản đã thiết kế trong
// sql/kamet_seed_test.sql. Dùng làm bằng chứng "công cụ đã được kiểm
// định" trước khi dùng dữ liệu Delphi thật.
//
// Chạy: node test/kamet_test.js
// =====================================================================
const fs = require('fs');
const path = require('path');

// ---- 1. Trích các hàm tính toán y hệt app.js (đồng bộ thủ công) ----
function percentileLinear(sortedArr, p) {
  const n = sortedArr.length;
  if (n === 0) return null;
  if (n === 1) return sortedArr[0];
  const idx = p * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedArr[lo];
  const frac = idx - lo;
  return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * frac;
}

function meanOf(arr) {
  if (!arr.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function computeKametStats(criteriaList, responsesList) {
  const byCriteria = {};
  responsesList.forEach((r) => {
    if (!byCriteria[r.ma_tieu_chi]) byCriteria[r.ma_tieu_chi] = [];
    byCriteria[r.ma_tieu_chi].push(r);
  });

  return criteriaList.map((crit) => {
    const rows = byCriteria[crit.ma_tieu_chi] || [];
    const validRows = rows.filter(
      (r) => r.can_thiet !== null && r.can_thiet !== undefined
    );

    if (validRows.length === 0) {
      return {
        ma_tieu_chi: crit.ma_tieu_chi,
        nhom: crit.nhom,
        vong_dung: null,
        n_chuyen_gia: 0,
        mdqi: null,
        mqi: null,
        qqi: null,
        vqi: null,
        de_xuat: 'vong_sau',
      };
    }

    const maxVong = Math.max(...validRows.map((r) => r.vong));
    const latestRows = validRows.filter((r) => r.vong === maxVong);
    const scores = latestRows.map((r) => r.can_thiet).sort((a, b) => a - b);

    const mdqi = percentileLinear(scores, 0.5);
    const mqi = meanOf(scores);
    const q1 = percentileLinear(scores, 0.25);
    const q3 = percentileLinear(scores, 0.75);
    const qqi = q1 !== null && q3 !== null ? (q3 - q1) / 2 : null;

    let vqi = null;
    const v1Map = {};
    const v2Map = {};
    validRows.forEach((r) => {
      if (r.vong === 1) v1Map[r.ma_chuyen_gia] = r.can_thiet;
      if (r.vong === 2) v2Map[r.ma_chuyen_gia] = r.can_thiet;
    });
    const pairedExperts = Object.keys(v1Map).filter((cg) => cg in v2Map);
    if (pairedExperts.length > 0) {
      const changed = pairedExperts.filter(
        (cg) => v1Map[cg] !== v2Map[cg]
      ).length;
      vqi = (changed / pairedExperts.length) * 100;
    }

    let de_xuat = 'vong_sau';
    if (mqi !== null && mqi < 3.5) {
      de_xuat = 'loai';
    } else if (
      mqi !== null &&
      mqi >= 3.5 &&
      qqi !== null &&
      qqi <= 0.5 &&
      vqi !== null &&
      vqi < 15
    ) {
      de_xuat = 'giu_lai';
    }

    return {
      ma_tieu_chi: crit.ma_tieu_chi,
      nhom: crit.nhom,
      vong_dung: maxVong,
      n_chuyen_gia: latestRows.length,
      mdqi,
      mqi,
      qqi,
      vqi,
      de_xuat,
    };
  });
}

module.exports = { percentileLinear, meanOf, computeKametStats };

// ---- 2. Chạy kiểm định nếu gọi trực tiếp (node test/kamet_test.js) ----
if (require.main === module) {
  const dataPath = path.join(__dirname, '..', '_kamet_test_data_utf8.json');
  const responses = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  const criteriaCodes = [
    ...new Set(responses.map((r) => r.ma_tieu_chi)),
  ].sort();
  const criteria = criteriaCodes.map((code) => ({
    ma_tieu_chi: code,
    nhom: responses.find((r) => r.ma_tieu_chi === code).nhom,
  }));

  const results = computeKametStats(criteria, responses);

  // Kỳ vọng đối chiếu tay (xem chú thích trong kamet_seed_test.sql)
  const expected = {
    KN01: 'giu_lai', KN02: 'giu_lai', KN06: 'giu_lai', KN07: 'giu_lai',
    KN08: 'giu_lai', HQ01: 'giu_lai', DBP01: 'giu_lai',
    KN09: 'loai', KN10: 'loai', KN11: 'loai',
    KN03: 'vong_sau', KN04: 'vong_sau', HQ02: 'vong_sau',
    KN05: 'vong_sau', HQ03: 'vong_sau', DBP02: 'vong_sau',
  };

  console.log('MÃ    | Vòng | N | Mdqi | Mqi  | Qqi  | Vqi(%) | Đề xuất  | Kỳ vọng | Khớp?');
  console.log('------|------|---|------|------|------|--------|----------|---------|------');
  let allPass = true;
  results
    .sort((a, b) => a.ma_tieu_chi.localeCompare(b.ma_tieu_chi))
    .forEach((r) => {
      const exp = expected[r.ma_tieu_chi];
      const pass = r.de_xuat === exp;
      if (!pass) allPass = false;
      console.log(
        `${r.ma_tieu_chi.padEnd(5)} | ${String(r.vong_dung).padEnd(4)} | ${r.n_chuyen_gia} | ` +
          `${(r.mdqi ?? 0).toFixed(2)} | ${(r.mqi ?? 0).toFixed(2)} | ${(r.qqi ?? 0).toFixed(2)} | ` +
          `${r.vqi === null ? '  —  ' : r.vqi.toFixed(1).padStart(5)} | ${r.de_xuat.padEnd(8)} | ${exp.padEnd(7)} | ${pass ? '✅' : '❌ SAI'}`
      );
    });

  console.log('\n' + (allPass ? '✅ TẤT CẢ 16 TIÊU CHÍ KHỚP KỲ VỌNG — THUẬT TOÁN ĐÃ ĐƯỢC KIỂM ĐỊNH.' : '❌ CÓ SAI LỆCH — CẦN KIỂM TRA LẠI THUẬT TOÁN.'));
  process.exit(allPass ? 0 : 1);
}
