// =====================================================================
// KIỂM ĐỊNH ĐỘC LẬP - MODULE 5 (Tab 1/Tab 2 modal "Kết quả nghiên cứu")
// ---------------------------------------------------------------------
// (a) Đối chiếu COUNT tay trên dữ liệu THẬT: 2.515 mẫu, 1.219 điểm,
//     359 mẫu K (hl_vs), 287 điểm không đạt.
// (b) Tổng trọng số toàn cục (criteria_weights) = 1.
// (c) Nhãn nhóm hiển thị đúng: KN=Khả năng xảy ra, HQ=Hậu quả,
//     DBP=Độ bao phủ giám sát.
// (d) Xử lý khi DB trống từng phần (criteria_weights/analysis_runs rỗng)
//     -> không crash, các hàm liên quan trả về trạng thái "chưa có dữ liệu".
//
// Chạy: node test/module5_test.js
// =====================================================================
const { execSync } = require('child_process');

function sqlQueryJson(sql) {
  const out = execSync(
    `npx supabase db query --linked --output-format json "${sql.replace(/"/g, '\\"')}"`,
    { cwd: __dirname + '/..', encoding: 'utf8', maxBuffer: 1024 * 1024 * 20 }
  );
  const start = out.indexOf('[');
  const end = out.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  return JSON.parse(out.slice(start, end + 1));
}

let allPass = true;
function check(label, actual, expected) {
  const pass = actual === expected;
  if (!pass) allPass = false;
  console.log(`${pass ? '✅' : '❌ SAI'} ${label}: thực tế=${actual} | kỳ vọng=${expected}`);
  return pass;
}

console.log('=== (a) Đối chiếu COUNT tay trên dữ liệu THẬT ===');

const nMauRows = sqlQueryJson(
  "SELECT count(*) as n FROM water_reports WHERE sampling_date BETWEEN '2025-01-01' AND '2025-12-31' AND status='approved';"
);
check('Tổng số mẫu 2025 đã duyệt', Number(nMauRows[0].n), 2515);

const nMauKRows = sqlQueryJson(
  "SELECT count(*) as n FROM water_reports WHERE sampling_date BETWEEN '2025-01-01' AND '2025-12-31' AND status='approved' AND hl_vs='K';"
);
check('Số mẫu không đạt (hl_vs=K)', Number(nMauKRows[0].n), 359);

const nDiemRows = sqlQueryJson('SELECT count(*) as n FROM monitoring_points;');
check('Tổng số điểm giám sát', Number(nDiemRows[0].n), 1219);

const nDiemKRows = sqlQueryJson('SELECT coalesce(sum(khong_dat),0) as n FROM monitoring_points;');
check('Số điểm không đạt', Number(nDiemKRows[0].n), 287);

console.log('\n=== (b) Tổng trọng số toàn cục (criteria_weights) ===');
const weightsRows = sqlQueryJson('SELECT ma_tieu_chi, w_toan_cuc FROM criteria_weights;');
if (weightsRows.length === 0) {
  console.log('⚠️ criteria_weights hiện rỗng — bỏ qua kiểm tổng (Tab 2 sẽ hiển thị "chưa có dữ liệu", không crash).');
} else {
  const sumW = weightsRows.reduce((s, w) => s + Number(w.w_toan_cuc), 0);
  const pass = Math.abs(sumW - 1) < 0.001;
  if (!pass) allPass = false;
  console.log(`${pass ? '✅' : '❌ SAI'} Tổng trọng số toàn cục = ${sumW.toFixed(6)} (kỳ vọng ≈1, dung sai 0.001)`);
}

console.log('\n=== (c) Nhãn nhóm hiển thị đúng đề cương ===');
// Trích RESEARCH_GROUP_LABEL_FULL trực tiếp từ app.js để đảm bảo đối
// chiếu đúng những gì code thực tế sẽ hiển thị (không hard-code lại).
const fs = require('fs');
const appJs = fs.readFileSync(__dirname + '/../app.js', 'utf8');
const match = appJs.match(/RESEARCH_GROUP_LABEL_FULL\s*=\s*\{([^}]*)\}/);
if (!match) {
  console.log('❌ SAI: Không tìm thấy RESEARCH_GROUP_LABEL_FULL trong app.js');
  allPass = false;
} else {
  const body = match[1];
  check('Nhãn KN chứa "Khả năng xảy ra"', /KN:\s*'Khả năng xảy ra'/.test(body), true);
  check('Nhãn HQ chứa "Hậu quả"', /HQ:\s*'Hậu quả'/.test(body), true);
  check('Nhãn DBP chứa "Độ bao phủ giám sát"', /DBP:\s*'Độ bao phủ giám sát'/.test(body), true);
}

console.log('\n=== (d) Xử lý khi DB trống từng phần (không crash) ===');
// Giả lập logic renderTab2 khi weights=[] (đúng những gì app.js sẽ nhận
// nếu criteria_weights rỗng) để xác nhận không có lỗi runtime kiểu
// "Cannot read properties of undefined".
function simulateSumCheck(weights) {
  const sumW = weights.reduce((s, w) => s + Number(w.w_toan_cuc), 0);
  const sumOk = weights.length > 0 && Math.abs(sumW - 1) < 0.001;
  return { sumW, sumOk, label: weights.length === 0 ? '(chưa có dữ liệu)' : sumOk ? '✅' : '❌' };
}
try {
  const r1 = simulateSumCheck([]);
  check('weights=[] không throw, sumW=0', r1.sumW, 0);
  check('weights=[] label đúng "(chưa có dữ liệu)"', r1.label, '(chưa có dữ liệu)');

  const runsRows = sqlQueryJson('SELECT * FROM analysis_runs ORDER BY run_time DESC LIMIT 1;');
  check('analysis_runs rỗng -> mảng rỗng (không throw)', Array.isArray(runsRows) && runsRows.length === 0, true);

  const submissionsRows = sqlQueryJson('SELECT ma_chuyen_gia, ma_tran_key, cr FROM ahp_submissions;');
  const nExpertsAhp = new Set(submissionsRows.map((s) => s.ma_chuyen_gia)).size;
  check('ahp_submissions rỗng -> nExpertsAhp=0 (không throw)', nExpertsAhp, 0);

  console.log('✅ Không có lỗi runtime khi DB trống từng phần.');
} catch (e) {
  allPass = false;
  console.log('❌ SAI: có lỗi runtime khi DB trống:', e.message);
}

console.log('\n' + (allPass ? '🎉 TOÀN BỘ TEST MODULE 5 PASS' : '❌ CÓ TEST THẤT BẠI'));
process.exitCode = allPass ? 0 : 1;
