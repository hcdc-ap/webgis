// =====================================================================
// KIỂM ĐỊNH ĐỘC LẬP - MODULE 2 AHP (ahp-core.js)
// ---------------------------------------------------------------------
// Đối chiếu tay với ví dụ Bảng 2.2 của đề cương:
//   A = [[1,   3,   5  ],
//        [1/3, 1,   3  ],
//        [1/5, 1/3, 1  ]]
//   Kỳ vọng: w ≈ (0.633, 0.261, 0.106); λmax ≈ 3.038; CR ≈ 0.033
//
// Chạy: node test/ahp_test.js
// =====================================================================
const AHPCore = require('../ahp-core.js');

let allPass = true;
function check(label, actual, expected, tol) {
  const pass = Math.abs(actual - expected) <= tol;
  if (!pass) allPass = false;
  console.log(
    `${pass ? '✅' : '❌ SAI'} ${label}: thực tế=${actual.toFixed(4)} | kỳ vọng≈${expected} | dung sai=${tol}`
  );
  return pass;
}

console.log('=== TEST 1: Ma trận Bảng 2.2 (3x3) ===');
const A = [
  [1, 3, 5],
  [1 / 3, 1, 3],
  [1 / 5, 1 / 3, 1],
];
const r1 = AHPCore.computeWeights(A);
console.log('w =', r1.weights.map((w) => w.toFixed(4)));
check('w1', r1.weights[0], 0.633, 0.01);
check('w2', r1.weights[1], 0.261, 0.01);
check('w3', r1.weights[2], 0.106, 0.01);
check('lambdaMax', r1.lambdaMax, 3.038, 0.01);
check('CR', r1.cr, 0.033, 0.005);
console.log('Tổng trọng số =', r1.weights.reduce((s, v) => s + v, 0).toFixed(6));

console.log('\n=== TEST 2: buildFullMatrix từ nửa trên đường chéo ===');
// Cùng ví dụ trên nhưng dựng từ a12=3, a13=5, a23=3 (giống Bảng 2.2)
const upperVals = { '0,1': 3, '0,2': 5, '1,2': 3 };
const built = AHPCore.buildFullMatrix(3, (i, j) => upperVals[`${i},${j}`]);
const r2 = AHPCore.computeWeights(built);
check('buildFullMatrix w1', r2.weights[0], 0.633, 0.01);
check('buildFullMatrix CR', r2.cr, 0.033, 0.005);

console.log('\n=== TEST 3: Ca đặc biệt n=1 (chỉ 1 tiêu chí / 1 nhóm) ===');
const r3 = AHPCore.computeWeights([[1]]);
check('n=1 weight=1', r3.weights[0], 1, 0.0001);
check('n=1 CR=0', r3.cr, 0, 0.0001);

console.log('\n=== TEST 4: Ca đặc biệt n=2 (RI=0 -> CR luôn = 0) ===');
const m2 = AHPCore.buildFullMatrix(2, () => 5);
const r4 = AHPCore.computeWeights(m2);
check('n=2 CR=0', r4.cr, 0, 0.0001);
check('n=2 w1', r4.weights[0], 5 / 6, 0.001);

console.log('\n=== TEST 5: Ma trận hoàn toàn nhất quán (CR=0) ===');
// a=2,b=4,c=2 (b=a*c) -> nhất quán tuyệt đối
const consistent = AHPCore.buildFullMatrix(3, (i, j) => {
  if (i === 0 && j === 1) return 2;
  if (i === 0 && j === 2) return 8;
  if (i === 1 && j === 2) return 4;
  return 1;
});
const r5 = AHPCore.computeWeights(consistent);
check('Ma trận nhất quán CR≈0', r5.cr, 0, 0.001);
check('Ma trận nhất quán lambdaMax=n', r5.lambdaMax, 3, 0.001);

console.log('\n=== TEST 6: aggregateMatricesGeometric (gộp 2 chuyên gia) ===');
// CG1: a12=2 ; CG2: a12=8 -> trung bình nhân = sqrt(2*8) = 4
const expertA = AHPCore.buildFullMatrix(2, () => 2);
const expertB = AHPCore.buildFullMatrix(2, () => 8);
const agg = AHPCore.aggregateMatricesGeometric([expertA, expertB]);
check('Trung bình nhân a12', agg[0][1], 4, 0.0001);
check('Trung bình nhân a21 = 1/4', agg[1][0], 0.25, 0.0001);

console.log('\n=== TEST 7: buildAhpHierarchy - ca đặc biệt data-driven ===');
// Ca A: 3 nhóm, mỗi nhóm nhiều tiêu chí (bình thường)
const critNormal = [
  { ma_tieu_chi: 'KN01', nhom: 'KN' },
  { ma_tieu_chi: 'KN02', nhom: 'KN' },
  { ma_tieu_chi: 'HQ01', nhom: 'HQ' },
  { ma_tieu_chi: 'HQ02', nhom: 'HQ' },
  { ma_tieu_chi: 'DBP01', nhom: 'DBP' },
];
const hNormal = AHPCore.buildAhpHierarchy(critNormal);
console.log('groups:', hNormal.groups, '| needsGroupMatrix:', hNormal.needsGroupMatrix);
console.log('needsLocalMatrix:', hNormal.needsLocalMatrix);
if (hNormal.groups.length !== 3) { allPass = false; console.log('❌ SAI: kỳ vọng 3 nhóm'); } else console.log('✅ 3 nhóm đúng');
if (hNormal.needsGroupMatrix !== true) { allPass = false; console.log('❌ SAI: cần ma trận GROUP'); } else console.log('✅ needsGroupMatrix=true đúng');
if (hNormal.needsLocalMatrix.DBP !== false) { allPass = false; console.log('❌ SAI: DBP chỉ 1 tiêu chí -> không cần ma trận'); } else console.log('✅ DBP (1 tiêu chí) không cần ma trận cục bộ');

// Ca B: chỉ còn 1 nhóm (các nhóm khác đã bị KAMET loại hết)
const critSingleGroup = [
  { ma_tieu_chi: 'KN01', nhom: 'KN' },
  { ma_tieu_chi: 'KN02', nhom: 'KN' },
];
const hSingle = AHPCore.buildAhpHierarchy(critSingleGroup);
if (hSingle.needsGroupMatrix !== false) { allPass = false; console.log('❌ SAI: 1 nhóm không cần ma trận GROUP'); } else console.log('✅ Chỉ 1 nhóm -> bỏ ma trận GROUP');

console.log('\n=== TEST 8: computeGlobalWeights - tổng = 1, ca đặc biệt ===');
const gw = AHPCore.computeGlobalWeights(
  hNormal,
  { KN: 0.5, HQ: 0.3, DBP: 0.2 },
  { KN: [0.7, 0.3], HQ: [0.6, 0.4] } // DBP có 1 tiêu chí -> tự động w_cuc_bo=1
);
console.log(gw);
const sumGlobal = gw.reduce((s, r) => s + r.w_toan_cuc, 0);
check('Tổng trọng số toàn cục = 1', sumGlobal, 1, 0.001);
const dbpRow = gw.find((r) => r.ma_tieu_chi === 'DBP01');
check('DBP01 w_cuc_bo=1 (1 tiêu chí trong nhóm)', dbpRow.w_cuc_bo, 1, 0.0001);
check('DBP01 w_toan_cuc = w_nhom', dbpRow.w_toan_cuc, 0.2, 0.0001);

console.log(
  '\n' +
    (allPass
      ? '✅ TẤT CẢ TEST KHỚP KỲ VỌNG — AHP-CORE ĐÃ ĐƯỢC KIỂM ĐỊNH.'
      : '❌ CÓ SAI LỆCH — CẦN KIỂM TRA LẠI ahp-core.js.')
);
process.exit(allPass ? 0 : 1);
