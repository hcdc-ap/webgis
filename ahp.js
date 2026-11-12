// =====================================================================
// MODULE 2 — Trang AHP cho chuyên gia (/ahp.html?expert=CG01)
// ---------------------------------------------------------------------
// Toàn bộ ma trận được SINH ĐỘNG từ delphi_criteria WHERE trang_thai=
// 'giu_lai' (không hard-code số lượng nhóm/tiêu chí). Mọi phép tính
// trọng số/CR dùng chung ahp-core.js (đã kiểm định qua test/ahp_test.js).
// =====================================================================
const IS_LOCAL_HOST = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const SUPABASE_URL = IS_LOCAL_HOST ? window.location.origin : 'https://yjtbvlydphuvuebsyavh.supabase.co';
const SUPABASE_KEY = IS_LOCAL_HOST ? 'local-proxy-key' : 'sb_publishable_8LF17KEVZ3XqMyAnyA6S-Q_hCGqhA5v';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const GROUP_LABEL = { KN: 'Khả năng (KN)', HQ: 'Hiệu quả (HQ)', DBP: 'DBP (Điểm mù/mật độ)' };

let currentExpert = null;
let hierarchy = null; // kết quả AHPCore.buildAhpHierarchy
// matrixState: { [ma_tran_key]: { items:[...], n, pairValues:{'i-j':signedValue}, result:{...} } }
let matrixState = {};

function getExpertFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('expert') || '').trim().toUpperCase();
}

function showFatalError(message) {
  const box = document.getElementById('ahp-error-box');
  box.style.display = 'block';
  box.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${message}`;
  document.getElementById('ahp-matrices-container').innerHTML = '';
  document.getElementById('ahp-guide').style.display = 'none';
  document.getElementById('ahp-overall-status').innerText = 'Không thể tiếp tục.';
  document.getElementById('btn-ahp-submit').disabled = true;
}

/**
 * Sinh danh sách lựa chọn Saaty có dấu (âm = vế phải quan trọng hơn) cho
 * <select>, dùng chung AHPCore.saatyOptions() để không lặp lại mô tả.
 */
function buildSignedSaatySelectOptions(labelLeft, labelRight) {
  const base = AHPCore.saatyOptions(); // [{value:1..9,label}]
  const opts = [];
  for (let k = 9; k >= 2; k--) {
    opts.push({ value: k, text: `${labelLeft} quan trọng hơn — mức ${k}` });
  }
  opts.push({ value: 1, text: 'Ngang nhau (mức 1)' });
  for (let k = 2; k <= 9; k++) {
    opts.push({ value: -k, text: `${labelRight} quan trọng hơn — mức ${k}` });
  }
  return opts;
}

async function initAhpPage() {
  currentExpert = getExpertFromQuery();
  if (!currentExpert) {
    return showFatalError(
      'Thiếu tham số <b>?expert=MÃ_CHUYÊN_GIA</b> trên đường dẫn. Vui lòng sử dụng đúng link đã được cấp.'
    );
  }
  document.getElementById('expert-code').innerText = currentExpert;

  // 1. Xác thực chuyên gia tồn tại & đang active (chống giả mạo link)
  const { data: expertRow, error: expertErr } = await supabaseClient
    .from('delphi_experts')
    .select('ma_chuyen_gia, ho_ten, active')
    .eq('ma_chuyen_gia', currentExpert)
    .maybeSingle();

  if (expertErr) {
    return showFatalError('Lỗi kết nối cơ sở dữ liệu: ' + expertErr.message);
  }
  if (!expertRow || expertRow.active !== true) {
    return showFatalError(
      `Mã chuyên gia <b>${currentExpert}</b> không hợp lệ hoặc đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên để được cấp lại link.`
    );
  }
  if (expertRow.ho_ten) {
    document.getElementById('expert-code').innerText = `${currentExpert} - ${expertRow.ho_ten}`;
  }

  // 2. Nạp bộ tiêu chí đã được KAMET giữ lại
  const { data: criteria, error: critErr } = await supabaseClient
    .from('delphi_criteria')
    .select('ma_tieu_chi, ten_tieu_chi, nhom, thu_tu')
    .eq('trang_thai', 'giu_lai')
    .order('thu_tu', { ascending: true });

  if (critErr) {
    return showFatalError('Không thể tải bộ tiêu chí: ' + critErr.message);
  }
  if (!criteria || criteria.length === 0) {
    return showFatalError(
      'Chưa có tiêu chí nào được KAMET chốt "giữ lại". Vui lòng quay lại sau khi Module 1 hoàn tất.'
    );
  }

  document.getElementById('ahp-guide').style.display = 'block';
  hierarchy = AHPCore.buildAhpHierarchy(criteria);
  renderAllMatrices();
}

/**
 * Dựng danh sách các ma trận cần hiển thị, dựa 100% trên hierarchy động:
 *  - GROUP: chỉ nếu hierarchy.needsGroupMatrix
 *  - Mỗi nhóm: chỉ nếu hierarchy.needsLocalMatrix[nhom]
 * Với các ca đặc biệt (1 nhóm / 1 tiêu chí), không sinh ma trận và trọng
 * số tương ứng mặc định = 1 (được xử lý trong AHPCore.computeGlobalWeights
 * ở bước tổng hợp Admin, ở đây chỉ cần KHÔNG bắt buộc gửi ma trận đó).
 */
function renderAllMatrices() {
  const container = document.getElementById('ahp-matrices-container');
  container.innerHTML = '';
  matrixState = {};

  if (hierarchy.needsGroupMatrix) {
    const groupItems = hierarchy.groups.map((g) => ({
      ma_tieu_chi: g,
      ten_tieu_chi: GROUP_LABEL[g] || g,
      nhom: 'GROUP',
    }));
    initMatrixState('GROUP', groupItems, 'So sánh giữa các NHÓM tiêu chí');
  }

  hierarchy.groups.forEach((g) => {
    if (hierarchy.needsLocalMatrix[g]) {
      const items = hierarchy.itemsByGroup[g];
      initMatrixState(
        g,
        items,
        `So sánh các tiêu chí con trong nhóm "${GROUP_LABEL[g] || g}"`
      );
    }
  });

  // Ghi chú các ca đặc biệt (không cần nhập) để chuyên gia không thắc mắc
  if (!hierarchy.needsGroupMatrix) {
    const note = document.createElement('div');
    note.className = 'ahp-single-note';
    note.innerHTML =
      '<i class="fa-solid fa-circle-info"></i> Chỉ còn 1 nhóm tiêu chí sau KAMET nên không cần so sánh giữa các nhóm (trọng số nhóm = 1).';
    container.appendChild(note);
  }
  hierarchy.groups.forEach((g) => {
    if (!hierarchy.needsLocalMatrix[g]) {
      const note = document.createElement('div');
      note.className = 'ahp-single-note';
      note.innerHTML = `<i class="fa-solid fa-circle-info"></i> Nhóm "${
        GROUP_LABEL[g] || g
      }" chỉ còn 1 tiêu chí sau KAMET nên không cần so sánh cặp (trọng số cục bộ = 1).`;
      container.appendChild(note);
    }
  });

  updateOverallSubmitState();
  loadExistingSubmissions();
}

function initMatrixState(key, items, title) {
  const n = items.length;
  matrixState[key] = {
    items: items,
    n: n,
    pairValues: {}, // '0-1' -> giá trị Saaty có dấu (âm nghĩa là vế sau lớn hơn)
    result: null,
  };
  renderMatrixCard(key, items, title);
}

function renderMatrixCard(key, items, title) {
  const container = document.getElementById('ahp-matrices-container');
  const card = document.createElement('div');
  card.className = 'ahp-matrix-card';
  card.id = `matrix-card-${key}`;

  let pairsHtml = '';
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const selId = `sel-${key}-${i}-${j}`;
      const optsHtml = buildSignedSaatySelectOptions(
        items[i].ten_tieu_chi || items[i].ma_tieu_chi,
        items[j].ten_tieu_chi || items[j].ma_tieu_chi
      )
        .map((o) => `<option value="${o.value}">${o.text}</option>`)
        .join('');

      pairsHtml += `
        <div class="ahp-pair-row">
          <span class="item-label">${items[i].ten_tieu_chi || items[i].ma_tieu_chi}</span>
          <select id="${selId}" onchange="onPairChange('${key}', ${i}, ${j}, this.value)">
            <option value="">-- Chọn mức so sánh --</option>
            ${optsHtml}
          </select>
          <span class="item-label">${items[j].ten_tieu_chi || items[j].ma_tieu_chi}</span>
        </div>`;
    }
  }

  card.innerHTML = `
    <h3><i class="fa-solid fa-layer-group"></i> ${title}</h3>
    <small style="color:#888">Mã ma trận: <b>${key}</b> · ${items.length} phần tử · cần nhập ${
    (items.length * (items.length - 1)) / 2
  } cặp so sánh</small>
    <div class="ahp-pairs">${pairsHtml}</div>
    <div class="ahp-cr-box" id="cr-box-${key}">Chưa nhập đủ dữ liệu để tính CR.</div>
  `;
  container.appendChild(card);
}

/**
 * Xử lý khi người dùng đổi 1 ô so sánh: lưu giá trị có dấu, tính lại
 * ma trận đầy đủ + trọng số + CR NGAY LẬP TỨC (thuần JS, dùng ahp-core.js).
 */
function onPairChange(key, i, j, rawValue) {
  const state = matrixState[key];
  if (!state) return;
  const v = rawValue === '' ? null : Number(rawValue);
  state.pairValues[`${i}-${j}`] = v;
  recomputeMatrix(key);
}

/**
 * Chuyển giá trị có dấu (vd: -5 nghĩa là vế j quan trọng hơn mức 5) thành
 * hệ số Saaty chuẩn a_ij (i so với j) dùng cho AHPCore.buildFullMatrix.
 */
function signedToSaaty(signedValue) {
  if (signedValue === null || signedValue === undefined) return null;
  if (signedValue > 0) return signedValue; // i quan trọng hơn j theo mức đó
  if (signedValue < 0) return 1 / Math.abs(signedValue); // j quan trọng hơn i
  return 1;
}

function recomputeMatrix(key) {
  const state = matrixState[key];
  const n = state.n;
  const crBox = document.getElementById(`cr-box-${key}`);

  // Kiểm tra đã nhập đủ n*(n-1)/2 cặp chưa
  const requiredPairs = (n * (n - 1)) / 2;
  let filledPairs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (state.pairValues[`${i}-${j}`] !== null && state.pairValues[`${i}-${j}`] !== undefined) {
        filledPairs++;
      }
    }
  }

  if (filledPairs < requiredPairs) {
    crBox.className = 'ahp-cr-box';
    crBox.style.background = '#fef9e7';
    crBox.style.color = '#b9770e';
    crBox.style.border = '1px solid #b9770e';
    crBox.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> Đã nhập ${filledPairs}/${requiredPairs} cặp so sánh.`;
    state.result = null;
    updateOverallSubmitState();
    return;
  }

  const matrix = AHPCore.buildFullMatrix(n, (i, j) =>
    signedToSaaty(state.pairValues[`${i}-${j}`])
  );
  const result = AHPCore.computeWeights(matrix);
  state.matrix = matrix;
  state.result = result;

  const crOk = result.cr <= 0.1;
  crBox.className = `ahp-cr-box ${crOk ? 'ahp-cr-ok' : 'ahp-cr-bad'}`;
  crBox.style.background = '';
  crBox.style.color = '';
  crBox.style.border = '';
  crBox.innerHTML = `
    <i class="fa-solid ${crOk ? 'fa-check-circle' : 'fa-triangle-exclamation'}"></i>
    CR = ${result.cr.toFixed(4)} (λmax=${result.lambdaMax.toFixed(3)}, CI=${result.ci.toFixed(4)})
    ${crOk ? '— Nhất quán, đạt yêu cầu (≤0,10).' : '— KHÔNG đạt (>0,10). Vui lòng điều chỉnh các cặp so sánh mâu thuẫn.'}
    <br><small>Trọng số: ${state.items
      .map((it, idx) => `${it.ten_tieu_chi || it.ma_tieu_chi}=${result.weights[idx].toFixed(3)}`)
      .join(' · ')}</small>
  `;

  updateOverallSubmitState();
}

/**
 * Cập nhật trạng thái chung + khóa/mở nút Gửi:
 * chỉ mở khi TẤT CẢ ma trận cần thiết đã có kết quả và CR <= 0.10.
 */
function updateOverallSubmitState() {
  const statusEl = document.getElementById('ahp-overall-status');
  const btn = document.getElementById('btn-ahp-submit');
  const keys = Object.keys(matrixState);

  if (keys.length === 0) {
    statusEl.innerText = 'Không có ma trận nào cần nhập (bộ tiêu chí quá đơn giản).';
    btn.disabled = false;
    return;
  }

  const notReady = keys.filter((k) => !matrixState[k].result);
  const badCr = keys.filter(
    (k) => matrixState[k].result && matrixState[k].result.cr > 0.1
  );

  if (notReady.length > 0) {
    statusEl.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> Còn ${notReady.length}/${keys.length} ma trận chưa nhập đủ.`;
    btn.disabled = true;
  } else if (badCr.length > 0) {
    statusEl.innerHTML = `<span style="color:#c0392b"><i class="fa-solid fa-ban"></i> Có ${badCr.length} ma trận CR&gt;0,10 (${badCr.join(
      ', '
    )}). Vui lòng điều chỉnh các cặp so sánh mâu thuẫn trước khi gửi.</span>`;
    btn.disabled = true;
  } else {
    statusEl.innerHTML =
      '<span style="color:#1e7e34"><i class="fa-solid fa-check-circle"></i> Tất cả ma trận đạt CR≤0,10. Có thể gửi kết quả.</span>';
    btn.disabled = false;
  }
}

/**
 * Nạp lại các lượt nộp trước đó của chính chuyên gia này (nếu có) để họ
 * có thể xem/sửa (theo đề bài: "cho phép chuyên gia sửa và nộp lại").
 */
async function loadExistingSubmissions() {
  const { data, error } = await supabaseClient
    .from('ahp_submissions')
    .select('ma_tran_key, items, matrix, weights, lambda_max, ci, cr')
    .eq('ma_chuyen_gia', currentExpert);

  if (error || !data) return; // RLS có thể chặn nếu chuyên gia bị vô hiệu; im lặng bỏ qua

  data.forEach((row) => {
    const state = matrixState[row.ma_tran_key];
    if (!state) return; // ma trận này không còn tồn tại trong hierarchy hiện tại

    // Khôi phục lại các lựa chọn dropdown từ ma trận đã lưu
    const savedMatrix = row.matrix;
    for (let i = 0; i < state.n; i++) {
      for (let j = i + 1; j < state.n; j++) {
        if (savedMatrix && savedMatrix[i] && savedMatrix[i][j] !== undefined) {
          const aij = savedMatrix[i][j];
          const signed = aij >= 1 ? Math.round(aij) : -Math.round(1 / aij);
          state.pairValues[`${i}-${j}`] = signed;
          const sel = document.getElementById(`sel-${row.ma_tran_key}-${i}-${j}`);
          if (sel) sel.value = String(signed);
        }
      }
    }
    recomputeMatrix(row.ma_tran_key);
  });
}

/**
 * Gửi (upsert) toàn bộ ma trận đã hoàn thành lên ahp_submissions.
 * Mỗi ma trận (GROUP/KN/HQ/DBP) là một dòng riêng, khóa duy nhất theo
 * (ma_chuyen_gia, ma_tran_key) -> chuyên gia sửa & gửi lại sẽ upsert đè.
 */
async function submitAhpAll() {
  const keys = Object.keys(matrixState);
  const payload = keys.map((key) => {
    const state = matrixState[key];
    return {
      ma_chuyen_gia: currentExpert,
      ma_tran_key: key,
      items: state.items.map((it) => ({ ma_tieu_chi: it.ma_tieu_chi, nhom: it.nhom })),
      matrix: state.matrix,
      weights: state.result.weights,
      lambda_max: state.result.lambdaMax,
      ci: state.result.ci,
      cr: state.result.cr,
    };
  });

  const btn = document.getElementById('btn-ahp-submit');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ĐANG GỬI...';

  try {
    const { error } = await supabaseClient
      .from('ahp_submissions')
      .upsert(payload, { onConflict: 'ma_chuyen_gia,ma_tran_key' });

    if (error) throw error;

    await Swal.fire({
      icon: 'success',
      title: 'Đã gửi thành công!',
      html: `Cảm ơn chuyên gia <b>${currentExpert}</b> đã hoàn thành khảo sát AHP (${keys.length} ma trận). Bạn có thể quay lại link này để chỉnh sửa nếu cần.`,
      confirmButtonColor: '#008b99',
    });
  } catch (err) {
    console.error('Lỗi gửi AHP:', err);
    Swal.fire({
      icon: 'error',
      title: 'Gửi thất bại',
      text: err.message || 'Vui lòng thử lại hoặc liên hệ quản trị viên.',
    });
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> GỬI KẾT QUẢ';
    updateOverallSubmitState();
  }
}

document.addEventListener('DOMContentLoaded', initAhpPage);
