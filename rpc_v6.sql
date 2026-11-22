
DECLARE
    v_total_risk FLOAT;
BEGIN
    -- 1. Tính tổng rủi ro (Nếu không có phường nào thì lấy toàn TP)
    SELECT SUM(COALESCE((SELECT SUM(capacity) FROM v_csccn c WHERE c.ward_commune = w."tenXa"), w."danSo")) 
    INTO v_total_risk 
    FROM hcm_ward_stats w 
    WHERE (cardinality(in_wards) = 0 OR w."maXa"::text = ANY(in_wards));

    IF v_total_risk IS NULL OR v_total_risk = 0 THEN v_total_risk := 1; END IF;

    RETURN QUERY
    WITH ward_allocation AS (
        -- 2. Chia quota (Đảm bảo ít nhất mỗi phường 1 điểm và không vượt quá 500)
        SELECT 
            w."maXa"::text as ma_xa_txt, 
            w."tenXa", 
            w.geom as ward_geom,
            LEAST(500, GREATEST(1, CEIL(
                (COALESCE((SELECT SUM(capacity) FROM v_csccn c WHERE c.ward_commune = w."tenXa"), w."danSo") / v_total_risk) * in_quota
            )))::int as limit_per_ward
        FROM hcm_ward_stats w 
        WHERE (cardinality(in_wards) = 0 OR w."maXa"::text = ANY(in_wards))
    ),
    candidates AS (
        -- NGUỒN 1: Điểm rủi ro (Nới lỏng 300m cho chắc chắn)
        SELECT wa.ma_xa_txt, rl.lat::float8 as lt, rl.lng::float8 as lg, rl.type, 999.0::float8 as p
        FROM risk_locations rl
        JOIN ward_allocation wa ON rl.maphuong = wa.ma_xa_txt
        WHERE (cardinality(in_risk_types) = 0 OR rl.type = ANY(in_risk_types))
          AND ST_DWithin(rl.geom::geography, wa.ward_geom::geography, 300)

        UNION ALL

        -- NGUỒN 2: Điểm ngẫu nhiên (XỬ LÝ TẤT CẢ KIỂU HÌNH HỌC)
        SELECT 
            wa.ma_xa_txt, 
            ST_Y((ST_Dump(geom_points)).geom)::float8,
            ST_X((ST_Dump(geom_points)).geom)::float8,
            'random_point', 
            100.0::float8
        FROM ward_allocation wa
        CROSS JOIN LATERAL (
            SELECT 
                CASE 
                    -- Nếu phường có hình học hợp lệ (polygon)
                    WHEN NOT ST_IsEmpty(valid_poly) 
                    THEN ST_GeneratePoints(valid_poly, 500)
                    -- Nếu phường suy biến (điểm/đường) → Tạo vùng buffer 100m quanh centroid
                    ELSE ST_GeneratePoints(ST_Buffer(ST_PointOnSurface(wa.ward_geom), 0.001), 500)
                END AS geom_points
            FROM (SELECT ST_CollectionExtract(ST_MakeValid(wa.ward_geom), 3) AS valid_poly) AS v
        ) AS gc

        UNION ALL

        -- NGUỒN 3: Tâm phường (Phao cứu sinh cuối cùng)
        SELECT wa.ma_xa_txt, ST_Y(ST_PointOnSurface(wa.ward_geom))::float8, ST_X(ST_PointOnSurface(wa.ward_geom))::float8,
               'centroid', 1.0::float8
        FROM ward_allocation wa
    ),
    ranked AS (
        SELECT c.*, ROW_NUMBER() OVER(PARTITION BY c.ma_xa_txt ORDER BY c.p DESC, RANDOM()) as rk
        FROM candidates c
    )
    -- 3. XUẤT KẾT QUẢ: Khớp chính xác với JavaScript
    SELECT 
        r.lt, r.lg, wa."tenXa"::text, r.p, r.type::text,
        (CASE WHEN r.p > 500 THEN '🔥 TRỌNG ĐIỂM NGUY CƠ' ELSE '🛡️ GIÁM SÁT ĐỊNH KỲ' END)::text
    FROM ranked r
    JOIN ward_allocation wa ON r.ma_xa_txt = wa.ma_xa_txt
    WHERE r.rk <= wa.limit_per_ward
    ORDER BY r.p DESC, RANDOM()
    LIMIT in_quota;
END;
