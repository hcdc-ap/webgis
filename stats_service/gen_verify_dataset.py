# =====================================================================
# Sinh stats_service/verify_dataset.csv — bộ dữ liệu CỐ ĐỊNH (fixed seed)
# dùng để kiểm định công cụ (stats_service/verify.py + VERIFICATION.md).
# Chạy 1 lần, kết quả CSV được commit và KHÔNG thay đổi sau đó.
# =====================================================================
import numpy as np
import pandas as pd

rng = np.random.RandomState(20250101)  # seed cố định, gắn liền với dataset
N = 300

R = rng.uniform(0, 1, N)
# Xác suất không đạt tăng dần theo R (mô hình logistic biết trước: beta0=-2.5, beta1=4)
true_beta0, true_beta1 = -2.5, 4.0
logit_p = true_beta0 + true_beta1 * R
p_fail = 1 / (1 + np.exp(-logit_p))
khong_dat = (rng.uniform(0, 1, N) < p_fail).astype(int)

# Nhóm nguy cơ theo tứ phân vị của chính R (đúng logic Module 3)
q1, q2, q3 = np.percentile(R, [25, 50, 75])
def group_of(r):
    if r >= q3:
        return "cao"
    if r >= q2:
        return "tb_cao"
    if r >= q1:
        return "tb"
    return "thap"
nhom = [group_of(r) for r in R]

# 2 biến tiêu chí mô phỏng: KN01 tương quan thuận với R; KN06 nhị phân độc lập hơn
KN01 = np.clip(R + rng.normal(0, 0.1, N), 0, 1)
KN06 = (rng.uniform(0, 1, N) < 0.4).astype(int)

df = pd.DataFrame({
    "point_code": [f"V{idx:04d}" for idx in range(N)],
    "khong_dat": khong_dat,
    "R": np.round(R, 6),
    "nhom_uu_tien": nhom,
    "KN01": np.round(KN01, 6),
    "KN06": KN06,
})
df.to_csv("verify_dataset.csv", index=False, encoding="utf-8")
print(f"Đã sinh {N} dòng -> verify_dataset.csv")
print(f"Tỷ lệ không đạt: {khong_dat.mean():.4f}")
print(f"Tham số logistic THẬT dùng để sinh dữ liệu: beta0={true_beta0}, beta1={true_beta1}")
print(f"OR thật (exp(beta1)) = {np.exp(true_beta1):.4f}")
print(f"Ngưỡng tứ phân vị R: Q1={q1:.4f}, Q2={q2:.4f}, Q3={q3:.4f}")
