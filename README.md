# HCDC-Sentinel WebGIS

Hệ thống WebGIS giám sát chất lượng nước sạch của HCDC (TP. Hồ Chí Minh): bản đồ mẫu nước đạt/không đạt, cảnh báo rủi ro bằng AI, nhập liệu kết quả xét nghiệm, và bộ công cụ nghiên cứu khoa học (Delphi/AHP, chấm điểm nguy cơ, kiểm chứng thống kê).

Trang chạy: https://hcdc-ap.github.io/webgis/

## Tài liệu

| Tài liệu | Dành cho |
|---|---|
| [HUONG_DAN_SU_DUNG.md](HUONG_DAN_SU_DUNG.md) | Cán bộ giám sát: đăng nhập, bộ lọc, bản đồ, nhập Excel, chatbot, xử lý sự cố |
| [HUONG_DAN_NGHIEN_CUU.md](HUONG_DAN_NGHIEN_CUU.md) | Nghiên cứu viên (admin): quy trình KAMET → AHP → chấm điểm → kiểm chứng thống kê → báo cáo |
| [stats_service/VERIFICATION.md](stats_service/VERIFICATION.md) | Bằng chứng kiểm định công cụ thống kê |

## Kiến trúc

```
Trình duyệt (GitHub Pages, file tĩnh, chi phí 0đ)
 ├─ index.html + app.js        giao diện bản đồ, nhập liệu, nghiên cứu
 ├─ ahp.html + ahp.js          trang chuyên gia nộp ma trận AHP (link riêng, không cần đăng nhập)
 ├─ ahp-core.js, scoring-core.js   lõi tính AHP và chấm điểm (có test)
 ├─ stats-worker.js + stats_core.py   kiểm chứng thống kê chạy NGAY TRONG TRÌNH DUYỆT (Pyodide)
 └─ gọi trực tiếp ──► Supabase (project HCDC_Water_GIS)
                       ├─ Postgres + RLS    dữ liệu và phân quyền
                       ├─ Auth              đăng nhập
                       ├─ Edge Functions    hcdc-chatbot, generate-embeddings, gemini-proxy
                       └─ Realtime          cập nhật dữ liệu

GitHub Actions (repo hcdc-ap/EBS, workflow daily_ai_analysis.yml)
 └─ predict_ai.py hằng ngày → ghi nhận định vào ai_daily_insights
```

- **Trên GitHub Pages** ứng dụng gọi thẳng Supabase bằng khóa **publishable** (khóa công khai, an toàn nhờ RLS).
- **Khi chạy ở `localhost`**, ứng dụng đi qua `server.js` (Express) để khóa thật nằm trong `.env`, không lộ ra trình duyệt.
- **Gemini AI** đi qua Edge Function `gemini-proxy`: chỉ người **đã đăng nhập** mới gọi được; khóa `GEMINI_API_KEY` nằm trong secret của Supabase.
- **Kiểm chứng thống kê** dùng Pyodide (Python/WASM) trong trình duyệt nên không cần server Python; `stats_service/` (FastAPI) vẫn giữ để chạy kiểm định công cụ.

## Chạy cục bộ

```bash
npm install
cp .env.example .env      # điền SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY
npm start                 # http://localhost:3000
```

Kiểm thử lõi tính toán (không ghi vào cơ sở dữ liệu):

```bash
node test/ahp_test.js
node test/module5_test.js
node test/tab1_fail_count_test.js
```

Các test `scoring_test.js`, `validation_test.js`, `kamet_test.js` cần nạp dữ liệu giả (`sql/*_seed_test.sql`): **không chạy trên cơ sở dữ liệu thật**.

## Triển khai

Chỉ các file giao diện được đẩy lên GitHub Pages (nhánh `main`):

`index.html`, `app.js`, `ahp.html`, `ahp.js`, `ahp-core.js`, `scoring-core.js`, `style.css`, `stats-worker.js`, `stats_core.py`, `sw.js`, `manifest.json`, `README.md` và các file hướng dẫn.

**Không đẩy lên GitHub:** `.env`, mọi file chứa token/khóa (ví dụ `FIX.txt`), `server.js`, `node_modules`.

Sau khi đổi `app.js`/`style.css`, tăng số phiên bản `?v=` trong `index.html` để trình duyệt tải bản mới (GitHub Pages cache tệp tĩnh khoảng 10 phút).

Edge Function:

```bash
supabase functions deploy gemini-proxy --project-ref <ref> --use-api
```

## Bảo mật cơ sở dữ liệu

- Mọi bảng bật RLS. Dữ liệu nghiên cứu (`monitoring_points`, `point_attributes`, `analysis_runs`, `delphi_responses`...) chỉ admin đọc/ghi.
- Quyền ghi công khai đã được gỡ khỏi `units`, `settings`, `threshold_configs`, `hcdc_knowledge`, `epidemic_diarrhea` (xem `sql/security_hardening_20261112.sql`).
- `ai_daily_insights` vẫn cho ghi (INSERT/UPDATE) vì pipeline AI hằng ngày ghi bằng khóa ngoài. **Việc cần làm:** chuyển pipeline sang `service_role` rồi khóa nốt hai quyền này.
- `water_reports`: bỏ chính sách cho mọi tài khoản đăng nhập chèn dữ liệu của đơn vị bất kỳ; người dùng thường chỉ ghi dữ liệu đơn vị mình.
- Không bao giờ đặt token quản trị Supabase (`sbp_...`), `service_role` hay khóa Gemini vào mã nguồn hoặc repo public.

## Lịch sử thay đổi gần đây (12/11/2026)

- Sửa lỗi mất kết nối dữ liệu: `leaflet.heat` tự nâng lên bản 1.0 dạng ES module nên lỗi `import`/`L.heatLayer`; đã ghim `leaflet.heat@0.2.0`.
- Bản chạy được trên GitHub Pages (gọi thẳng Supabase), Gemini qua Edge Function, kiểm chứng thống kê chạy bằng Pyodide.
- Sửa `stats_core.py`: tính VIF có hằng số tường minh để kết quả giống nhau giữa các phiên bản statsmodels.
- Sửa nhập Excel: `sample_code` là khóa duy nhất thật của bảng `water_reports`; xem trước và ghi đè đối soát theo mã mẫu.
- Service Worker không còn chặn request (hết lỗi `Failed to fetch`).
- Nút **Cảnh báo**: khi nhận định AI của ngày không có địa bàn nào, hiện thông báo rõ thay vì báo "không khớp ranh giới".
- Siết RLS; thêm bộ hướng dẫn sử dụng và nghiên cứu.
