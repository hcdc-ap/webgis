// =====================================================================
// KIỂM ĐỊNH END-TO-END - MODULE 4 (Node -> stats_service /validate)
// ---------------------------------------------------------------------
// 1. Đọc 250 điểm mô phỏng đã seed (sql/validation_seed_test.sql) từ
//    Supabase qua CLI (quyền cao hơn anon, giống cách đã làm Module 1-3).
// 2. Map nhãn nhóm ưu tiên tiếng Việt (DB) -> mã ngắn theo hợp đồng JSON
//    Module 4 (cao|tb_cao|tb|thap).
// 3. Gọi TRỰC TIẾP stats_service (http://127.0.0.1:8000/validate) —
//    tương đương những gì route /api/validate của Node sẽ chuyển tiếp.
// 4. Đối chiếu kết quả có ý nghĩa thống kê đúng như thiết kế dữ liệu.
// 5. Dọn sạch dữ liệu giả khỏi Supabase.
//
// Chạy: node test/validation_test.js
// (Yêu cầu: stats_service đang chạy tại localhost:8000)
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

// Map nhãn tiếng Việt (monitoring_points, đúng CHECK constraint DB) sang
// mã ngắn theo hợp đồng JSON Module 4 — ĐÂY LÀ VIỆC server.js /api/validate
// PHẢI làm khi tổng hợp dữ liệu thật gửi sang stats_service.
const GROUP_LABEL_TO_CODE = {
  'Ưu tiên cao': 'cao',
  'Trung bình-cao': 'tb_cao',
  'Trung bình': 'tb',
  Thấp: 'thap',
};

async function main() {
  console.log('=== 1. Đọc 250 điểm mô phỏng từ monitoring_points + point_attributes ===');
  const points = sqlQueryJson(
    "SELECT mp.point_code, mp.khong_dat, mp.diem_r as \"R\", mp.nhom_uu_tien, pa.water_age_gio as \"KN01\" " +
      "FROM monitoring_points mp JOIN point_attributes pa ON pa.point_code = mp.point_code " +
      "WHERE mp.point_code LIKE 'VAL_P%';"
  );

  if (points.length === 0) {
    console.log('❌ Chưa seed dữ liệu test. Hãy chạy trước:');
    console.log('   npx supabase db query --linked -f sql/validation_seed_test.sql');
    process.exitCode = 1;
    return;
  }
  console.log(`Đã tải ${points.length} điểm (kỳ vọng 250).`);

  const payload = {
    points: points.map((p) => ({
      khong_dat: Number(p.khong_dat),
      R: Number(p.R),
      nhom_uu_tien: GROUP_LABEL_TO_CODE[p.nhom_uu_tien] || null,
      features: { KN01: Number(p.KN01) / 100 },
    })),
    alpha: 0.05,
    bootstrap_n: 1000,
    random_state: 42,
  };

  console.log('\n=== 2. Gọi stats_service /validate (localhost:8000) ===');
  const res = await fetch('http://127.0.0.1:8000/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.log(`❌ stats_service trả lỗi [${res.status}]: ${errText}`);
    console.log('Đảm bảo đã chạy: cd stats_service && uvicorn main:app --host 127.0.0.1 --port 8000');
    process.exitCode = 1;
    return;
  }

  const result = await res.json();

  console.log('\n=== 3. Đối chiếu kết quả (kỳ vọng có ý nghĩa thống kê rõ ràng) ===');
  let allPass = true;
  function check(label, cond) {
    if (!cond) allPass = false;
    console.log(`${cond ? '✅' : '❌ SAI'} ${label}`);
  }

  check('metadata.n_points = 250', result.metadata.n_points === 250);
  check(
    'metadata.n_khong_dat trong khoảng hợp lý (80-160)',
    result.metadata.n_khong_dat >= 80 && result.metadata.n_khong_dat <= 160
  );
  check('library_versions có đủ 5 thư viện', Object.keys(result.metadata.library_versions).length === 5);

  check('group_comparison.test.p_value < 0.05 (khác biệt rõ theo nhóm)', result.group_comparison.test.p_value < 0.05);
  check('trend_test.p_value < 0.05 (Cochran-Armitage có ý nghĩa)', result.group_comparison.trend_test.p_value < 0.05);

  check('logistic_univariate OR > 1 (R càng cao càng dễ không đạt)', result.logistic_univariate.result.OR > 1);
  check('logistic_univariate p < 0.05', result.logistic_univariate.result.p_value < 0.05);
  check(
    'logistic_univariate.OR_ci95 chứa giá trị thật ~54.6',
    result.logistic_univariate.result.OR_ci95[0] < 54.6 && result.logistic_univariate.result.OR_ci95[1] > 54.6
  );

  check('logistic_multivariate có biến KN01', !!result.logistic_multivariate.result.variables.KN01);

  check('roc_auc.auc.value > 0.6 (R phân biệt tốt)', result.roc_auc.auc.value > 0.6);
  check(
    'roc_auc.auc.ci95 hợp lệ (lo < value < hi)',
    result.roc_auc.auc.ci95[0] < result.roc_auc.auc.value && result.roc_auc.auc.value < result.roc_auc.auc.ci95[1]
  );
  check(
    'roc_auc.youden có threshold + Se/Sp',
    result.roc_auc.youden.threshold !== null && result.roc_auc.youden.sensitivity !== null
  );
  check(
    'roc_auc.confusion_matrix tổng = N',
    result.roc_auc.confusion_matrix.TP +
      result.roc_auc.confusion_matrix.FP +
      result.roc_auc.confusion_matrix.TN +
      result.roc_auc.confusion_matrix.FN ===
      250
  );
  check('mann_whitney p < 0.05 (R khác biệt rõ giữa đạt/không đạt)', result.roc_auc.mann_whitney.p_value < 0.05);
  check(
    'mann_whitney R_mean_khong_dat > R_mean_dat',
    result.roc_auc.mann_whitney.R_mean_khong_dat > result.roc_auc.mann_whitney.R_mean_dat
  );

  console.log('\nTóm tắt số liệu chính:');
  console.log(`  χ² = ${result.group_comparison.test.statistic.toFixed(3)}, p = ${result.group_comparison.test.p_display}`);
  console.log(
    `  OR đơn biến = ${result.logistic_univariate.result.OR.toFixed(2)} (KTC95%: ${result.logistic_univariate.result.OR_ci95
      .map((v) => v.toFixed(2))
      .join('-')})`
  );
  console.log(
    `  AUC = ${result.roc_auc.auc.value.toFixed(3)} (KTC95%: ${result.roc_auc.auc.ci95.map((v) => v.toFixed(3)).join('-')})`
  );
  console.log(
    `  Youden threshold = ${result.roc_auc.youden.threshold.toFixed(3)}, Se=${result.roc_auc.youden.sensitivity.toFixed(
      3
    )}, Sp=${result.roc_auc.youden.specificity.toFixed(3)}`
  );

  console.log('\n=== 4. Dọn sạch dữ liệu mô phỏng khỏi Supabase ===');
  try {
    execSync(
      `npx supabase db query --linked "DELETE FROM monitoring_points WHERE point_code LIKE 'VAL_P%'; DELETE FROM point_attributes WHERE point_code LIKE 'VAL_P%'; DELETE FROM criteria_weights WHERE ma_tieu_chi='KN01';"`,
      { cwd: __dirname + '/..', stdio: 'inherit' }
    );
    console.log('✅ Đã dọn sạch dữ liệu mô phỏng.');
  } catch (e) {
    console.log('⚠️ Lỗi khi dọn dẹp, hãy chạy tay lệnh DELETE tương ứng.');
  }

  console.log('\n' + (allPass ? '🎉 TOÀN BỘ TEST MODULE 4 (END-TO-END) PASS' : '❌ CÓ TEST THẤT BẠI'));
  process.exitCode = allPass ? 0 : 1;
}

main().catch((err) => {
  console.error('❌ LỖI:', err.message);
  process.exit(1);
});
