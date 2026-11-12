// =====================================================================
// MODULE 3 — SCORING CORE (thuần JS, KHÔNG phụ thuộc DOM/Supabase)
// ---------------------------------------------------------------------
// "Một nguồn sự thật duy nhất" cho:
//   3.1 Gộp mẫu (water_reports) -> điểm (monitoring_points)
//   3.2 Chuẩn hóa tiêu chí điểm (point_attributes) về [0-1]
//   3.3 Tính điểm nguy cơ R + xếp hạng tứ phân vị
// Dùng chung bởi app.js (trang Admin) và test/scoring_test.js (Node).
// UMD pattern giống ahp-core.js.
// =====================================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ScoringCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // -------------------------------------------------------------------
  // 3.1 GỘP MẪU -> ĐIỂM
  // -------------------------------------------------------------------
  function roundTo5(x) {
    return Math.round(Number(x) * 100000) / 100000;
  }

  function makePointCode(lat, lng) {
    return roundTo5(lat).toFixed(5) + '_' + roundTo5(lng).toFixed(5);
  }

  /**
   * Gộp danh sách mẫu nước (đã lọc sẵn theo năm/status/lat-lng hợp lệ ở
   * phía gọi) thành danh sách điểm duy nhất.
   * @param {Array<{lat, lng, hl_vs, maphuong_temp?}>} samples
   * @param {string} khongDatValue giá trị hl_vs coi là "không đạt" (vd 'K')
   * @returns {Array<{point_code, lat, lng, khu_vuc, n_mau, khong_dat, ty_le_khong_dat}>}
   */
  function aggregateSamplesToPoints(samples, khongDatValue) {
    var byPoint = {};
    (samples || []).forEach(function (s) {
      if (s.lat === null || s.lat === undefined) return;
      if (s.lng === null || s.lng === undefined) return;
      var code = makePointCode(s.lat, s.lng);
      if (!byPoint[code]) {
        byPoint[code] = {
          point_code: code,
          lat: roundTo5(s.lat),
          lng: roundTo5(s.lng),
          khu_vuc: s.maphuong_temp || s.ward_commune || null,
          n_mau: 0,
          n_khong_dat: 0,
        };
      }
      byPoint[code].n_mau += 1;
      if (s.hl_vs === khongDatValue) byPoint[code].n_khong_dat += 1;
    });

    return Object.keys(byPoint).map(function (code) {
      var p = byPoint[code];
      return {
        point_code: p.point_code,
        lat: p.lat,
        lng: p.lng,
        khu_vuc: p.khu_vuc,
        n_mau: p.n_mau,
        khong_dat: p.n_khong_dat >= 1 ? 1 : 0,
        ty_le_khong_dat: p.n_mau > 0 ? p.n_khong_dat / p.n_mau : 0,
      };
    });
  }

  // -------------------------------------------------------------------
  // 3.2 BẢNG ÁNH XẠ TIÊU CHÍ -> CỘT point_attributes -> KIỂU CHUẨN HÓA
  // ---------------------------------------------------------------------
  // "type" quyết định cách chuẩn hóa về [0-1] (càng cao = càng nguy cơ):
  //   'ordinal'    : tra cứu ordinalMap (vd Đầu/Giữa/Cuối -> 0/0.5/1)
  //   'binary'     : cột boolean, true=1 / false=0
  //   'binary_or'  : OR nhiều cột boolean (vd KN08 gộp gan_o_nhiem + xam_nhap_man)
  //   'continuous' : (x-min)/(max-min) trên toàn tập điểm có dữ liệu
  // HẰNG SỐ DUY NHẤT — mọi nơi cần bảng ánh xạ đều import từ đây.
  // -------------------------------------------------------------------
  var CRITERIA_MAP = {
    KN01: { column: 'vi_tri_mang', type: 'ordinal', ordinalMap: { 'Đầu': 0, 'Giữa': 0.5, 'Cuối': 1 } },
    KN02: { column: 'ap_luc_yeu', type: 'binary' },
    KN03: { column: 'water_age_gio', type: 'continuous' },
    KN04: { column: 'tuoi_ong_nam', type: 'continuous' },
    KN05: { column: 'diem_bat_loi', type: 'binary' },
    KN06: { column: 'qua_be_chua', type: 'binary' },
    KN07: { column: 'nguon_gieng', type: 'binary' },
    KN08: { columns: ['gan_o_nhiem', 'xam_nhap_man'], type: 'binary_or' },
    KN09: { column: 'bien_dong_mua', type: 'binary' },
    KN10: { column: 'co_khieu_nai', type: 'binary' },
    KN11: { column: 'moi_dau_noi', type: 'binary' },
    HQ01: { column: 'mat_do_dan_cu', type: 'continuous' },
    HQ02: { column: 'gan_co_so_nhay_cam', type: 'binary' },
    HQ03: { column: 'ca_benh_tieu_hoa', type: 'continuous' },
    DBP01: { column: 'vung_mu', type: 'binary' },
    DBP02: { column: 'khoang_cach_diem', type: 'continuous' },
  };

  /**
   * Lấy giá trị THÔ (chưa chuẩn hóa) của 1 tiêu chí từ 1 bản ghi
   * point_attributes. Trả về null nếu thiếu dữ liệu (KHÔNG gán 0).
   */
  function getRawValue(pointAttr, config) {
    if (!config || !pointAttr) return null;
    if (config.type === 'binary_or') {
      var vals = config.columns.map(function (c) { return pointAttr[c]; });
      var allNull = vals.every(function (v) { return v === null || v === undefined; });
      if (allNull) return null;
      return vals.some(function (v) { return v === true; }) ? true : false;
    }
    var v = pointAttr[config.column];
    if (v === null || v === undefined) return null;
    return v;
  }

  /**
   * Tính min/max cho các tiêu chí 'continuous' trên TOÀN TẬP điểm có dữ
   * liệu (lưu lại để tái lập theo đúng yêu cầu 3.2/3.4).
   * @param {Array<Object>} pointAttrsList danh sách point_attributes
   * @param {string[]} criteriaCodes các ma_tieu_chi cần chuẩn hóa (từ criteria_weights)
   * @returns {Object<string,{min:number,max:number,n:number}>}
   */
  function computeNormalizationParams(pointAttrsList, criteriaCodes) {
    var params = {};
    criteriaCodes.forEach(function (code) {
      var config = CRITERIA_MAP[code];
      if (!config || config.type !== 'continuous') return;
      var values = [];
      pointAttrsList.forEach(function (pa) {
        var raw = getRawValue(pa, config);
        if (raw !== null && !isNaN(Number(raw))) values.push(Number(raw));
      });
      if (values.length > 0) {
        params[code] = {
          min: Math.min.apply(null, values),
          max: Math.max.apply(null, values),
          n: values.length,
        };
      }
    });
    return params;
  }

  /**
   * Chuẩn hóa 1 giá trị thô về [0,1] theo đúng "type" trong CRITERIA_MAP.
   * @returns {number|null} null nếu thiếu dữ liệu hoặc không đủ tham số (vd continuous mà min=max)
   */
  function normalizeValue(code, rawValue, normParams) {
    var config = CRITERIA_MAP[code];
    if (!config || rawValue === null || rawValue === undefined) return null;

    if (config.type === 'ordinal') {
      return Object.prototype.hasOwnProperty.call(config.ordinalMap, rawValue)
        ? config.ordinalMap[rawValue]
        : null;
    }
    if (config.type === 'binary' || config.type === 'binary_or') {
      return rawValue === true ? 1 : 0;
    }
    if (config.type === 'continuous') {
      var p = normParams && normParams[code];
      if (!p) return null;
      if (p.max === p.min) return 0.5; // không phân biệt được -> giá trị trung tính
      return (Number(rawValue) - p.min) / (p.max - p.min);
    }
    return null;
  }

  // -------------------------------------------------------------------
  // Percentile tuyến tính dùng chung cho tứ phân vị (đồng bộ với KAMET)
  // -------------------------------------------------------------------
  function percentileLinear(sortedArr, p) {
    var n = sortedArr.length;
    if (n === 0) return null;
    if (n === 1) return sortedArr[0];
    var idx = p * (n - 1);
    var lo = Math.floor(idx);
    var hi = Math.ceil(idx);
    if (lo === hi) return sortedArr[lo];
    var frac = idx - lo;
    return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * frac;
  }

  /**
   * 3.3 — Tính điểm nguy cơ R cho MỘT điểm, từ point_attributes của điểm
   * đó và danh sách trọng số toàn cục (criteria_weights).
   * Nếu 1 tiêu chí thiếu dữ liệu -> loại khỏi tổng, CHUẨN HÓA LẠI trọng
   * số trên các tiêu chí còn dữ liệu (tổng w dùng cho điểm đó = 1).
   * @param {Object} pointAttr bản ghi point_attributes (có thể null/thiếu)
   * @param {Array<{ma_tieu_chi, w_toan_cuc}>} weightRows từ criteria_weights
   * @param {Object} normParams kết quả computeNormalizationParams()
   * @returns {{R:number|null, usedCriteria:string[], missingCriteria:string[], detail:Object}}
   */
  function computeRiskScoreForPoint(pointAttr, weightRows, normParams) {
    var usedCriteria = [];
    var missingCriteria = [];
    var normalizedValues = {};

    weightRows.forEach(function (w) {
      var config = CRITERIA_MAP[w.ma_tieu_chi];
      if (!config) return; // tiêu chí không có ánh xạ dữ liệu -> bỏ qua hẳn
      var raw = getRawValue(pointAttr, config);
      var normalized = normalizeValue(w.ma_tieu_chi, raw, normParams);
      if (normalized === null) {
        missingCriteria.push(w.ma_tieu_chi);
      } else {
        usedCriteria.push(w.ma_tieu_chi);
        normalizedValues[w.ma_tieu_chi] = normalized;
      }
    });

    if (usedCriteria.length === 0) {
      return { R: null, usedCriteria: [], missingCriteria: missingCriteria, detail: {} };
    }

    // Chuẩn hóa lại trọng số trên các tiêu chí còn dữ liệu (tổng = 1)
    // LƯU Ý: w_toan_cuc có thể trả về dạng CHUỖI (Postgres numeric qua một
    // số client/CLI) -> luôn ép Number() để tránh lỗi cộng chuỗi (string
    // concatenation) làm sai toàn bộ kết quả R.
    var sumW = 0;
    usedCriteria.forEach(function (code) {
      var row = weightRows.filter(function (w) { return w.ma_tieu_chi === code; })[0];
      sumW += Number(row.w_toan_cuc);
    });

    var R = 0;
    var detail = {};
    usedCriteria.forEach(function (code) {
      var row = weightRows.filter(function (w) { return w.ma_tieu_chi === code; })[0];
      var wGoc = Number(row.w_toan_cuc);
      var wRescaled = sumW > 0 ? wGoc / sumW : 0;
      var contrib = wRescaled * normalizedValues[code];
      R += contrib;
      detail[code] = { w_goc: wGoc, w_chuan_hoa_lai: wRescaled, gia_tri_chuan_hoa: normalizedValues[code], dong_gop: contrib };
    });

    return { R: R, usedCriteria: usedCriteria, missingCriteria: missingCriteria, detail: detail };
  }

  /**
   * Xếp hạng R giảm dần + phân nhóm ưu tiên theo tứ phân vị.
   * @param {Array<{point_code, R:number|null}>} scoredPoints
   * @returns {Array} bản sao có thêm xep_hang (1-based, null nếu R=null) và nhom_uu_tien
   */
  function rankAndGroupByQuartile(scoredPoints) {
    var withR = scoredPoints.filter(function (p) { return p.R !== null && p.R !== undefined; });
    var values = withR.map(function (p) { return p.R; }).sort(function (a, b) { return a - b; });

    var Q1 = percentileLinear(values, 0.25);
    var Q2 = percentileLinear(values, 0.5);
    var Q3 = percentileLinear(values, 0.75);

    function groupOf(R) {
      if (R >= Q3) return 'Ưu tiên cao';
      if (R >= Q2) return 'Trung bình-cao';
      if (R >= Q1) return 'Trung bình';
      return 'Thấp';
    }

    var sorted = [...withR].sort(function (a, b) { return b.R - a.R; });
    var rankMap = {};
    sorted.forEach(function (p, idx) { rankMap[p.point_code] = idx + 1; });

    return scoredPoints.map(function (p) {
      if (p.R === null || p.R === undefined) {
        return Object.assign({}, p, { xep_hang: null, nhom_uu_tien: null });
      }
      return Object.assign({}, p, { xep_hang: rankMap[p.point_code], nhom_uu_tien: groupOf(p.R) });
    });
  }

  return {
    roundTo5: roundTo5,
    makePointCode: makePointCode,
    aggregateSamplesToPoints: aggregateSamplesToPoints,
    CRITERIA_MAP: CRITERIA_MAP,
    getRawValue: getRawValue,
    computeNormalizationParams: computeNormalizationParams,
    normalizeValue: normalizeValue,
    percentileLinear: percentileLinear,
    computeRiskScoreForPoint: computeRiskScoreForPoint,
    rankAndGroupByQuartile: rankAndGroupByQuartile,
  };
});
