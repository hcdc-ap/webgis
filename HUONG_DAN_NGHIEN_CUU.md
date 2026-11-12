# Hướng dẫn thực hiện nghiên cứu khoa học trên HCDC-Sentinel WebGIS

Tài liệu dành cho **nghiên cứu viên có tài khoản admin**. Quy trình xây dựng và kiểm chứng bộ tiêu chí đánh giá nguy cơ chất lượng nước gồm 5 bước, phải làm **đúng thứ tự** vì kết quả bước trước là đầu vào của bước sau.

```
Bước 0  Chuẩn bị dữ liệu và tài khoản
   ↓
Bước 1  KAMET (Delphi)      → chọn tiêu chí         → bảng delphi_criteria
   ↓
Bước 2  AHP                 → trọng số tiêu chí     → bảng criteria_weights
   ↓
Bước 3  Chấm điểm nguy cơ   → điểm R từng điểm      → bảng monitoring_points
   ↓
Bước 4  Kiểm chứng thống kê → R có phân biệt đạt/không đạt không?
   ↓
Bước 5  Xuất kết quả và báo cáo
```

Các nút của bước 1–3 nằm ở thanh bên trái (chỉ admin thấy): **KAMET - DUYỆT TIÊU CHÍ**, **TỔNG HỢP TRỌNG SỐ AHP**, **CHẤM ĐIỂM NGUY CƠ**, và nút mở **KẾT QUẢ NGHIÊN CỨU**.

## Nguyên tắc để kết quả đáng tin

1. **Không dùng dữ liệu test.** Các file `sql/*_seed_test.sql` chỉ để kiểm thử phần mềm. Chạy chúng trên cơ sở dữ liệu thật sẽ trộn dữ liệu giả vào nghiên cứu.
2. **Chốt dữ liệu trước khi chạy** (mẫu 2025 đã duyệt, chuyên gia đã nộp đủ). Nếu dữ liệu đổi sau đó, phải chạy lại từ bước bị ảnh hưởng.
3. **Ghi lại mỗi lần chạy.** Bước 3 và bước 4 tự lưu một dòng bất biến vào `analysis_runs` (kèm checksum dữ liệu, N, trọng số đã dùng). Ghi mã lần chạy vào sổ nghiên cứu.
4. **Giữ nguyên tham số kiểm định**: α = 0,05; bootstrap = 2.000 lần; hạt giống ngẫu nhiên = 42. Giữ cố định thì chạy lại sẽ ra cùng kết quả.
5. **Phần diễn giải do AI soạn chỉ là bản nháp**; nghiên cứu viên phải kiểm chứng trước khi đưa vào báo cáo.

---

## Bước 0. Chuẩn bị

### 0.1. Tài khoản
- Đăng nhập bằng tài khoản có `role = admin`. Nếu không thấy các nút nghiên cứu, tài khoản chưa phải admin.

### 0.2. Dữ liệu mẫu nước (đầu vào bước 3)
Bước 3 chỉ lấy từ `water_reports` các mẫu thỏa **cả ba điều kiện**:
- ngày lấy mẫu từ **01/01/2025 đến 31/12/2025**;
- trạng thái `status = 'approved'` (đã duyệt);
- có tọa độ `lat`, `lng`.

Kiểm tra trước: tổng số mẫu 2025 đã duyệt khớp với số liệu Tab 1 trong *Kết quả nghiên cứu* (ví dụ n = 2.515).

### 0.3. Dữ liệu chuyên gia
- `delphi_responses`: điểm đánh giá **mức cần thiết** (phương diện `can_thiet`) của từng chuyên gia cho từng tiêu chí.
- `delphi_experts`: danh mục chuyên gia (`ma_chuyen_gia`, `ho_ten`, `don_vi`, `active = true`).
- `delphi_criteria`: danh mục tiêu chí.
- Hiện **chưa có giao diện nhập** `delphi_responses`; nạp bằng Supabase (Table Editor > Import CSV hoặc SQL Editor). Tại thời điểm viết tài liệu, bảng này đang trống.

### 0.4. Thuộc tính điểm giám sát (đầu vào bước 3, chấm điểm)
- Bảng `point_attributes` chứa thuộc tính của từng điểm (mã điểm `point_code` và các cột như `vi_tri_mang`, `water_age_gio`, `tuoi_ong_nam`, `mat_do_dan_cu`, `ca_benh_tieu_hoa`...). Các cột này ứng với mã tiêu chí KN01…KN11, HQ01…, DBP…
- **Phải nạp trước bước 3.** Tại thời điểm viết tài liệu bảng này đang trống, nên bước chấm điểm chưa thể cho điểm R.
- Điểm nào thiếu dữ liệu một số tiêu chí vẫn được chấm: hệ thống tự chuẩn hóa lại trọng số của các tiêu chí còn có dữ liệu.

---

## Bước 1. KAMET: duyệt bộ tiêu chí bằng Delphi

**Mục đích:** loại các tiêu chí chuyên gia cho là không cần thiết, giữ tiêu chí đạt đồng thuận.

1. Bấm **KAMET - DUYỆT TIÊU CHÍ**.
2. Hệ thống tính từ `delphi_responses` cho **từng tiêu chí**: Mdqi (trung vị), Mqi (trung bình), Qqi (độ lệch tứ phân vị), Vqi (hệ số biến thiên, %).
3. Quy tắc phân loại (cố định, không chỉnh tay):

| Điều kiện | Kết luận |
|---|---|
| Mqi < 3,5 | **Loại** |
| Mqi ≥ 3,5 **và** Qqi ≤ 0,5 **và** Vqi < 15% | **Giữ lại** |
| Còn lại (kể cả chưa đủ dữ liệu vòng 2) | **Chuyển vòng sau** |

4. Xem các chip tổng hợp (số tiêu chí giữ/loại/vòng sau) và bảng chi tiết. Bấm **TÍNH LẠI** nếu vừa nạp thêm dữ liệu.
5. Khi hội đồng đồng ý, bấm **CHỐT KẾT QUẢ VÀO delphi_criteria** và xác nhận. Việc này ghi `trang_thai` (`giu_lai` / `loai` / `vong_sau`) vào từng tiêu chí.
6. Còn tiêu chí `vong_sau`: tổ chức vòng Delphi tiếp theo, nạp thêm dữ liệu, lặp lại bước 1–5 cho đến khi không còn tiêu chí chờ.

**Điều kiện chuyển bước:** chỉ các tiêu chí `giu_lai` được đưa sang AHP (bước 2).

---

## Bước 2. AHP: xác định trọng số

### 2A. Chuyên gia nộp ma trận so sánh cặp

1. Với mỗi chuyên gia đã có trong `delphi_experts` (`active = true`), gửi **đường link riêng**:

   `https://hcdc-ap.github.io/webgis/ahp.html?expert=<MÃ_CHUYÊN_GIA>`

   Ví dụ `?expert=CG01`. Mã không phân biệt chữ hoa/thường. Mã không có trong danh mục hoặc đã khóa thì trang báo lỗi và không cho nộp.
2. Chuyên gia mở link, **không cần đăng nhập**, so sánh từng cặp tiêu chí trong bốn ma trận: **GROUP** (giữa các nhóm), **KN**, **HQ**, **DBP** (trong từng nhóm). Nếu chỉ còn một nhóm tiêu chí thì bỏ ma trận GROUP.
3. Trang tự tính **CR (tỷ số nhất quán)** từng ma trận. **CR phải ≤ 0,10**; nếu cao hơn, chuyên gia cần xem lại các so sánh mâu thuẫn. Nút gửi chỉ mở khi mọi ma trận đạt.
4. Chuyên gia bấm gửi. Nếu sửa và gửi lại, bản mới **ghi đè** bản cũ của chính chuyên gia đó (theo cặp chuyên gia + ma trận).

### 2B. Admin tổng hợp

1. Bấm **TỔNG HỢP TRỌNG SỐ AHP**.
2. Hệ thống gộp các ma trận đã nộp bằng **trung bình nhân từng ô**, tính lại trọng số và CR tổng hợp cho từng ma trận (bảng hiển thị số chuyên gia, λmax, CI, CR).
3. Kiểm tra: **CR tổng hợp ≤ 0,10** ở mọi ma trận, và số chuyên gia đủ theo kế hoạch nghiên cứu.
4. Bấm **TÍNH LẠI** nếu có chuyên gia nộp thêm. Hệ thống tính trọng số toàn cục = trọng số nhóm × trọng số cục bộ (tổng luôn = 1).
5. Bấm **LƯU TRỌNG SỐ TOÀN CỤC** và xác nhận. Việc này **ghi đè** bảng `criteria_weights`. Nếu tổng trọng số lệch 1 quá 0,001 thì hệ thống từ chối lưu.

**Điều kiện chuyển bước:** `criteria_weights` có đầy đủ trọng số cho các tiêu chí đã giữ lại.

---

## Bước 3. Chấm điểm nguy cơ

Bấm **CHẤM ĐIỂM NGUY CƠ**. Làm lần lượt hai bước trong cửa sổ.

### 3.1. BƯỚC 1: GỘP MẪU → ĐIỂM
1. Bấm **BƯỚC 1: GỘP MẪU → ĐIỂM**.
2. Hệ thống tải các mẫu 2025 đã duyệt có tọa độ (điều kiện ở mục 0.2), gộp thành **điểm giám sát duy nhất** theo tọa độ làm tròn 5 chữ số thập phân.
3. Một điểm được tính **không đạt (`khong_dat = 1`) nếu có ít nhất một mẫu không đạt** (`hl_vs = 'K'`) tại điểm đó.
4. Kết quả lưu vào `monitoring_points` (khoảng 1.219 điểm). Số điểm sau gộp phải hợp lý so với số mẫu đã tải; ghi lại cả hai số.

### 3.2. BƯỚC 2: CHẤM ĐIỂM NGUY CƠ
1. Bấm **BƯỚC 2: CHẤM ĐIỂM NGUY CƠ**. Cần có `criteria_weights` (bước 2) và `point_attributes` (mục 0.4); thiếu trọng số thì hệ thống cảnh báo "hoàn tất Module 2 trước".
2. Với mỗi điểm, hệ thống chuẩn hóa từng tiêu chí về thang 0–1 (min–max cho biến liên tục, 0/1 cho biến nhị phân, quy đổi cho biến thứ hạng), rồi tính **R = Σ (trọng số × giá trị chuẩn hóa)**.
3. Hệ thống xếp hạng R giảm dần và chia **4 nhóm ưu tiên theo tứ phân vị**: *Ưu tiên cao* (R ≥ Q3), *Trung bình-cao*, *Trung bình*, *Thấp* (R < Q1).
4. Kết quả lưu vào `monitoring_points` (`diem_r`, `xep_hang`, `nhom_uu_tien`) và một dòng bằng chứng vào `analysis_runs`.
5. Bấm **MỞ BẢN ĐỒ ƯU TIÊN** để xem bản đồ các điểm theo nhóm ưu tiên.

**Điều kiện chuyển bước:** phải có ít nhất **10 điểm có `diem_r`**.

---

## Bước 4. Kiểm chứng thống kê

**Câu hỏi nghiên cứu:** điểm nguy cơ R có thật sự phân biệt được điểm đạt và điểm không đạt QCVN hay không?

1. Mở modal **KẾT QUẢ NGHIÊN CỨU**, chọn **Tab 3: Kiểm chứng & bản đồ ưu tiên**.
2. Bấm **CHẠY KIỂM CHỨNG THỐNG KÊ**.
   - Phép tính chạy **ngay trong trình duyệt** (Python/Pyodide), không cần server.
   - **Lần chạy đầu cần tải khoảng 60MB nên mất 1–2 phút** (cần mạng ổn định). Các lần sau nhanh hơn nhờ bộ nhớ đệm của trình duyệt.
   - Không đóng tab hoặc tải lại trang khi đang chạy.
3. Hệ thống gửi cho bộ kiểm định chỉ số liệu **đã ẩn danh** (không định danh, không tọa độ): trạng thái đạt/không đạt, R, nhóm ưu tiên và các giá trị tiêu chí.
4. Kết quả gồm:

| Nhóm phân tích | Nội dung | Cách đọc |
|---|---|---|
| So sánh nhóm | χ² hoặc Fisher; kiểm định xu hướng Cochran-Armitage theo nhóm ưu tiên | p < 0,05: tỷ lệ không đạt khác nhau giữa các nhóm; xu hướng tăng theo nhóm ưu tiên là kết quả mong đợi. |
| Logistic đơn biến | OR của R với khong_dat | OR > 1 và khoảng tin cậy 95% không chứa 1: R càng cao, nguy cơ không đạt càng lớn. |
| Logistic đa biến | OR từng tiêu chí, VIF, cảnh báo | VIF > 5 (lưu ý) hoặc > 10 (đa cộng tuyến nghiêm trọng) cần cân nhắc loại biến; đọc kỹ cảnh báo separation. |
| ROC-AUC | AUC (khoảng tin cậy bootstrap), điểm cắt Youden, độ nhạy/đặc hiệu, ma trận nhầm lẫn, Mann-Whitney | AUC 0,5 = không phân biệt; càng gần 1 càng tốt. Báo cáo cả khoảng tin cậy, không chỉ giá trị điểm. |

5. Hệ thống **tự lưu bằng chứng** vào `analysis_runs` (N, checksum dữ liệu, thời gian chạy). Ghi lại mã lần chạy.
6. Cần tối thiểu 10 điểm; nếu ít hơn hệ thống báo thiếu dữ liệu và không chạy.

### Kiểm định công cụ (làm một lần khi cài đặt hoặc nâng cấp)
Bộ kiểm định thống kê đã được đối chiếu với kết quả chuẩn của bộ dữ liệu cố định `stats_service/verify_dataset.csv` (300 điểm, OR thật ≈ 54,6). Nhóm kỹ thuật có thể chạy lại bằng `python verify.py` và `python independent_check.py` trong thư mục `stats_service`; bằng chứng nằm trong `stats_service/VERIFICATION.md`. Phiên bản chạy trên trình duyệt đã được so khớp với phiên bản native (404 giá trị so sánh, đã thống nhất cách tính VIF).

---

## Bước 5. Xuất kết quả và báo cáo

Trong modal **KẾT QUẢ NGHIÊN CỨU**:

| Tab | Nội dung | Xuất |
|---|---|---|
| Tab 1: Thực trạng 2025 | Thống kê **mô tả** trên mẫu (đơn vị = mẫu): đếm, tỷ lệ theo nhóm thông số, khu vực, loại mẫu. Không suy luận thống kê. | CSV theo nhóm thông số / khu vực / loại mẫu |
| Tab 2: Bộ tiêu chí & trọng số | Kết quả KAMET và trọng số AHP (đơn vị = tiêu chí), đọc trực tiếp từ DB | CSV bảng KAMET / bảng trọng số AHP |
| Tab 3: Kiểm chứng & bản đồ ưu tiên | Kết quả bước 4 (đơn vị = điểm) | Export CSV, Export PDF |

- **XUẤT BÁO CÁO TỔNG (PDF)**: gom toàn bộ kết quả thành một báo cáo.
- **Tạo diễn giải (AI hỗ trợ)**: AI nhận **các con số đã tính sẵn** và viết đoạn diễn giải 3–5 câu. Nội dung hiển thị kèm nhắc "cần nghiên cứu viên kiểm chứng". Chỉ dùng làm bản nháp. Chức năng này yêu cầu đã đăng nhập.

### Lưu ý về đơn vị phân tích (tránh nhầm khi viết báo cáo)
- Tab 1: đơn vị là **mẫu** (n = 2.515 theo dữ liệu hiện tại).
- Tab 2: đơn vị là **tiêu chí**.
- Tab 3 và bước 3–4: đơn vị là **điểm giám sát** (N ≈ 1.219). Một điểm "không đạt" nếu có ≥ 1 mẫu không đạt, nên tỷ lệ ở Tab 3 khác Tab 1.

---

## Danh mục kiểm tra trước khi công bố kết quả

- [ ] Dữ liệu mẫu 2025 đã chốt, không còn mẫu chờ duyệt.
- [ ] Tab 1: tổng mẫu khớp sổ sách.
- [ ] Bước 1: đã chốt vào `delphi_criteria`, không còn tiêu chí `vong_sau` ngoài kế hoạch.
- [ ] Bước 2: CR tổng hợp ≤ 0,10 ở mọi ma trận, số chuyên gia đủ, đã lưu trọng số (tổng = 1).
- [ ] Bước 3: `point_attributes` nạp đầy đủ; số điểm sau gộp được ghi lại; chạy lại sau mỗi lần đổi trọng số.
- [ ] Bước 4: chạy trên đúng bộ trọng số vừa chốt; đã ghi mã lần chạy (analysis_runs), N và checksum; tham số α = 0,05, bootstrap = 2.000, seed = 42.
- [ ] Đọc cả cảnh báo (VIF, separation) trước khi diễn giải OR.
- [ ] Diễn giải AI đã được nghiên cứu viên kiểm chứng.
- [ ] Đã xuất CSV/PDF và lưu cùng với mã lần chạy.

## Xử lý sự cố

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Không thấy nút KAMET/AHP/Chấm điểm | Không phải admin | Cấp `role = admin` trong bảng `profiles`. |
| KAMET không có số liệu | `delphi_responses` trống | Nạp dữ liệu chuyên gia (mục 0.3). |
| Link AHP báo chuyên gia không hợp lệ | Mã sai hoặc `active = false` | Kiểm tra `delphi_experts`. |
| Tổng hợp AHP báo "chưa có tiêu chí giữ lại" | Chưa chốt KAMET | Làm bước 1. |
| Chấm điểm báo "chưa có trọng số" | Chưa lưu `criteria_weights` | Làm bước 2B. |
| Không có điểm R sau bước 3.2 | `point_attributes` trống | Nạp thuộc tính điểm (mục 0.4). |
| Kiểm chứng báo "Cần tối thiểu 10 điểm đã có điểm R" | Chưa chấm điểm | Làm bước 3. |
| Kiểm chứng đứng lâu ở trạng thái tải | Lần đầu tải ~60MB hoặc mạng chậm | Đợi 1–2 phút; nếu quá 5 phút, tải lại trang (Ctrl+F5) và chạy lại. |
| Kiểm chứng báo lỗi sau khi đổi mạng | Không tải được thư viện Python từ CDN | Kiểm tra mạng/tường lửa cho phép `cdn.jsdelivr.net`. |
