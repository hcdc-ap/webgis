-- Siết RLS (2026-11-12). Trước đó 6 bảng có policy "Allow public all" => ai có anon key (công khai trong trang web)
-- đều sửa/xóa được dữ liệu. Ứng dụng KHÔNG ghi vào các bảng này từ trình duyệt; đọc công khai vẫn được giữ nguyên.
BEGIN;

-- units, threshold_configs, hcdc_knowledge: chỉ đọc công khai
DROP POLICY IF EXISTS "Allow public all" ON public.units;
DROP POLICY IF EXISTS "Public read units" ON public.units;
CREATE POLICY "Public read units" ON public.units FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public all" ON public.threshold_configs;
DROP POLICY IF EXISTS "Public read threshold_configs" ON public.threshold_configs;
CREATE POLICY "Public read threshold_configs" ON public.threshold_configs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public all" ON public.hcdc_knowledge;
DROP POLICY IF EXISTS "Public read hcdc_knowledge" ON public.hcdc_knowledge;
CREATE POLICY "Public read hcdc_knowledge" ON public.hcdc_knowledge FOR SELECT USING (true);

-- settings, epidemic_diarrhea: đã có policy đọc công khai -> chỉ bỏ quyền ghi/xóa
DROP POLICY IF EXISTS "Allow public all" ON public.settings;
DROP POLICY IF EXISTS "Allow public all" ON public.epidemic_diarrhea;

-- ai_daily_insights: pipeline AI hằng ngày ghi bằng khóa ngoài (chưa xác định được loại khóa) => giữ INSERT/UPDATE
-- để không làm hỏng pipeline, nhưng BỎ quyền DELETE. TODO: chuyển pipeline sang service_role rồi bỏ nốt 2 quyền này.
DROP POLICY IF EXISTS "Allow public all" ON public.ai_daily_insights;
DROP POLICY IF EXISTS "Public read ai_daily_insights" ON public.ai_daily_insights;
DROP POLICY IF EXISTS "Pipeline insert ai_daily_insights" ON public.ai_daily_insights;
DROP POLICY IF EXISTS "Pipeline update ai_daily_insights" ON public.ai_daily_insights;
CREATE POLICY "Public read ai_daily_insights" ON public.ai_daily_insights FOR SELECT USING (true);
CREATE POLICY "Pipeline insert ai_daily_insights" ON public.ai_daily_insights FOR INSERT WITH CHECK (true);
CREATE POLICY "Pipeline update ai_daily_insights" ON public.ai_daily_insights FOR UPDATE USING (true) WITH CHECK (true);

-- water_reports: bỏ policy cho phép user đăng nhập bất kỳ chèn dữ liệu của đơn vị bất kỳ
-- (policy "Users can insert their own unit data" và quyền admin vẫn còn).
DROP POLICY IF EXISTS "Allow authenticated insert access" ON public.water_reports;

COMMIT;
