// =====================================================================
// KIỂM ĐỊNH - TAB 1 (modal "KẾT QUẢ NGHIÊN CỨU"): sửa lỗi đếm "không đạt"
// ---------------------------------------------------------------------
// Trích xuất CHÍNH XÁC isSampleFail/isFailValue/countGroup từ app.js
// (không copy tay) và gọi thẳng REST API Supabase thật để xác nhận:
//   (a) Tổng "n không đạt" cộng các khu vực (maquan) = 359.
//   (b) Tổng "n không đạt" cộng các loại mẫu (loaimau_id) = 359.
//   (c) Cả 2 khớp với COUNT hl_vs='K' phía server (359).
//   (d) isSampleFail dùng đúng cột hl_vs, KHÔNG lẫn với field đang group.
//
// Chạy: node test/tab1_fail_count_test.js
// =====================================================================
const fs = require('fs');

const SUPABASE_URL = 'https://yjtbvlydphuvuebsyavh.supabase.co';
const APIKEY = 'sb_publishable_8LF17KEVZ3XqMyAnyA6S-Q_hCGqhA5v';

function extractFunctionSource(code, fnName) {
  const marker = `function ${fnName}(`;
  const idx = code.indexOf(marker);
  if (idx === -1) throw new Error(`Không tìm thấy hàm ${fnName} trong app.js`);
  let depth = 0;
  let i = code.indexOf('{', idx);
  for (; i < code.length; i++) {
    if (code[i] === '{') depth++;
    if (code[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return code.slice(idx, i + 1);
}

async function fetchAllRest(table, selectStr, extraQs) {
  let all = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;
  while (hasMore) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(selectStr)}${extraQs ? '&' + extraQs : ''}`;
    const res = await fetch(url, {
      headers: {
        apikey: APIKEY,
        Authorization: `Bearer ${APIKEY}`,
        Range: `${from}-${from + pageSize - 1}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`[${res.status}] ${table}: ${JSON.stringify(data)}`);
    all = all.concat(data);
    hasMore = data.length === pageSize;
    from += pageSize;
  }
  return all;
}

async function main() {
  const appJsCode = fs.readFileSync(__dirname + '/../app.js', 'utf8');

  console.log('=== 1. Trích xuất đúng source code isFailValue/isSampleFail/countGroup từ app.js ===');
  const isFailValueSrc = extractFunctionSource(appJsCode, 'isFailValue');
  const isSampleFailSrc = extractFunctionSource(appJsCode, 'isSampleFail');
  const countGroupSrc = extractFunctionSource(appJsCode, 'countGroup');
  console.log('✅ Đã trích xuất isFailValue, isSampleFail, countGroup (nguyên trạng, không copy tay).');

  // eval theo đúng thứ tự phụ thuộc: isFailValue -> isSampleFail -> countGroup
  const isFailValue = eval(`(${isFailValueSrc})`);
  const isSampleFail = eval(`(${isSampleFailSrc})`);
  const countGroup = eval(`(${countGroupSrc})`);

  console.log('\n=== 2. Kiểm tra định nghĩa isSampleFail/isFailValue đúng cột hl_vs ===');
  let allPass = true;
  function check(label, actual, expected) {
    const pass = actual === expected;
    if (!pass) allPass = false;
    console.log(`${pass ? '✅' : '❌ SAI'} ${label}: thực tế=${JSON.stringify(actual)} | kỳ vọng=${JSON.stringify(expected)}`);
  }

  check('isFailValue("K") = true', isFailValue('K'), true);
  check('isFailValue(" k ") = true (trim + uppercase)', isFailValue(' k '), true);
  check('isFailValue("Đ") = false', isFailValue('Đ'), false);
  check('isSampleFail({hl_vs:"K", maquan:"Đ"}) = true (không lẫn field khác)', isSampleFail({ hl_vs: 'K', maquan: 'Đ' }), true);
  check('isSampleFail({hl_vs:"Đ", maquan:"K"}) = false (KHÔNG được lẫn field maquan)', isSampleFail({ hl_vs: 'Đ', maquan: 'K' }), false);

  console.log('\n=== 3. Tải toàn bộ 2.515 mẫu 2025 (đã duyệt) từ Supabase thật ===');
  const extraQs = 'sampling_date=gte.2025-01-01&sampling_date=lte.2025-12-31&status=eq.approved';
  const samples = await fetchAllRest('water_reports', 'hl_vs,maquan,loaimau_id', extraQs);
  console.log(`Đã tải ${samples.length} mẫu (kỳ vọng 2515).`);
  check('Tổng số mẫu tải về', samples.length, 2515);

  console.log('\n=== 4. Đếm "không đạt" theo khu vực (maquan) bằng countGroup() thật ===');
  const byKhuVuc = countGroup(samples, 'maquan');
  console.log(byKhuVuc);
  const sumKhuVucK = Object.values(byKhuVuc).reduce((s, v) => s + v.k, 0);
  const sumKhuVucN = Object.values(byKhuVuc).reduce((s, v) => s + v.n, 0);
  check('Tổng n không đạt theo khu vực (cộng dồn)', sumKhuVucK, 359);
  check('Tổng N theo khu vực (cộng dồn)', sumKhuVucN, 2515);

  console.log('\n=== 5. Đếm "không đạt" theo loại mẫu (loaimau_id) bằng countGroup() thật ===');
  const byLoaiMau = countGroup(samples, 'loaimau_id');
  console.log(byLoaiMau);
  const sumLoaiMauK = Object.values(byLoaiMau).reduce((s, v) => s + v.k, 0);
  const sumLoaiMauN = Object.values(byLoaiMau).reduce((s, v) => s + v.n, 0);
  check('Tổng n không đạt theo loại mẫu (cộng dồn)', sumLoaiMauK, 359);
  check('Tổng N theo loại mẫu (cộng dồn)', sumLoaiMauN, 2515);

  console.log('\n=== 6. Đối chiếu với COUNT hl_vs=K phía server (nguồn sự thật độc lập) ===');
  const kRows = await fetchAllRest('water_reports', 'hl_vs', extraQs + '&hl_vs=eq.K');
  check('COUNT server hl_vs=K', kRows.length, 359);
  check('Ba nguồn nhất quán: sumKhuVucK === sumLoaiMauK === COUNT server', sumKhuVucK === sumLoaiMauK && sumLoaiMauK === kRows.length, true);

  console.log('\n' + (allPass ? '🎉 TOÀN BỘ TEST TAB1_FAIL_COUNT PASS' : '❌ CÓ TEST THẤT BẠI'));
  process.exitCode = allPass ? 0 : 1;
}

main().catch((e) => {
  console.error('LỖI:', e);
  process.exit(1);
});
