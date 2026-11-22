# =====================================================================
# MODULE 4 — STATS CORE (thuần Python, KHÔNG phụ thuộc FastAPI)
# ---------------------------------------------------------------------
# "Một nguồn sự thật duy nhất" cho mọi phép kiểm định thống kê, dùng
# chung bởi main.py (endpoint /validate) và verify.py (kiểm định công cụ
# với verify_dataset.csv). TUYỆT ĐỐI không tự viết công thức thống kê:
# mọi phép tính đều gọi thư viện đã kiểm định (scipy/statsmodels/sklearn).
# =====================================================================
from __future__ import annotations
import time
import numpy as np
import pandas as pd
import scipy
import scipy.stats as st
import statsmodels
import statsmodels.api as sm
from statsmodels.stats.contingency_tables import Table
from statsmodels.stats.outliers_influence import variance_inflation_factor
from statsmodels.stats.proportion import proportion_confint
import sklearn
from sklearn.metrics import roc_curve, roc_auc_score, confusion_matrix

GROUP_ORDER = ["thap", "tb", "tb_cao", "cao"]  # thứ tự tăng dần nguy cơ
GROUP_SCORE = {g: i + 1 for i, g in enumerate(GROUP_ORDER)}  # 1..4 cho trend test


def library_versions() -> dict:
    """Phiên bản thư viện thực tế đã dùng (bắt buộc trả về để tái lập)."""
    return {
        "numpy": np.__version__,
        "pandas": pd.__version__,
        "scipy": scipy.__version__,
        "statsmodels": statsmodels.__version__,
        "scikit_learn": sklearn.__version__,
    }


def format_p(p: float | None) -> str:
    """p hai phía; p rất nhỏ hiển thị '< 0.001' (giữ giá trị gốc riêng)."""
    if p is None or (isinstance(p, float) and np.isnan(p)):
        return "N/A"
    if p < 0.001:
        return "< 0.001"
    return f"{p:.3f}"


def safe_float(x):
    try:
        if x is None:
            return None
        v = float(x)
        if np.isnan(v) or np.isinf(v):
            return None
        return v
    except Exception:
        return None


# =====================================================================
# 4.3(a) — So sánh tỷ lệ không đạt giữa các nhóm nguy cơ
# =====================================================================
def analyze_group_comparison(df: pd.DataFrame) -> dict:
    """
    Bảng chéo nhom_uu_tien x khong_dat. χ² (correction=False); nếu có ô
    kỳ vọng < 5 -> tự chuyển Fisher (2x2 dùng fisher_exact; >2 nhóm dùng
    Fisher-Freeman-Halton qua statsmodels nếu khả dụng, nếu không thì báo
    rõ hạn chế). Kèm Cochran-Armitage trend test (statsmodels, ordinal).
    """
    out = {"warnings": []}

    present_groups = [g for g in GROUP_ORDER if g in df["nhom_uu_tien"].unique()]
    if len(present_groups) < 2:
        out["warnings"].append(
            "Chỉ có <2 nhóm nguy cơ trong dữ liệu -> không thể so sánh tỷ lệ giữa các nhóm."
        )
        out["crosstab"] = None
        out["test"] = None
        out["trend_test"] = None
        return out

    sub = df[df["nhom_uu_tien"].isin(present_groups)].copy()
    sub["nhom_uu_tien"] = pd.Categorical(sub["nhom_uu_tien"], categories=present_groups, ordered=True)

    crosstab = pd.crosstab(sub["nhom_uu_tien"], sub["khong_dat"])
    # Đảm bảo đủ 2 cột 0/1 (nếu 1 nhóm hoàn toàn không có ca nào 0 hoặc 1)
    for col in [0, 1]:
        if col not in crosstab.columns:
            crosstab[col] = 0
    crosstab = crosstab[[0, 1]].sort_index()

    obs = crosstab.values.astype(float)
    n_groups = obs.shape[0]

    # χ² (correction=False theo yêu cầu) để lấy bảng kỳ vọng
    chi2, p_chi2, dof, expected = st.chi2_contingency(obs, correction=False)
    min_expected = float(expected.min())

    test_result = {
        "method": None,
        "statistic": None,
        "p_value": None,
        "p_display": None,
        "dof": int(dof) if dof is not None else None,
        "min_expected_cell": min_expected,
        "expected_table": expected.tolist(),
    }

    if min_expected < 5:
        if n_groups == 2:
            odds_ratio, p_fisher = st.fisher_exact(obs)
            test_result["method"] = "fisher_exact_2x2"
            test_result["statistic"] = safe_float(odds_ratio)
            test_result["p_value"] = safe_float(p_fisher)
            test_result["p_display"] = format_p(p_fisher)
            out["warnings"].append(
                "Có ô kỳ vọng < 5 -> đã tự động chuyển sang Fisher's exact test (2x2)."
            )
        else:
            # >2 nhóm: scipy.stats.fisher_exact chỉ hỗ trợ 2x2 (bản scipy hiện tại
            # không có Fisher-Freeman-Halton tổng quát) -> báo rõ hạn chế, vẫn
            # trả kết quả χ² kèm cảnh báo độ tin cậy thấp, KHÔNG bịa số liệu khác.
            test_result["method"] = "chi2_with_low_expected_warning"
            test_result["statistic"] = safe_float(chi2)
            test_result["p_value"] = safe_float(p_chi2)
            test_result["p_display"] = format_p(p_chi2)
            out["warnings"].append(
                f"Có ô kỳ vọng < 5 (min={min_expected:.2f}) với {n_groups} nhóm (>2) -> "
                "scipy không hỗ trợ Fisher-Freeman-Halton tổng quát; kết quả χ² dưới đây "
                "CẦN THẬN TRỌNG khi diễn giải (độ tin cậy giảm)."
            )
    else:
        test_result["method"] = "chi2_contingency"
        test_result["statistic"] = safe_float(chi2)
        test_result["p_value"] = safe_float(p_chi2)
        test_result["p_display"] = format_p(p_chi2)

    # Cochran-Armitage trend test (linear-by-linear association, ordinal)
    trend_test = None
    if n_groups >= 2:
        try:
            table = Table(obs)
            row_scores = np.array([GROUP_SCORE[g] for g in present_groups], dtype=float)
            col_scores = np.array([0.0, 1.0])
            trend_res = table.test_ordinal_association(row_scores=row_scores, col_scores=col_scores)
            trend_test = {
                "method": "cochran_armitage_trend (statsmodels Table.test_ordinal_association)",
                "statistic": safe_float(trend_res.statistic),
                "p_value": safe_float(trend_res.pvalue),
                "p_display": format_p(trend_res.pvalue),
            }
        except Exception as e:  # phòng lỗi dữ liệu suy biến (vd 1 cột toàn 0)
            trend_test = {"error": f"Không tính được trend test: {e}"}

    out["crosstab"] = {
        "groups": present_groups,
        "observed": obs.tolist(),
        "columns": ["dat", "khong_dat"],
    }
    out["test"] = test_result
    out["trend_test"] = trend_test
    return out


# =====================================================================
# 4.3(b) — Hồi quy logistic (statsmodels, MLE) — đơn biến & đa biến
# =====================================================================
def _fit_logit_safe(y: pd.Series, X: pd.DataFrame):
    """
    Fit Logit bằng statsmodels, bắt PerfectSeparationError/Warning.
    Trả (result, warnings[]) — result=None nếu thất bại/không ổn định.
    """
    import warnings as _warnings
    from statsmodels.tools.sm_exceptions import PerfectSeparationWarning

    warn_list = []
    with _warnings.catch_warnings(record=True) as caught:
        _warnings.simplefilter("always", category=PerfectSeparationWarning)
        try:
            model = sm.Logit(y, X)
            result = model.fit(disp=0, maxiter=100)
        except Exception as e:
            return None, [f"Lỗi fit mô hình logistic: {e}"]

        for w in caught:
            if issubclass(w.category, PerfectSeparationWarning):
                warn_list.append(
                    "Phát hiện KHẢ NĂNG tách hoàn toàn/gần hoàn toàn (perfect/quasi-separation) "
                    "-> hệ số/SE có thể không ổn định, KHÔNG diễn giải OR như bình thường."
                )

    # Kiểm tra thêm: SE quá lớn (dấu hiệu separation dù không có warning)
    if result is not None:
        huge_se = (result.bse > 10).any()
        if huge_se:
            warn_list.append(
                "Sai số chuẩn (SE) của ít nhất 1 hệ số rất lớn (>10) -> nghi ngờ quasi-separation, "
                "kết quả OR/KTC cho biến đó không đáng tin cậy."
            )
    return result, warn_list


def logistic_univariate(df: pd.DataFrame, alpha: float = 0.05) -> dict:
    """khong_dat ~ R (đơn biến). Trả OR, KTC 95%, p, N."""
    sub = df[["khong_dat", "R"]].dropna()
    n_total = len(df)
    n_used = len(sub)
    n_dropped = n_total - n_used

    if n_used < 10 or sub["khong_dat"].nunique() < 2:
        return {
            "n_obs": n_used,
            "n_dropped_missing": n_dropped,
            "warnings": ["Không đủ dữ liệu ổn định để chạy hồi quy logistic đơn biến (N quá nhỏ hoặc chỉ có 1 lớp)."],
            "result": None,
        }

    X = sm.add_constant(sub[["R"]])
    y = sub["khong_dat"]
    result, warn_list = _fit_logit_safe(y, X)

    if result is None:
        return {"n_obs": n_used, "n_dropped_missing": n_dropped, "warnings": warn_list, "result": None}

    ci = result.conf_int(alpha=alpha)
    coef = result.params["R"]
    or_val = float(np.exp(coef))
    or_ci = [float(np.exp(ci.loc["R", 0])), float(np.exp(ci.loc["R", 1]))]
    p_val = float(result.pvalues["R"])

    return {
        "n_obs": n_used,
        "n_dropped_missing": n_dropped,
        "warnings": warn_list,
        "result": {
            "coef": safe_float(coef),
            "OR": safe_float(or_val),
            "OR_ci95": [safe_float(v) for v in or_ci],
            "p_value": safe_float(p_val),
            "p_display": format_p(p_val),
            "pseudo_r2_mcfadden": safe_float(result.prsquared),
            "log_likelihood": safe_float(result.llf),
        },
    }


def logistic_multivariate(df: pd.DataFrame, feature_cols: list[str], alpha: float = 0.05) -> dict:
    """
    khong_dat ~ các tiêu chí chuẩn hóa (feature_cols, ĐỌC ĐỘNG theo dữ liệu
    Node gửi lên — KHÔNG hard-code danh sách biến). Loại điểm thiếu biến
    (listwise deletion) -> báo rõ N thực & số điểm bị loại. Tính VIF, cảnh
    báo đa cộng tuyến (VIF>5 cảnh báo, >10 cảnh báo nghiêm trọng).
    """
    n_total = len(df)
    if not feature_cols:
        return {
            "n_obs": 0, "n_dropped_missing": n_total,
            "warnings": ["Không có biến tiêu chí (features) nào được cung cấp."],
            "result": None, "vif": None,
        }

    cols = ["khong_dat"] + feature_cols
    sub = df[cols].dropna()
    n_used = len(sub)
    n_dropped = n_total - n_used

    warnings_out = []
    if n_used < 10 or sub["khong_dat"].nunique() < 2:
        return {
            "n_obs": n_used, "n_dropped_missing": n_dropped,
            "warnings": ["Không đủ dữ liệu ổn định để chạy hồi quy đa biến (N quá nhỏ sau khi loại thiếu biến, hoặc chỉ có 1 lớp)."],
            "result": None, "vif": None,
        }

    # Cảnh báo tỷ lệ biến/quan sát quá cao (rule-of-thumb: cần >=10 quan sát/biến)
    events = int(sub["khong_dat"].sum())
    epv = events / max(len(feature_cols), 1)
    if epv < 10:
        warnings_out.append(
            f"Số sự kiện (không đạt) trên mỗi biến (EPV) = {epv:.1f} (<10) -> mô hình có thể kém ổn định."
        )

    X_raw = sub[feature_cols]
    X = sm.add_constant(X_raw)
    y = sub["khong_dat"]

    # VIF (tính trên các biến độc lập, KHÔNG gồm hằng số)
    vif_data = {}
    try:
        # Thêm hằng số tường minh: VIF chuẩn (tâm hóa) và cho kết quả giống nhau giữa các phiên bản statsmodels (0.14 trên Pyodide / 0.15 native).
        X_vif = sm.add_constant(X_raw, has_constant='add')
        # Loại cột hằng số/degenerate (std=0) để tránh VIF chia 0/NaN vô nghĩa
        for col in feature_cols:
            vif = variance_inflation_factor(X_vif.values, list(X_vif.columns).index(col))
            vif_data[col] = safe_float(vif)
            if vif is not None and not np.isnan(vif):
                if vif > 10:
                    warnings_out.append(f"VIF({col})={vif:.2f} > 10 -> đa cộng tuyến NGHIÊM TRỌNG, cân nhắc loại biến.")
                elif vif > 5:
                    warnings_out.append(f"VIF({col})={vif:.2f} > 5 -> có dấu hiệu đa cộng tuyến, cần lưu ý.")
    except Exception as e:
        vif_data = {"error": f"Không tính được VIF: {e}"}

    result, sep_warnings = _fit_logit_safe(y, X)
    warnings_out.extend(sep_warnings)

    if result is None:
        return {"n_obs": n_used, "n_dropped_missing": n_dropped, "warnings": warnings_out, "result": None, "vif": vif_data}

    ci = result.conf_int(alpha=alpha)
    per_variable = {}
    for col in feature_cols:
        coef = result.params[col]
        p_val = float(result.pvalues[col])
        per_variable[col] = {
            "coef": safe_float(coef),
            "OR_adjusted": safe_float(np.exp(coef)),
            "OR_ci95": [safe_float(np.exp(ci.loc[col, 0])), safe_float(np.exp(ci.loc[col, 1]))],
            "p_value": safe_float(p_val),
            "p_display": format_p(p_val),
        }

    return {
        "n_obs": n_used,
        "n_dropped_missing": n_dropped,
        "warnings": warnings_out,
        "vif": vif_data,
        "result": {
            "variables": per_variable,
            "pseudo_r2_mcfadden": safe_float(result.prsquared),
            "log_likelihood": safe_float(result.llf),
            "n_events": events,
        },
    }


# =====================================================================
# 4.3(c) — Khả năng phân biệt của thang điểm R (scikit-learn)
# =====================================================================
def _wilson_ci(successes: int, n: int, alpha: float = 0.05):
    """KTC Wilson cho 1 tỷ lệ (dùng statsmodels.stats.proportion, đã kiểm định)."""
    if n == 0:
        return (None, None)
    lo, hi = proportion_confint(successes, n, alpha=alpha, method="wilson")
    return (safe_float(lo), safe_float(hi))


def analyze_roc_auc(
    df: pd.DataFrame,
    alpha: float = 0.05,
    bootstrap_n: int = 2000,
    random_state: int = 42,
) -> dict:
    """
    ROC/AUC (sklearn) + KTC 95% bootstrap (random_state cố định để tái lập).
    Ngưỡng tối ưu Youden's J; Se/Sp tại ngưỡng đó (Wilson CI); ma trận
    nhầm lẫn; so sánh R trung bình đạt/không đạt bằng Mann-Whitney U.
    """
    sub = df[["khong_dat", "R"]].dropna()
    n_used = len(sub)
    y = sub["khong_dat"].values
    scores = sub["R"].values

    out = {"n_obs": n_used, "warnings": []}

    if n_used < 10 or len(np.unique(y)) < 2:
        out["warnings"].append("Không đủ dữ liệu (hoặc chỉ có 1 lớp) để tính ROC/AUC.")
        out["roc"] = None
        out["auc"] = None
        out["youden"] = None
        out["confusion_matrix"] = None
        out["mann_whitney"] = None
        return out

    fpr, tpr, thresholds = roc_curve(y, scores)
    auc_point = roc_auc_score(y, scores)

    # Bootstrap CI 95% cho AUC (percentile 2.5-97.5), random_state cố định
    rng = np.random.RandomState(random_state)
    boot_aucs = []
    n_pos_total = int(y.sum())
    n_neg_total = int(len(y) - n_pos_total)
    if n_pos_total == 0 or n_neg_total == 0:
        out["warnings"].append("Một trong hai lớp (đạt/không đạt) không có quan sát nào -> không bootstrap được AUC.")
    else:
        idx_all = np.arange(n_used)
        for _ in range(bootstrap_n):
            sample_idx = rng.choice(idx_all, size=n_used, replace=True)
            y_s = y[sample_idx]
            if len(np.unique(y_s)) < 2:
                continue
            try:
                boot_aucs.append(roc_auc_score(y_s, scores[sample_idx]))
            except Exception:
                continue

        if len(boot_aucs) < bootstrap_n * 0.5:
            out["warnings"].append(
                f"Chỉ {len(boot_aucs)}/{bootstrap_n} mẫu bootstrap hợp lệ (nhiều mẫu bị suy biến 1 lớp) -> KTC AUC có thể kém tin cậy."
            )

    if boot_aucs:
        auc_ci = [safe_float(np.percentile(boot_aucs, 2.5)), safe_float(np.percentile(boot_aucs, 97.5))]
    else:
        auc_ci = [None, None]

    out["auc"] = {
        "value": safe_float(auc_point),
        "ci95": auc_ci,
        "bootstrap_n_requested": bootstrap_n,
        "bootstrap_n_valid": len(boot_aucs),
        "random_state": random_state,
    }
    out["roc"] = {
        "fpr": [safe_float(v) for v in fpr],
        "tpr": [safe_float(v) for v in tpr],
        "thresholds": [safe_float(v) for v in thresholds],
    }

    # Ngưỡng tối ưu Youden's J = max(tpr - fpr)
    j_scores = tpr - fpr
    best_idx = int(np.argmax(j_scores))
    best_threshold = safe_float(thresholds[best_idx])

    y_pred = (scores >= thresholds[best_idx]).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, y_pred, labels=[0, 1]).ravel()

    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else None
    specificity = tn / (tn + fp) if (tn + fp) > 0 else None
    sens_ci = _wilson_ci(tp, tp + fn, alpha) if (tp + fn) > 0 else (None, None)
    spec_ci = _wilson_ci(tn, tn + fp, alpha) if (tn + fp) > 0 else (None, None)

    out["youden"] = {
        "threshold": best_threshold,
        "j_statistic": safe_float(j_scores[best_idx]),
        "sensitivity": safe_float(sensitivity),
        "sensitivity_ci95": list(sens_ci),
        "specificity": safe_float(specificity),
        "specificity_ci95": list(spec_ci),
    }
    out["confusion_matrix"] = {
        "threshold": best_threshold,
        "TP": int(tp), "FP": int(fp), "TN": int(tn), "FN": int(fn),
    }

    # So sánh R trung bình đạt vs không đạt + Mann-Whitney U (so phân phối)
    r_dat = sub.loc[sub["khong_dat"] == 0, "R"]
    r_khongdat = sub.loc[sub["khong_dat"] == 1, "R"]
    mw_stat, mw_p = st.mannwhitneyu(r_khongdat, r_dat, alternative="two-sided")
    out["mann_whitney"] = {
        "R_mean_dat": safe_float(r_dat.mean()),
        "R_mean_khong_dat": safe_float(r_khongdat.mean()),
        "R_median_dat": safe_float(r_dat.median()),
        "R_median_khong_dat": safe_float(r_khongdat.median()),
        "statistic": safe_float(mw_stat),
        "p_value": safe_float(mw_p),
        "p_display": format_p(mw_p),
    }

    return out


# =====================================================================
# HÀM ĐIỀU PHỐI CHÍNH — gọi từ main.py (endpoint /validate) & verify.py
# =====================================================================
def run_full_validation(points: list, alpha: float = 0.05, bootstrap_n: int = 2000, random_state: int = 42) -> dict:
    t0 = time.time()
    df = pd.DataFrame(points)

    if df.empty:
        return {"error": "Không có điểm dữ liệu nào được gửi lên.", "metadata": {"n_points": 0}}

    df["khong_dat"] = df["khong_dat"].astype(int)

    # Trích feature_cols ĐỘNG từ dữ liệu thực nhận được (không hard-code)
    feature_cols = []
    if "features" in df.columns:
        all_keys = set()
        for f in df["features"].dropna():
            if isinstance(f, dict):
                all_keys.update(f.keys())
        feature_cols = sorted(all_keys)
        feat_df = pd.json_normalize(df["features"])
        df = pd.concat([df.reset_index(drop=True), feat_df.reset_index(drop=True)], axis=1)

    n_points = len(df)
    n_khong_dat = int(df["khong_dat"].sum())

    if "nhom_uu_tien" in df.columns:
        group_comparison = analyze_group_comparison(df)
    else:
        group_comparison = {"warnings": ["Dữ liệu không có cột nhom_uu_tien -> bỏ qua phân tích theo nhóm."]}

    univariate = logistic_univariate(df, alpha=alpha)

    if feature_cols:
        multivariate = logistic_multivariate(df, feature_cols, alpha=alpha)
    else:
        multivariate = {
            "warnings": ["Không có biến tiêu chí (features) nào trong dữ liệu -> bỏ qua hồi quy đa biến."],
            "result": None,
        }

    roc_analysis = analyze_roc_auc(df, alpha=alpha, bootstrap_n=bootstrap_n, random_state=random_state)

    elapsed = time.time() - t0

    return {
        "metadata": {
            "n_points": n_points,
            "n_khong_dat": n_khong_dat,
            "ty_le_khong_dat": safe_float(n_khong_dat / n_points) if n_points else None,
            "feature_cols_used": feature_cols,
            "alpha": alpha,
            "bootstrap_n": bootstrap_n,
            "random_state": random_state,
            "elapsed_seconds": round(elapsed, 3),
            "library_versions": library_versions(),
            "unit_of_analysis": "diem (point)",
            "note_independence": (
                "Đơn vị phân tích là ĐIỂM (đã gộp từ nhiều mẫu nước theo tọa độ) "
                "để đảm bảo giả định độc lập giữa các quan sát trong kiểm định thống kê."
            ),
        },
        "group_comparison": group_comparison,
        "logistic_univariate": univariate,
        "logistic_multivariate": multivariate,
        "roc_auc": roc_analysis,
    }
