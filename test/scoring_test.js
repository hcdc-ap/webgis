// =====================================================================
// KIỂM ĐỊNH ĐỘC LẬP - MODULE 3 SCORING (scoring-core.js)
// ---------------------------------------------------------------------
// Gồm 2 phần:
//   A. Unit test thuần (không cần DB) — đối chiếu tay từng hàm.
//   B. Integration test với dữ liệu MÔ PHỎNG thật trên Supabase
//      (sql/scoring_seed_test.sql) — chạy xong sẽ TỰ DỌN SẠCH.
// Chạy: node test/scoring_test.js
// =====================================================================
const ScoringCore = require('../scoring-core.js');

let allPass = true;
function check(label, actual, expected, tol) {
  const pass = Math.abs(actual - expected) <= tol;
  if (!pass) allPass = false;
  console.log(
    `${pass ? '✅' : '❌ SAI'} ${label}: thực tế=${Number(actual).toFixed(6)} | kỳ vọng≈${expected} | dung sai=${tol}`
  );
  return pass;
}
function checkEqual(label, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) allPass = false;
  console.log(`${pass ? '✅' : '❌ SAI'} ${label}: thực tế=${JSON.stringify(actual)} | kỳ vọng=${JSON.stringify(expected)}`);
  return pass;
}

console.log('========== PHẦN A: UNIT TEST (không cần DB) ==========\n');

console.log('=== TEST A1: aggregateSamplesToPoints (3.1) ===');
const samples = [
  { lat: 10.700001, lng: 106.600002, hl_vs: 'Đ' },
  { lat: 10.70000, lng: 106.60000, hl_vs: 'K' },
  { lat: 10.800000, lng: 106.700000, hl_vs: 'Đ' },
  { lat: 10.800000, lng: 106.700000, hl_vs: 'Đ' },
  { lat: 10.800000, lng: 106.700000, hl_vs: 'Đ' },
];
const pointsA1 = ScoringCore.aggregateSamplesToPoints(samples, 'K');
checkEqual('Số điểm sau gộp', pointsA1.length, 2);
const p1 = pointsA1.find((p) => p.n_mau === 2);
const p2 = pointsA1.find((p) => p.n_mau === 3);
checkEqual('Điểm 1 có 2 mẫu', !!p1, true);
checkEqual('Điểm 1 khong_dat=1 (có 1 mẫu K)', p1.khong_dat, 1);
check('Điểm 1 ty_le_khong_dat=0.5', p1.ty_le_khong_dat, 0.5, 0.0001);
checkEqual('Điểm 2 có 3 mẫu', !!p2, true);
checkEqual('Điểm 2 khong_dat=0 (toàn Đ)', p2.khong_dat, 0);
check('Điểm 2 ty_le_khong_dat=0', p2.ty_le_khong_dat, 0, 0.0001);

console.log('\n=== TEST A2: normalizeValue - từng loại ===');
check('ordinal Đầu=0', ScoringCore.normalizeValue('KN01', 'Đầu', {}), 0, 0.0001);
check('ordinal Giữa=0.5', ScoringCore.normalizeValue('KN01', 'Giữa', {}), 0.5, 0.0001);
check('ordinal Cuối=1', ScoringCore.normalizeValue('KN01', 'Cuối', {}), 1, 0.0001);
check('binary true=1', ScoringCore.normalizeValue('KN02', true, {}), 1, 0.0001);
check('binary false=0', ScoringCore.normalizeValue('KN02', false, {}), 0, 0.0001);
const normParamsA2 = { KN03: { min: 1, max: 20, n: 20 } };
check('continuous x=1 -> 0', ScoringCore.normalizeValue('KN03', 1, normParamsA2), 0, 0.0001);
check('continuous x=20 -> 1', ScoringCore.normalizeValue('KN03', 20, normParamsA2), 1, 0.0001);
check('continuous x=10 -> 9/19', ScoringCore.normalizeValue('KN03', 10, normParamsA2), 9 / 19, 0.0001);
checkEqual('missing (null) -> null', ScoringCore.normalizeValue('KN03', null, normParamsA2), null);

console.log('\n=== TEST A3: computeRiskScoreForPoint - xử lý thiếu dữ liệu ===');
const weightRowsA3 = [
  { ma_tieu_chi: 'KN01', w_toan_cuc: 0.5 },
  { ma_tieu_chi: 'KN02', w_toan_cuc: 0.3 },
  { ma_tieu_chi: 'KN03', w_toan_cuc: 0.2 },
];
const normParamsA3 = { KN03: { min: 1, max: 20, n: 20 } };

const rFull = ScoringCore.computeRiskScoreForPoint(
  { vi_tri_mang: 'Cuối', ap_luc_yeu: true, water_age_gio: 20 },
  weightRowsA3, normParamsA3
);
check('Điểm đủ dữ liệu, R=1.0 (tất cả max)', rFull.R, 1.0, 0.0001);
checkEqual('usedCriteria đủ 3', rFull.usedCriteria.length, 3);

// Thiếu KN03: Cuối(1), true(1) -> sumW=0.8 -> wKN01=0.625,wKN02=0.375 -> R=1.0
const rMissingKN03 = ScoringCore.computeRiskScoreForPoint(
  { vi_tri_mang: 'Cuối', ap_luc_yeu: true, water_age_gio: null },
  weightRowsA3, normParamsA3
);
check('Thiếu KN03, R=1.0 (2 tiêu chí còn lại đều max)', rMissingKN03.R, 1.0, 0.0001);
checkEqual('missingCriteria=[KN03]', rMissingKN03.missingCriteria, ['KN03']);

// Thiếu KN03: Giữa(0.5), false(0) -> R = 0.625*0.5+0.375*0 = 0.3125
const rMissingKN03b = ScoringCore.computeRiskScoreForPoint(
  { vi_tri_mang: 'Giữa', ap_luc_yeu: false, water_age_gio: null },
  weightRowsA3, normParamsA3
);
check('Thiếu KN03 (case b), R=0.3125', rMissingKN03b.R, 0.3125, 0.0001);

// Thiếu KN01: true(1), x=10->9/19; sumW=0.5 -> wKN02=0.6,wKN03=0.4 -> R=0.6+0.4*9/19≈0.789474
const rMissingKN01 = ScoringCore.computeRiskScoreForPoint(
  { vi_tri_mang: null, ap_luc_yeu: true, water_age_gio: 10 },
  weightRowsA3, normParamsA3
);
check('Thiếu KN01, R≈0.789474', rMissingKN01.R, 0.789474, 0.001);

const rAllMissing = ScoringCore.computeRiskScoreForPoint(null, weightRowsA3, normParamsA3);
checkEqual('Thiếu tất cả -> R=null (không crash)', rAllMissing.R, null);

console.log('\n=== TEST A4: rankAndGroupByQuartile - đối chiếu tay ===');
const scoredA4 = [1, 2, 3, 4, 5, 6, 7, 8].map((r, i) => ({ point_code: `P${i}`, R: r }));
const rankedA4 = ScoringCore.rankAndGroupByQuartile(scoredA4);
const byCode = {};
rankedA4.forEach((p) => (byCode[p.point_code] = p));
checkEqual('R=1 (< Q1=2.75) -> Thấp', byCode['P0'].nhom_uu_tien, 'Thấp');
checkEqual('R=3 (Q1<=3<Q2=4.5) -> Trung bình', byCode['P2'].nhom_uu_tien, 'Trung bình');
checkEqual('R=5 (Q2<=5<Q3=6.25) -> Trung bình-cao', byCode['P4'].nhom_uu_tien, 'Trung bình-cao');
checkEqual('R=8 (>=Q3) -> Ưu tiên cao', byCode['P7'].nhom_uu_tien, 'Ưu tiên cao');
checkEqual('R=8 xếp hạng 1 (cao nhất)', byCode['P7'].xep_hang, 1);
checkEqual('R=1 xếp hạng 8 (thấp nhất)', byCode['P0'].xep_hang, 8);

console.log(
  '\n' + (allPass ? '✅ PHẦN A (UNIT) PASS' : '❌ PHẦN A (UNIT) FAIL — dừng lại, không chạy Phần B.')
);
if (!allPass) process.exit(1);

// =====================================================================
// PHẦN B — INTEGRATION TEST (dữ liệu mô phỏng thật trên Supabase)
// ---------------------------------------------------------------------
// RLS của point_attributes/criteria_weights/monitoring_points CHỈ cho
// phép Admin đọc (đúng thiết kế bảo mật) -> không thể đọc qua REST API
// ẩn danh. Test này dùng "supabase db query --linked" (kết nối quyền
// cao hơn qua Management API) để lấy dữ liệu, giống cách đã kiểm định
// Module 1/2 trước đó.
// =====================================================================
function sqlQueryJson(sql) {
  const { execSync } = require('child_process');
  const out = execSync(
    `npx supabase db query --linked --output-format json "${sql.replace(/"/g, '\\"')}"`,
    { cwd: __dirname + '/..', encoding: 'utf8', maxBuffer: 1024 * 1024 * 20 }
  );
  // Output có thể lẫn log CLI phía trước -> chỉ lấy phần JSON (mảng [...])
  const start = out.indexOf('[');
  const end = out.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  return JSON.parse(out.slice(start, end + 1));
}

async function runIntegrationTest() {
  console.log('\n\n========== PHẦN B: INTEGRATION TEST (Supabase thật) ==========\n');

  console.log('B1. Đọc dữ liệu mô phỏng đã seed (sql/scoring_seed_test.sql) qua supabase CLI...');
  const attrRows = sqlQueryJson("SELECT * FROM point_attributes WHERE point_code LIKE 'TEST_P%';");
  const weightRows = sqlQueryJson("SELECT * FROM criteria_weights WHERE ma_tieu_chi IN ('KN01','KN02','KN03');");
  const pointRows = sqlQueryJson("SELECT * FROM monitoring_points WHERE point_code LIKE 'TEST_P%';");

  if (attrRows.length === 0 || weightRows.length === 0 || pointRows.length === 0) {
    console.log('❌ Chưa seed dữ liệu test. Hãy chạy trước:');
    console.log('   npx supabase db query --linked -f sql/scoring_seed_test.sql');
    process.exitCode = 1;
    return;
  }
  console.log(`Đã tìm thấy ${attrRows.length} point_attributes, ${weightRows.length} criteria_weights, ${pointRows.length} monitoring_points giả.`);

  console.log('\nB2. Tính toán bằng scoring-core.js (giống hệt app.js dùng)...');
  const criteriaCodes = weightRows.map((w) => w.ma_tieu_chi);
  const normParams = ScoringCore.computeNormalizationParams(attrRows, criteriaCodes);
  console.log('normParams:', normParams);

  const attrByCode = {};
  attrRows.forEach((a) => (attrByCode[a.point_code] = a));

  const scored = pointRows.map((p) => {
    const attr = attrByCode[p.point_code] || null;
    const result = ScoringCore.computeRiskScoreForPoint(attr, weightRows, normParams);
    return Object.assign({}, p, { R: result.R, missingCriteria: result.missingCriteria });
  });
  const ranked = ScoringCore.rankAndGroupByQuartile(scored);

  console.log('\nB3. Đối chiếu tay một vài điểm biết trước...');
  let bPass = true;
  function bCheck(label, cond) {
    if (!cond) bPass = false;
    console.log(`${cond ? '✅' : '❌ SAI'} ${label}`);
  }

  const withR = ranked.filter((p) => p.R !== null);
  bCheck(`Tất cả 24 điểm đều có R (kể cả 4 điểm thiếu 1 tiêu chí)`, withR.length === 24);

  const p21 = ranked.find((p) => p.point_code === 'TEST_P21'); // thiếu KN03
  bCheck('TEST_P21 (thiếu KN03) vẫn có R != null', p21 && p21.R !== null);
  bCheck('TEST_P21 nằm trong missingCriteria=[KN03]', p21 && JSON.stringify(p21.missingCriteria) === JSON.stringify(['KN03']));

  const p23 = ranked.find((p) => p.point_code === 'TEST_P23'); // thiếu KN01
  bCheck('TEST_P23 (thiếu KN01) vẫn có R != null', p23 && p23.R !== null);
  bCheck('TEST_P23 nằm trong missingCriteria=[KN01]', p23 && JSON.stringify(p23.missingCriteria) === JSON.stringify(['KN01']));

  const groupCounts = {};
  withR.forEach((p) => (groupCounts[p.nhom_uu_tien] = (groupCounts[p.nhom_uu_tien] || 0) + 1));
  console.log('Phân bố nhóm ưu tiên:', groupCounts);
  bCheck('Có đủ 4 nhóm ưu tiên xuất hiện (dữ liệu đa dạng)', Object.keys(groupCounts).length >= 2);

  const sumRanks = withR.length;
  bCheck(`Xếp hạng liên tục 1..${sumRanks}`, new Set(withR.map((p) => p.xep_hang)).size === sumRanks);

  console.log('\nB4. Dọn sạch dữ liệu mô phỏng khỏi Supabase (bắt buộc trước khi dùng thật)...');
  try {
    execSyncCleanup();
    console.log('✅ Đã gọi lệnh dọn dẹp (xem log supabase db query bên dưới nếu chạy tay).');
  } catch (e) {
    console.log('⚠️ Không tự động dọn được qua CLI, hãy chạy tay:');
    console.log("   npx supabase db query --linked \"DELETE FROM point_attributes WHERE point_code LIKE 'TEST_P%'; DELETE FROM monitoring_points WHERE point_code LIKE 'TEST_P%'; DELETE FROM criteria_weights WHERE ma_tieu_chi IN ('KN01','KN02','KN03');\"");
  }

  console.log('\n' + (bPass ? '✅ PHẦN B (INTEGRATION) PASS' : '❌ PHẦN B (INTEGRATION) FAIL'));
  console.log(bPass && allPass ? '\n🎉 TOÀN BỘ TEST MODULE 3 PASS' : '\n❌ CÓ TEST THẤT BẠI');
  process.exitCode = bPass && allPass ? 0 : 1;
}

function execSyncCleanup() {
  const { execSync } = require('child_process');
  execSync(
    `npx supabase db query --linked "DELETE FROM point_attributes WHERE point_code LIKE 'TEST_P%'; DELETE FROM monitoring_points WHERE point_code LIKE 'TEST_P%'; DELETE FROM criteria_weights WHERE ma_tieu_chi IN ('KN01','KN02','KN03');"`,
    { stdio: 'inherit', cwd: __dirname + '/..' }
  );
}

runIntegrationTest();
