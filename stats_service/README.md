# stats_service — Microservice kiểm định thống kê (Module 4)

Microservice FastAPI kiểm chứng bộ tiêu chí AHP: trả lời câu hỏi "điểm nguy cơ R
có thực sự phân biệt được điểm đạt/không đạt QCVN 2025 không?" bằng các phép kiểm
định thống kê chuẩn (scipy/statsmodels/scikit-learn) — **không tự viết công thức
thống kê bằng JavaScript**.

## Cài đặt

```bash
cd stats_service
python -m venv venv          # khuyến nghị dùng virtualenv riêng
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

## Chạy service

```bash
uvicorn main:app --host 127.0.0.1 --port 8000
```

- **Chỉ nghe `127.0.0.1` (loopback)** — không mở ra mạng ngoài, không dùng `0.0.0.0`.
- Chạy **song song** với Node/Express (`node server.js` ở cổng 3000): mở 2 terminal,
  mỗi terminal chạy 1 service. Node gọi sang Python qua `http://127.0.0.1:8000`
  (route nội bộ `/api/validate` trong `server.js`), Python không tự expose ra ngoài.
- Kiểm tra service sống: `GET http://127.0.0.1:8000/health` (trả về trạng thái +
  phiên bản thư viện).

## Endpoint

### `POST /validate`

Đầu vào — xem hợp đồng dữ liệu đầy đủ trong đặc tả Module 4 (mục 4.2). Tóm tắt:

```json
{
  "points": [
    {"khong_dat": 0, "R": 0.42, "nhom_uu_tien": "tb", "features": {"KN01": 0.3, "KN06": 1}}
  ],
  "alpha": 0.05,
  "bootstrap_n": 2000,
  "random_state": 42
}
```

Đầu ra: JSON gồm `metadata` (N, tỷ lệ, phiên bản thư viện, thời gian chạy) +
`group_comparison` (χ²/Fisher + Cochran-Armitage) + `logistic_univariate` +
`logistic_multivariate` (kèm VIF, cảnh báo separation) + `roc_auc` (ROC, AUC
bootstrap, Youden, ma trận nhầm lẫn, Mann-Whitney).

## Kiểm định công cụ (BẮT BUỘC trước khi dùng thật)

```bash
python gen_verify_dataset.py   # (đã chạy 1 lần, tạo verify_dataset.csv cố định)
python verify.py               # chạy toàn bộ phân tích, in kết quả + lưu verify_output.json
python independent_check.py    # đối chiếu độc lập bằng công thức toán học thuần (numpy)
```

Xem **`VERIFICATION.md`** để biết đầy đủ bảng đối chiếu kết quả — đây là bằng chứng
"phần mềm đã được kiểm định" mà hội đồng sẽ yêu cầu.

`verify.R` là script R **tham khảo** (chưa chạy được do môi trường phát triển không
có R cài đặt) — xem ghi chú hạn chế trong `VERIFICATION.md`.

## Kiểm thử mô phỏng (end-to-end, KHÔNG để lẫn dữ liệu thật)

```bash
npx supabase db query --linked -f ../sql/validation_seed_test.sql   # seed ~250 điểm giả
node ../test/validation_test.js                                     # chạy qua /api/validate, đối chiếu, tự dọn dẹp
```

## Bảo mật

- Service chỉ nghe `127.0.0.1:8000` — không thể truy cập từ máy khác.
- Node (`server.js`) là nơi DUY NHẤT gọi tới service này, và **xác thực người dùng
  là admin** (kiểm tra JWT + `profiles.role='admin'`) trước khi proxy request.
- Dữ liệu gửi sang Python **đã ẩn danh** (chỉ `khong_dat`, `R`, `nhom_uu_tien`,
  `features` — không có tọa độ, địa chỉ, hay bất kỳ định danh nào).
