# =====================================================================
# ĐỐI CHIẾU ĐỘC LẬP (KHÔNG dùng scipy/statsmodels/sklearn) — thay thế
# tạm thời cho R/Stata trong môi trường hiện KHÔNG có R cài đặt.
# ---------------------------------------------------------------------
# Tính tay bằng numpy/toán học thuần túy các chỉ số cốt lõi:
#   - Bảng chéo & chi-square thủ công (công thức Pearson chi-square)
#   - Hồi quy logistic đơn biến bằng Newton-Raphson tự viết (MLE thủ công)
#   - AUC bằng công thức Mann-Whitney U / (n_pos*n_neg) (tương đương AUC)
# So khớp với kết quả stats_core.py (verify_output.json) để xác nhận
# scipy/statsmodels/sklearn cho ra đúng kết quả toán học kỳ vọng.
# =====================================================================
import json
import numpy as np
import pandas as pd

df = pd.read_csv("verify_dataset.csv", encoding="utf-8")
with open("verify_output.json", "r", encoding="utf-8") as f:
    ref = json.load(f)

print("=" * 70)
print("ĐỐI CHIẾU ĐỘC LẬP (tính tay bằng numpy thuần, không dùng scipy/statsmodels)")
print("=" * 70)

# ---------- 1. Chi-square thủ công (công thức Pearson) ----------
groups_order = ["thap", "tb", "tb_cao", "cao"]
obs = np.zeros((4, 2))
for i, g in enumerate(groups_order):
    sub = df[df["nhom_uu_tien"] == g]
    obs[i, 0] = (sub["khong_dat"] == 0).sum()
    obs[i, 1] = (sub["khong_dat"] == 1).sum()

row_sums = obs.sum(axis=1, keepdims=True)
col_sums = obs.sum(axis=0, keepdims=True)
total = obs.sum()
expected_manual = row_sums @ col_sums / total
chi2_manual = ((obs - expected_manual) ** 2 / expected_manual).sum()

chi2_ref = ref["group_comparison"]["test"]["statistic"]
print(f"\n[1] Chi-square thủ công = {chi2_manual:.6f}")
print(f"    Chi-square từ stats_core (scipy) = {chi2_ref:.6f}")
print(f"    Khớp tới 4 chữ số thập phân: {abs(chi2_manual - chi2_ref) < 1e-4}")

# ---------- 2. Hồi quy logistic đơn biến bằng Newton-Raphson tự viết ----------
y = df["khong_dat"].values.astype(float)
X = np.column_stack([np.ones(len(df)), df["R"].values])  # [intercept, R]

beta = np.zeros(2)
for _ in range(100):
    z = X @ beta
    p = 1 / (1 + np.exp(-z))
    W = p * (1 - p)
    gradient = X.T @ (y - p)
    H = -(X.T * W) @ X
    try:
        delta = np.linalg.solve(H, gradient)
    except np.linalg.LinAlgError:
        break
    beta = beta - delta
    if np.max(np.abs(delta)) < 1e-10:
        break

coef_manual = beta[1]
or_manual = np.exp(coef_manual)
coef_ref = ref["logistic_univariate"]["result"]["coef"]
or_ref = ref["logistic_univariate"]["result"]["OR"]

print(f"\n[2] Hệ số logistic (R) thủ công (Newton-Raphson) = {coef_manual:.6f} -> OR = {or_manual:.6f}")
print(f"    Hệ số/OR từ stats_core (statsmodels MLE)       = {coef_ref:.6f} -> OR = {or_ref:.6f}")
print(f"    Khớp tới 4 chữ số thập phân: {abs(coef_manual - coef_ref) < 1e-4}")

# ---------- 3. AUC bằng công thức Mann-Whitney U / (n_pos * n_neg) ----------
scores = df["R"].values
labels = df["khong_dat"].values
pos_scores = scores[labels == 1]
neg_scores = scores[labels == 0]

# AUC = P(score_dương > score_âm) tính bằng đếm cặp (bao gồm xử lý ties = 0.5)
count = 0.0
for ps in pos_scores:
    count += (ps > neg_scores).sum() + 0.5 * (ps == neg_scores).sum()
auc_manual = count / (len(pos_scores) * len(neg_scores))

auc_ref = ref["roc_auc"]["auc"]["value"]
print(f"\n[3] AUC thủ công (đếm cặp Mann-Whitney U) = {auc_manual:.6f}")
print(f"    AUC từ stats_core (sklearn roc_auc_score) = {auc_ref:.6f}")
print(f"    Khớp tới 4 chữ số thập phân: {abs(auc_manual - auc_ref) < 1e-4}")

# ---------- Kết luận ----------
all_pass = (
    abs(chi2_manual - chi2_ref) < 1e-4
    and abs(coef_manual - coef_ref) < 1e-4
    and abs(auc_manual - auc_ref) < 1e-4
)
print("\n" + "=" * 70)
print("✅ TẤT CẢ ĐỐI CHIẾU ĐỘC LẬP KHỚP scipy/statsmodels/sklearn" if all_pass else "❌ CÓ SAI LỆCH — CẦN KIỂM TRA LẠI")
print("=" * 70)
