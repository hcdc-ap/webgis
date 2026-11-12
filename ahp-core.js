// =====================================================================
// MODULE 2 — AHP CORE (thuần JS, KHÔNG phụ thuộc DOM/Supabase)
// ---------------------------------------------------------------------
// File này là "một nguồn sự thật duy nhất" cho mọi phép tính AHP, được
// dùng chung bởi:
//   - ahp.js       (trang chuyên gia nhập ma trận, tính CR realtime)
//   - app.js       (trang Admin "Tổng hợp trọng số AHP")
//   - test/ahp_test.js (kiểm định bằng Node, đối chiếu Bảng 2.2 đề cương)
// UMD pattern: hoạt động cả trong trình duyệt (window.AHPCore) lẫn Node
// (module.exports), tránh hard-code hằng số RI hay công thức ở nhiều nơi.
// =====================================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AHPCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Random Index (Saaty) — HẰNG SỐ DUY NHẤT dùng ở mọi nơi cần RI.
  var RI_TABLE = {
    1: 0, 2: 0, 3: 0.58, 4: 0.9, 5: 1.12,
    6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49,
  };

  function getRI(n) {
    if (Object.prototype.hasOwnProperty.call(RI_TABLE, n)) return RI_TABLE[n];
    // n ngoài bảng (hiếm khi xảy ra, n rất lớn) -> lấy giá trị lớn nhất đã biết
    return RI_TABLE[10];
  }

  /**
   * Dựng ma trận so sánh cặp đầy đủ n×n từ các giá trị nửa TRÊN đường chéo.
   * getUpperValue(i, j) trả về a_ij (j>i); nửa dưới tự động = 1/a_ij.
   */
  function buildFullMatrix(n, getUpperValue) {
    var m = [];
    for (var i = 0; i < n; i++) {
      m.push(new Array(n).fill(1));
    }
    for (i = 0; i < n; i++) {
      for (var j = i + 1; j < n; j++) {
        var v = getUpperValue(i, j);
        if (!v || v <= 0) v = 1;
        m[i][j] = v;
        m[j][i] = 1 / v;
      }
    }
    return m;
  }

  /**
   * Tính trọng số + CR từ ma trận so sánh cặp vuông n×n (đã đủ 2 nửa).
   * Phương pháp CHUẨN theo đề bài: chuẩn hóa cột -> trung bình hàng.
   * @returns {{weights:number[], lambdaMax:number, ci:number, cr:number}}
   */
  function computeWeights(matrix) {
    var n = matrix.length;
    if (n === 0) return { weights: [], lambdaMax: null, ci: null, cr: null };
    if (n === 1) return { weights: [1], lambdaMax: 1, ci: 0, cr: 0 };

    var i, j;
    // 1. Tổng từng cột
    var colSums = new Array(n).fill(0);
    for (j = 0; j < n; j++) {
      for (i = 0; i < n; i++) colSums[j] += matrix[i][j];
    }

    // 2. Chuẩn hóa cột: ā_ij = a_ij / Σ_i a_ij
    var normalized = matrix.map(function (row) {
      return row.map(function (v, jj) {
        return v / colSums[jj];
      });
    });

    // 3. Trọng số w_i = trung bình cộng hàng i của ma trận chuẩn hóa
    var weights = normalized.map(function (row) {
      return row.reduce(function (s, v) { return s + v; }, 0) / n;
    });

    // 4. λmax = (1/n)·Σ_i (A·w)_i / w_i
    var Aw = matrix.map(function (row) {
      return row.reduce(function (s, v, jj) { return s + v * weights[jj]; }, 0);
    });
    var ratios = Aw.map(function (v, ii) {
      return weights[ii] !== 0 ? v / weights[ii] : 0;
    });
    var lambdaMax = ratios.reduce(function (s, v) { return s + v; }, 0) / n;

    // 5. CI = (λmax − n)/(n − 1); CR = CI/RI (n≤2 -> CR=0 vì RI=0)
    var ci = (lambdaMax - n) / (n - 1);
    var ri = getRI(n);
    var cr = ri === 0 ? 0 : ci / ri;

    return { weights: weights, lambdaMax: lambdaMax, ci: ci, cr: cr };
  }

  /**
   * Gộp NHIỀU ma trận (của nhiều chuyên gia) cho CÙNG một bộ items, bằng
   * trung bình nhân từng ô: a_ij_tổng = (∏_k a_ij^(k))^(1/m).
   * @param {number[][][]} matrices mảng các ma trận n×n cùng kích thước
   * @returns {number[][]} ma trận tổng hợp n×n
   */
  function aggregateMatricesGeometric(matrices) {
    if (!matrices || matrices.length === 0) return [];
    var m = matrices.length;
    var n = matrices[0].length;
    var result = [];
    for (var i = 0; i < n; i++) {
      var row = [];
      for (var j = 0; j < n; j++) {
        var product = 1;
        for (var k = 0; k < m; k++) {
          product *= matrices[k][i][j];
        }
        row.push(Math.pow(product, 1 / m));
      }
      result.push(row);
    }
    return result;
  }

  /**
   * Dựng cây phân cấp AHP ĐỘNG từ danh sách tiêu chí đã được KAMET giữ lại
   * (trang_thai='giu_lai'). KHÔNG hard-code số lượng nhóm/tiêu chí.
   * Xử lý đúng các ca đặc biệt:
   *   - Chỉ còn 1 nhóm  -> bỏ ma trận GROUP, trọng số nhóm đó = 1.
   *   - 1 nhóm chỉ có 1 tiêu chí con -> bỏ ma trận nhóm, trọng số cục bộ = 1.
   * @param {Array<{ma_tieu_chi:string, nhom:string, ten_tieu_chi?:string}>} criteriaGiuLai
   * @returns {{
   *   groups: string[],                 // các nhóm còn tồn tại, theo thứ tự xuất hiện
   *   needsGroupMatrix: boolean,        // true nếu >=2 nhóm
   *   itemsByGroup: Object<string,Array>,// tiêu chí con của từng nhóm
   *   needsLocalMatrix: Object<string,boolean> // true nếu nhóm có >=2 tiêu chí
   * }}
   */
  function buildAhpHierarchy(criteriaGiuLai) {
    var itemsByGroup = {};
    var groupOrder = [];
    (criteriaGiuLai || []).forEach(function (c) {
      if (!itemsByGroup[c.nhom]) {
        itemsByGroup[c.nhom] = [];
        groupOrder.push(c.nhom);
      }
      itemsByGroup[c.nhom].push(c);
    });

    var needsLocalMatrix = {};
    groupOrder.forEach(function (g) {
      needsLocalMatrix[g] = itemsByGroup[g].length >= 2;
    });

    return {
      groups: groupOrder,
      needsGroupMatrix: groupOrder.length >= 2,
      itemsByGroup: itemsByGroup,
      needsLocalMatrix: needsLocalMatrix,
    };
  }

  /**
   * Tính TRỌNG SỐ TOÀN CỤC = trọng số nhóm × trọng số cục bộ, đảm bảo
   * tổng = 1 (sai số < 0.001). Xử lý đúng ca đặc biệt (1 nhóm / 1 tiêu chí
   * trong nhóm -> hệ số tương ứng = 1).
   * @param {{groups:string[], itemsByGroup:Object}} hierarchy từ buildAhpHierarchy
   * @param {Object<string,number>} groupWeights {nhom: w_nhom} (rỗng nếu 1 nhóm)
   * @param {Object<string, number[]>} localWeightsByGroup {nhom: [w_cuc_bo,...] theo đúng thứ tự itemsByGroup[nhom]}
   * @returns {Array<{ma_tieu_chi, nhom, w_nhom, w_cuc_bo, w_toan_cuc}>}
   */
  function computeGlobalWeights(hierarchy, groupWeights, localWeightsByGroup) {
    var out = [];
    var singleGroup = hierarchy.groups.length === 1;

    hierarchy.groups.forEach(function (g) {
      var wGroup = singleGroup ? 1 : (groupWeights[g] !== undefined ? groupWeights[g] : 0);
      var items = hierarchy.itemsByGroup[g];
      var singleItem = items.length === 1;
      var localWeights = singleItem ? [1] : (localWeightsByGroup[g] || []);

      items.forEach(function (item, idx) {
        var wLocal = singleItem ? 1 : (localWeights[idx] !== undefined ? localWeights[idx] : 0);
        out.push({
          ma_tieu_chi: item.ma_tieu_chi,
          nhom: g,
          w_nhom: wGroup,
          w_cuc_bo: wLocal,
          w_toan_cuc: wGroup * wLocal,
        });
      });
    });

    return out;
  }

  /**
   * Danh sách lựa chọn thang đo Saaty 1-9 dùng chung cho UI (radio/slider),
   * tránh lặp lại chuỗi mô tả ở nhiều nơi.
   */
  function saatyOptions() {
    return [
      { value: 1, label: '1 - Quan trọng ngang nhau' },
      { value: 2, label: '2 - Trung gian (1-3)' },
      { value: 3, label: '3 - Quan trọng hơn một chút' },
      { value: 4, label: '4 - Trung gian (3-5)' },
      { value: 5, label: '5 - Quan trọng hơn nhiều' },
      { value: 6, label: '6 - Trung gian (5-7)' },
      { value: 7, label: '7 - Rất quan trọng hơn' },
      { value: 8, label: '8 - Trung gian (7-9)' },
      { value: 9, label: '9 - Vô cùng quan trọng hơn' },
    ];
  }

  return {
    RI_TABLE: RI_TABLE,
    getRI: getRI,
    buildFullMatrix: buildFullMatrix,
    computeWeights: computeWeights,
    aggregateMatricesGeometric: aggregateMatricesGeometric,
    buildAhpHierarchy: buildAhpHierarchy,
    computeGlobalWeights: computeGlobalWeights,
    saatyOptions: saatyOptions,
  };
});
