# VERIFICATION.md — Bằng chứng kiểm định công cụ thống kê (Module 4)

> Tài liệu này chứng minh `stats_service` (FastAPI + scipy/statsmodels/scikit-learn)
> tính toán ĐÚNG các phép kiểm định thống kê được đặc tả ở Module 4, trước khi
> dùng để phân tích dữ liệu thật (1.219 điểm giám sát).

## 1. Bộ dữ liệu kiểm định cố định

File: `stats_service/verify_dataset.csv` (sinh bởi `gen_verify_dataset.py`, seed cố định `20250101`, **không thay đổi sau khi tạo**).

- N = 300 điểm mô phỏng.
- Cột: `point_code, khong_dat, R, nhom_uu_tien, KN01, KN06`.
- **Mô hình sinh dữ liệu ĐÃ BIẾT TRƯỚC**: `khong_dat` được sinh từ logistic thật
  `logit(p) = β0 + β1·R` với **β0 = −2.5, β1 = 4.0** ⇒ **OR thật = exp(4.0) ≈ 54.60**.
- Nhóm `nhom_uu_tien` chia theo tứ phân vị của chính R trong bộ dữ liệu (thap/tb/tb_cao/cao).
- `KN01 ≈ R + nhiễu` (tương quan thuận với R); `KN06` là nhị phân độc lập ngẫu nhiên
  (dùng để kiểm tra VIF thấp khi biến không cộng tuyến).

Chạy lại (nếu cần tái sinh — **không khuyến khích** vì sẽ đổi seed kết quả):
```
python gen_verify_dataset.py
```

## 2. Kết quả chạy `stats_service` (scipy/statsmodels/scikit-learn)

Lệnh chạy: `python verify.py` (in ra console + lưu `verify_output.json`).

Phiên bản thư viện tại thời điểm kiểm định (trả về trong mọi response `/validate`):
```
numpy 2.5.3 · pandas 3.0.5 · scipy 1.18.1 · statsmodels 0.15.0 · scikit_learn 1.9.1
```

| Chỉ số | Giá trị `stats_service` | Ghi chú |
|---|---|---|
| N điểm / N không đạt | 300 / 128 (42,67%) | |
| χ² (4 nhóm, correction=False) | 82,740 (df=3, p<0,001) | ô kỳ vọng nhỏ nhất = 32 (≥5 → dùng χ², không cần Fisher) |
| Cochran-Armitage trend test | thống kê=404, p<0,001 | xu hướng tăng dần theo nhóm rõ rệt (đúng thiết kế) |
| OR đơn biến (khong_dat ~ R) | **89,16** (KTC95%: 29,84–266,35), p<0,001 | **chứa giá trị thật 54,60** trong KTC 95% ✅ |
| OR đa biến — KN01 | 59,04 (KTC95%: 20,86–167,09), p<0,001 | |
| OR đa biến — KN06 | 1,05 (KTC95%: 0,62–1,79), p=0,857 | đúng kỳ vọng: KN06 độc lập với khong_dat theo thiết kế dữ liệu |
| VIF (KN01, KN06) | 1,005 / 1,005 | không đa cộng tuyến (đúng vì 2 biến độc lập theo thiết kế) |
| Pseudo-R² (McFadden, đa biến) | 0,192 | |
| AUC (R phân biệt đạt/không đạt) | **0,801** (KTC95% bootstrap: 0,747–0,850, n=2000, seed=42) | |
| Ngưỡng Youden tối ưu | R = 0,536 | Se=0,766 (KTC95%: 0,685–0,831); Sp=0,773 (KTC95%: 0,705–0,829) |
| Ma trận nhầm lẫn tại ngưỡng | TP=98, FP=39, TN=133, FN=30 | |
| Mann-Whitney U (R giữa 2 nhóm) | U=17635, p<0,001 | R trung bình: đạt=0,366 vs không đạt=0,664 |

Toàn bộ số liệu chi tiết (đầy đủ, không làm tròn) được lưu trong `verify_output.json`.

## 3. Đối chiếu độc lập — **ĐÃ THỰC HIỆN** bằng công thức toán học thuần (không dùng scipy/statsmodels/sklearn)

> **Hạn chế môi trường:** máy phát triển hiện tại **không có R hoặc Stata cài đặt**
> (đã thử `winget`/`where.exe`, chỉ cài được Python). Vì vậy, thay vì đối chiếu bằng R
> như đặc tả gốc, chúng tôi đã viết `independent_check.py` để **tính tay bằng
> `numpy` thuần túy** (không gọi bất kỳ hàm thống kê cấp cao nào của
> scipy/statsmodels/sklearn) 3 chỉ số cốt lõi, dùng công thức toán học tiêu chuẩn:

| Chỉ số | Công thức tính tay (numpy thuần) | Kết quả tính tay | Kết quả `stats_service` | Khớp? |
|---|---|---|---|---|
| χ² Pearson | `Σ (O−E)²/E` với `E = row_sum×col_sum/N` | 82,739826 | 82,739826 | ✅ khớp đến 6 chữ số thập phân |
| Hệ số logistic (R) | Newton-Raphson tự viết (MLE thủ công, lặp đến hội tụ `<1e-10`) | 4,490392 (OR=89,156427) | 4,490392 (OR=89,156427) | ✅ khớp đến 6 chữ số thập phân |
| AUC | đếm cặp `P(score₊ > score₋)` cộng `0,5×(ties)`, chia `n₊×n₋` (định nghĩa Mann-Whitney của AUC) | 0,801008 | 0,801008 | ✅ khớp đến 6 chữ số thập phân |

Lệnh chạy: `python independent_check.py` → in `✅ TẤT CẢ ĐỐI CHIẾU ĐỘC LẬP KHỚP scipy/statsmodels/sklearn`.

**Kết luận:** `scipy.stats.chi2_contingency`, `statsmodels.Logit` (MLE) và
`sklearn.metrics.roc_auc_score` cho kết quả **khớp chính xác** với công thức toán học
chuẩn tính bằng tay, độc lập hoàn toàn với các thư viện thống kê. Đây là bằng chứng
công cụ hoạt động đúng.

### 3.1. Script R (`verify.R`) — tài liệu tham khảo, CHƯA chạy được

File `stats_service/verify.R` đã được viết đầy đủ theo đúng phương pháp luận
(`glm(family=binomial)`, `pROC::roc`, `chisq.test`, `fisher.test`, `prop.trend.test`,
`car::vif`) để **người có R/RStudio chạy đối chiếu sau này**. Do môi trường phát
triển hiện tại không có R, script này **chưa được thực thi thực tế** — đây là hạn chế
đã biết, cần bổ sung khi có môi trường R. Khi chạy, kỳ vọng các số liệu trong bảng
mục 2 phải khớp tới ít nhất 3 chữ số thập phân với R (theo yêu cầu đề bài).

## 4. Kiểm thử end-to-end bằng dữ liệu mô phỏng (Module 3 → Module 4)

Xem `sql/validation_seed_test.sql` + kết quả chạy trong phần lịch sử triển khai:
sinh 250 điểm giả trong `monitoring_points` (đã tính R và nhóm ưu tiên theo đúng
Module 3), gọi `/api/validate` qua Node, nhận kết quả hợp lý (χ²/AUC/OR đều có ý
nghĩa thống kê đúng theo quan hệ R↔khong_dat đã cấy sẵn), sau đó **xóa sạch dữ liệu
giả** khỏi Supabase (không để lẫn với dữ liệu thật 1.219 điểm).

## 5. Kết luận kiểm định

✅ `stats_service` đã được kiểm định bằng:
1. Bộ dữ liệu cố định với tham số thật đã biết trước (β1=4.0 → OR=54.6, nằm trong KTC 95% ước lượng).
2. Đối chiếu độc lập bằng công thức toán học tay (không dùng thư viện thống kê) — khớp 6 chữ số thập phân.
3. Kiểm thử end-to-end qua toàn bộ pipeline Node → FastAPI → kết quả JSON.

⚠️ **Hạn chế cần lưu ý:** chưa đối chiếu trực tiếp với phần mềm R/Stata do môi
trường phát triển không có sẵn. Khuyến nghị: trước khi công bố kết quả nghiên cứu
chính thức, chạy `verify.R` trên máy có cài R + package `pROC`, `car` để xác nhận
thêm một lớp đối chiếu độc lập bằng phần mềm thống kê chuyên dụng khác.
