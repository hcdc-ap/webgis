# Font Awesome Free 6.0.0 (tự host)

- Tự host thay cho cdnjs để đổi `font-display: block` → `swap` (icon/chữ hiện ngay, không bị ẩn khi font đang tải).
- Chỉ dùng file `.woff2`.
- `css/all.min.css` đã được **lọc chỉ giữ icon đang dùng** (~19KB thay vì ~88KB).

**Khi thêm icon mới** (`fa-...`) vào `index.html` hoặc `app.js`, chạy lại:

```bash
python vendor/fontawesome/subset.py
```

rồi tăng `?v=` của dòng `all.min.css` trong `index.html`. Nếu quên, icon mới sẽ hiện ô trống.

`css/all.full.min.css` là bản đầy đủ làm nguồn cho script, trang không tải file này.
License: Icons CC BY 4.0, Fonts SIL OFL 1.1, Code MIT (https://fontawesome.com/license/free).
