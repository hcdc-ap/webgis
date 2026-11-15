# Turf 6.5.0 rút gọn

`app.js` chỉ dùng 10 hàm Turf, nên thay vì tải `@turf/turf@6.5.0` đầy đủ (~153KB gzip)
ta dùng bản đóng gói riêng (~104KB gzip). Kết quả các hàm đã được đối chiếu giống hệt bản đầy đủ.

Nếu `app.js` dùng thêm hàm Turf mới, phải thêm vào `entry.js` rồi đóng gói lại:

```bash
mkdir turfbuild && cd turfbuild && npm init -y
npm i esbuild@0.24.0 @turf/helpers@6.5.0 @turf/bbox@6.5.0 @turf/boolean-point-in-polygon@6.5.0 \
  @turf/buffer@6.5.0 @turf/center-of-mass@6.5.0 @turf/dissolve@6.5.0 @turf/distance@6.5.0 \
  @turf/flatten@6.5.0 @turf/square-grid@6.5.0        # + gói của hàm mới
cp ../vendor/turf/entry.js .                           # thêm dòng export cho hàm mới
npx esbuild entry.js --bundle --minify --format=iife --global-name=turf --target=es2017 \
  --legal-comments=none --outfile=../vendor/turf/turf-6.5.0-custom.min.js
```

Kiểm tra nhanh hàm nào đang dùng: `grep -o "turf\.[a-zA-Z]*" app.js | sort -u`
Lưu ý: Turf 6.5.0 không có `booleanValid`.
