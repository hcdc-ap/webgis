# =====================================================================
# MODULE 4 — KIỂM ĐỊNH CÔNG CỤ (bắt buộc trước khi dùng thật)
# ---------------------------------------------------------------------
# Chạy toàn bộ phân tích thống kê (stats_core.py) trên bộ dữ liệu CỐ ĐỊNH
# verify_dataset.csv (300 điểm, seed=20250101, tham số logistic THẬT đã
# biết trước: beta0=-2.5, beta1=4.0 -> OR thật = exp(4.0) = 54.60).
# In toàn bộ kết quả để đối chiếu với R/Stata (xem VERIFICATION.md) và
# lưu bằng chứng "phần mềm đã được kiểm định".
#
# Chạy: python verify.py
# =====================================================================
import json
import pandas as pd
from stats_core import run_full_validation, library_versions

CSV_PATH = "verify_dataset.csv"


def load_points_from_csv(path: str) -> list:
    df = pd.read_csv(path, encoding="utf-8")
    points = []
    for _, row in df.iterrows():
        points.append({
            "khong_dat": int(row["khong_dat"]),
            "R": float(row["R"]),
            "nhom_uu_tien": row["nhom_uu_tien"],
            "features": {"KN01": float(row["KN01"]), "KN06": int(row["KN06"])},
        })
    return points


def main():
    print("=" * 70)
    print("KIỂM ĐỊNH CÔNG CỤ — stats_service (Module 4)")
    print("=" * 70)
    print(f"Phiên bản thư viện: {json.dumps(library_versions(), ensure_ascii=False)}")
    print(f"Dữ liệu: {CSV_PATH} (N=300, seed sinh dữ liệu=20250101)")
    print("Tham số logistic THẬT dùng để sinh dữ liệu: beta0=-2.5, beta1=4.0")
    print(f"-> OR thật kỳ vọng (đơn biến, khong_dat~R) ≈ exp(4.0) = 54.598")
    print()

    points = load_points_from_csv(CSV_PATH)
    result = run_full_validation(points, alpha=0.05, bootstrap_n=2000, random_state=42)

    print("-" * 70)
    print("METADATA")
    print("-" * 70)
    print(json.dumps(result["metadata"], indent=2, ensure_ascii=False))

    print("-" * 70)
    print("(a) SO SÁNH TỶ LỆ KHÔNG ĐẠT GIỮA CÁC NHÓM NGUY CƠ")
    print("-" * 70)
    gc = result["group_comparison"]
    print("Bảng tần số quan sát (hàng=nhóm theo thứ tự thap/tb/tb_cao/cao, cột=[dat,khong_dat]):")
    print(json.dumps(gc.get("crosstab"), indent=2, ensure_ascii=False))
    print("Kiểm định chính:")
    print(json.dumps(gc.get("test"), indent=2, ensure_ascii=False))
    print("Cochran-Armitage trend test:")
    print(json.dumps(gc.get("trend_test"), indent=2, ensure_ascii=False))
    if gc.get("warnings"):
        print("Cảnh báo:", gc["warnings"])

    print("-" * 70)
    print("(b) HỒI QUY LOGISTIC")
    print("-" * 70)
    print("Đơn biến (khong_dat ~ R):")
    print(json.dumps(result["logistic_univariate"], indent=2, ensure_ascii=False))
    print("\nĐa biến (khong_dat ~ KN01 + KN06):")
    print(json.dumps(result["logistic_multivariate"], indent=2, ensure_ascii=False))

    print("-" * 70)
    print("(c) KHẢ NĂNG PHÂN BIỆT CỦA THANG ĐIỂM R")
    print("-" * 70)
    roc = result["roc_auc"]
    print(f"AUC = {roc['auc']['value']:.4f}  (KTC95% = [{roc['auc']['ci95'][0]:.4f}, {roc['auc']['ci95'][1]:.4f}], bootstrap n={roc['auc']['bootstrap_n_valid']})")
    print("Youden's J (ngưỡng tối ưu):")
    print(json.dumps(roc["youden"], indent=2, ensure_ascii=False))
    print("Ma trận nhầm lẫn:")
    print(json.dumps(roc["confusion_matrix"], indent=2, ensure_ascii=False))
    print("Mann-Whitney U (so phân phối R giữa 2 nhóm):")
    print(json.dumps(roc["mann_whitney"], indent=2, ensure_ascii=False))

    # Lưu toàn bộ kết quả ra file JSON để dùng làm bằng chứng đối chiếu
    with open("verify_output.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print("\n✅ Đã lưu toàn bộ kết quả chi tiết vào verify_output.json")
    print("=" * 70)
    print("HOÀN TẤT. Đối chiếu các số liệu trên với VERIFICATION.md.")
    print("=" * 70)


if __name__ == "__main__":
    main()
