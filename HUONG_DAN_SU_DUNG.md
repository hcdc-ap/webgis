# Hướng dẫn sử dụng HCDC-Sentinel WebGIS

Trang web: https://hcdc-ap.github.io/webgis/

> Phần **Nghiên cứu khoa học** (KAMET, AHP, chấm điểm nguy cơ, kiểm chứng thống kê) được tách riêng tại
> [HUONG_DAN_NGHIEN_CUU.md](HUONG_DAN_NGHIEN_CUU.md). Tài liệu này chỉ hướng dẫn các chức năng giám sát hằng ngày.

## 1. Đăng nhập

1. Mở trang web, nhập **Email** và **Mật khẩu** do quản trị cấp rồi bấm **Login**.
2. Hệ thống đọc vai trò (`role`) của tài khoản trong bảng `profiles`:
   - **admin**: thấy đầy đủ nút, kể cả nhóm nghiên cứu (KAMET, AHP, Chấm điểm, Kết quả nghiên cứu).
   - Tài khoản thường: chỉ xem dữ liệu và nhập liệu cho đơn vị của mình.
3. Đổi mật khẩu: bấm mục **Đổi mật khẩu** ở cuối thanh bên (cần nhập mật khẩu hiện tại). Nên đổi ngay lần đăng nhập đầu tiên.
4. Nếu đăng nhập báo lỗi, kiểm tra: đúng email, đúng mật khẩu, tài khoản đã có dòng trong bảng `profiles`.

## 2. Màn hình chính

| Khu vực | Chức năng |
|---|---|
| Bản đồ (giữa) | Hiển thị mẫu nước: xanh = **Đạt**, cam = **Không đạt**. Nhiều điểm gần nhau được gom thành cụm (bấm vào để phóng to). |
| Nút lớp bản đồ (góc phải trên) | Bật/tắt các lớp: ranh giới hành chính, **Heatmap** (mật độ mẫu không đạt), lớp nội suy. |
| Chú giải (Legend) | Giải thích màu điểm và ranh giới. |
| Thanh bên trái | Bộ lọc dữ liệu (mục 3). |
| Bảng dưới bản đồ | Danh sách mẫu tìm thấy theo bộ lọc; nút **Xuất dữ liệu** để tải về. |
| Nút Chatbot (góc phải dưới) | Hỏi đáp bằng AI về chất lượng nước và căn cứ pháp lý. |

## 3. Bộ lọc dữ liệu

1. **Khoảng thời gian lấy mẫu**: kéo thanh trượt hoặc chọn *Từ ngày – Đến ngày*. Mặc định là 30 ngày gần nhất.
2. **Đánh giá KQXN**: lọc theo kết quả Đạt / Không đạt.
3. **Đơn vị / CSCCN**: chọn một cơ sở cung cấp nước.
4. **KQXN (Không đạt)**: tích nhóm không đạt cần xem (Vi sinh, Hóa lý, Hiện trường, Đánh giá chung).
5. **Nội suy theo thông số**: chọn thông số (ví dụ Clo dư 0,2–1,0 mg/L) để tô màu nội suy IDW trên bản đồ.
6. Bản đồ và bảng danh sách tự cập nhật theo bộ lọc. Dòng chữ "Tìm thấy: N mẫu" cho biết số lượng.

## 4. Time Series

Bấm **Time Series** (dưới thanh trượt thời gian) để phát lại diễn biến mẫu theo thời gian trên bản đồ.

## 5. Dashboard và Thống kê & phân tích

- **DASHBOARD**: các chỉ số tổng hợp (tỷ lệ đạt, số mẫu, biểu đồ theo đơn vị/thông số).
- **THỐNG KÊ & PHÂN TÍCH**: biểu đồ và bảng thống kê chi tiết theo thời gian, khu vực, loại mẫu.
- Số liệu lấy từ các mẫu đang được lọc; đổi bộ lọc rồi mở lại để cập nhật.

## 6. Xuất dữ liệu và in bản đồ

- **Xuất dữ liệu** (bảng dưới bản đồ): tải danh sách mẫu đang lọc dưới dạng file CSV (mở được bằng Excel).
- **In bản đồ**: dùng nút máy in ở góc trên trái bản đồ (Browser Print).

## 6A. Báo cáo định kỳ (nút REPORT)

Nút **REPORT** nằm cùng khu với **PASSWORD**, **GUIDE** và **LOGOUT** (đầu thanh bên). Nút **GUIDE** mở trực tiếp bộ hướng dẫn này trong tab mới.

1. Chọn **khoảng thời gian** của kỳ báo cáo bằng thanh trượt hoặc ô *Từ ngày – Đến ngày*.
2. Bấm **REPORT**. Cửa sổ **Xem trước báo cáo** hiện:
   - **A. Tình hình chung**: số đơn vị phụ trách, tổng công suất và tổng số hộ (tính trên **toàn danh mục** cơ sở nội kiểm, không đổi theo kỳ), số cơ sở nội kiểm có lấy mẫu trong kỳ (so với tổng số cơ sở).
   - **B. Nội kiểm đơn vị**: tổng mẫu, mẫu đạt, mẫu không đạt, thông số không đạt.
   - **C. Ngoại kiểm** (theo mẫu chọn): *Mẫu 03 HCDC* hoặc *Mẫu 04 TYT (tuyến cơ sở)*.
3. Mục "Thông số không đạt" hiện màu xanh khi không có thông số nào vượt ngưỡng, màu đỏ khi có. Dòng đầu cửa sổ cho biết **tổng mẫu trong kỳ = nội kiểm + ngoại kiểm** để bạn đối chiếu. Nếu có mẫu có đơn vị lấy mẫu không nằm trong danh mục, hệ thống cảnh báo màu đỏ.
4. Chọn loại biểu mẫu ở chân cửa sổ rồi bấm **XUẤT GOOGLE DOCS** để tạo văn bản; bấm **MỞ BÁO CÁO** để mở file vừa tạo.

Quy tắc tính (cần biết khi dùng số liệu):
- Báo cáo **chỉ phụ thuộc khoảng thời gian**; các bộ lọc khác (đạt/không đạt, thông số, đơn vị) **không** làm đổi số liệu báo cáo.
- Mẫu **nội kiểm** là mẫu do chính cơ sở cấp nước lấy; **ngoại kiểm** là mẫu do HCDC (`tphcm`, `binhduong`, `brvt`, `hcdc`) hoặc phường/xã lấy. Hệ thống phân loại theo đơn vị lấy mẫu trong danh mục đơn vị.
- Kết luận **đạt/không đạt** lấy theo cột đánh giá của hệ thống (giống bản đồ và Dashboard).
- **Số đơn vị ngoại kiểm thực tế** hiện hiển thị "chưa xác định" vì dữ liệu mẫu ngoại kiểm chưa gắn với cơ sở cấp nước cụ thể.

## 7. Nhập liệu KQXN từ Excel (nhập kết quả xét nghiệm)

Nút **NHẬP LIỆU KQXN** ở thanh bên. Việc ghi dữ liệu vào hệ thống do cơ sở dữ liệu kiểm soát theo vai trò: admin ghi được mọi đơn vị; tài khoản thường chỉ ghi được dữ liệu của đơn vị mình.

### 7.1. Chuẩn bị file Excel

- Dùng đúng **file mẫu** của hệ thống. **Dòng tiêu đề nằm ở dòng 4** của sheet đầu tiên (hệ thống bỏ qua 3 dòng đầu).
- Các cột bắt buộc: `mamau` (mã mẫu), `maphuong` (mã đơn vị/phường), `ngaylaymau` (ngày lấy mẫu, dạng `dd-mm-yyyy`), `lat`, `lng` (tọa độ), kèm các cột kết quả xét nghiệm.
- **Mã mẫu (`mamau`) phải duy nhất trên toàn hệ thống.** Hai mẫu ở phường hoặc ngày khác nhau cũng không được trùng mã.
- Mã đơn vị phải tồn tại trong danh mục `units`. Mã quận (nếu có) phải là `KHUVUC1/2/3` hoặc mã trạm hợp lệ.

### 7.2. Các bước nhập

1. Bấm **NHẬP LIỆU KQXN**, chọn file Excel. Hệ thống **xem trước** từng dòng:
   - Dòng ✅ **OK**: mẫu mới.
   - Dòng vàng ⚠️ **Đã có trên DB**: mã mẫu đã tồn tại.
   - Dòng đỏ ❌ **Lỗi**: nêu rõ lý do (thiếu mã mẫu, sai ngày, mã đơn vị không tồn tại...). Dòng lỗi sẽ không được nhập.
2. Xem bảng tổng kết: **Tổng cộng / Mới / Trùng / Lỗi**.
3. Nếu có dòng **Trùng** và bạn muốn cập nhật, tích ô **"Đồng ý ghi đè dữ liệu nếu trùng mã mẫu"**.
4. Bấm **Xác nhận nhập vào Database**.

### 7.3. Quy tắc trùng và ghi đè

- Khóa duy nhất của mẫu là **mã mẫu**. Khi ghi đè, dòng cũ có cùng mã mẫu được **cập nhật toàn bộ**, kể cả phường và ngày lấy mẫu.
- Nếu trong file có 2 dòng cùng mã mẫu, hệ thống giữ dòng **cuối cùng**.
- Nếu không tích ghi đè mà có mã trùng, hệ thống báo lỗi và không nhập dòng nào.

### 7.4. Xử lý lỗi thường gặp

| Thông báo | Cách xử lý |
|---|---|
| Thiếu mã mẫu (mamau) | Điền mã mẫu ở dòng đó. |
| Ngày sai định dạng | Nhập ngày theo `dd-mm-yyyy` hoặc dùng ô ngày của Excel. |
| Mã phường không tồn tại | Dùng đúng mã đã có trong danh mục đơn vị. |
| Phát hiện mã mẫu đã tồn tại | Tích "Đồng ý ghi đè" rồi nhập lại. |
| Vi phạm ràng buộc duy nhất dù đã chọn ghi đè | Chụp lại nội dung chi tiết trong thông báo và báo quản trị. |
| Vẫn thấy thông báo cũ sau khi hệ thống đã cập nhật | Trình duyệt đang dùng bản cũ: nhấn **Ctrl+F5** (Mac: Cmd+Shift+R). |

## 8. Chatbot AI

1. Bấm nút **Chatbot** ở góc phải dưới.
2. Đặt câu hỏi, ví dụ "Tình hình chất lượng nước tháng 10/2026?". Chatbot đọc số liệu của tháng được hỏi và các căn cứ pháp lý đã nạp.
3. Câu trả lời do AI soạn: cần đối chiếu với số liệu gốc trước khi dùng trong báo cáo chính thức.

## 9. Cài ứng dụng lên máy (PWA)

Trên Chrome/Edge, bấm biểu tượng **Cài đặt** ở thanh địa chỉ để cài như một ứng dụng độc lập.

## 10. Xử lý sự cố chung

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Trang trắng hoặc dữ liệu không tải | Mạng chặn CDN hoặc trình duyệt giữ bản cũ | Nhấn **Ctrl+F5**; kiểm tra mạng; mở F12 > Console xem lỗi đỏ. |
| Không thấy nút KAMET/AHP/Chấm điểm | Tài khoản không phải admin | Nhờ quản trị cấp quyền `admin` trong bảng `profiles`. |
| Cảnh báo `reload.js ... WebSocket ... failed` | Tiện ích live-reload của trình duyệt/IDE, không thuộc hệ thống | Bỏ qua. |
| Cảnh báo `Fetch event handler is recognized as no-op` | Đã được xử lý bằng cách bỏ fetch handler | Nhấn Ctrl+F5 một lần để Service Worker cập nhật. |
