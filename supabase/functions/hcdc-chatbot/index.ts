import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function extractDateFromPrompt(prompt: string) {
  const now = new Date();
  let month = now.getMonth() + 1;
  let year = now.getFullYear();
  const monthRegex = /(tháng\s+|th\s+|m\s+)?(\d{1,2})(\/|\s+năm\s+)?(\d{4})?/i;
  const match = prompt.match(monthRegex);
  if (match) {
    month = parseInt(match[2]);
    if (match[4]) year = parseInt(match[4]);
  }
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
  return { month, year, startDate, endDate };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { prompt, dataSummary } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { month, year, startDate, endDate } = extractDateFromPrompt(prompt);

    // 🔥 CHẠY SONG SONG: Tối ưu hiệu suất
    const [embeddingResult, dbStats, dbThresholds, dbInsight] = await Promise.all([
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: "models/gemini-embedding-2", taskType: "RETRIEVAL_QUERY", content: { parts: [{ text: prompt }] } })
      }).then(res => res.json()),

      supabase.from('view_report_results')
        .select('danh_gia_tu_dong, csccn_name, ward_commune, clo_du, ph, do_duc, muivi, mau, pec, coli_tong, ecoli, asen, ps_aeruginosa, staphylococcus_aureus, mangan, fe, sampling_date')
        .gte('sampling_date', startDate)
        .lte('sampling_date', endDate),

      supabase.from('threshold_configs').select('param_code, limit_min, limit_max'),

      // Lấy nhận định gần nhất của tháng đang hỏi hoặc gần nhất hệ thống
      supabase.from('ai_daily_insights')
        .select('content')
        .order('created_at', { ascending: false })
        .limit(1)
    ]);

    // --- 4. XỬ LÝ RAG (CĂN CỨ PHÁP LÝ) ---
    const queryVector = embeddingResult.embedding.values;
    // Hạ ngưỡng xuống 0.2 để tìm kiếm rộng hơn, tránh "Chưa xác định"
    const { data: legalDocs } = await supabase.rpc('match_knowledge', { 
      query_embedding: queryVector, 
      match_threshold: 0.2, 
      match_count: 5 
    });

    const reports = dbStats.data || [];
    const thresholds = dbThresholds.data || [];
    const knowledgeBase = legalDocs?.length ? legalDocs.map(d => d.content).join('\n') : "";
    const systemInsight = dbInsight.data?.length ? dbInsight.data[0].content : "";
    
    // --- PHÂN TÍCH LỖI CHI TIẾT ---
    const failedList = reports.filter(r => r.danh_gia_tu_dong === 'Không đạt').map(r => {
      let errors = [];
      thresholds.forEach(t => {
        const val = r[t.param_code];
        if (val !== null && (val < t.limit_min || val > t.limit_max)) {
          errors.push(`${t.param_code}: ${val} (Chuẩn: ${t.limit_min}-${t.limit_max})`);
        }
      });
      return { ...r, errorDetail: errors.join(', ') || "Vi phạm quy chuẩn kỹ thuật" };
    });

    const systemInstruction = `
      Bạn là SENTINEL-AI HCDC. Báo cáo chất lượng nước tháng ${month}/${year}.
  	QUY TẮC PHÁP LÝ TỐI THƯỢNG:
  	1. Khi sếp nhắc đến "Thông tư 52", ĐỊNH DANH MẶC ĐỊNH là **Thông tư 52/2024/TT-BYT** (về phương pháp lấy mẫu, vị trí lấy mẫu và tần suất giám sát chất lượng nước). 
  	2. TUYỆT ĐỐI KHÔNG trích dẫn Thông tư 52/2017 vì văn bản này đã hết hiệu lực hoặc đã được thay thế/cập nhật bằng bản 2024.
  	3. Đối chiếu các mẫu "Không đạt" với **QCVN 01-1:2024/BYT**.
      
      DỮ LIỆU CỐT LÕI:
      - Tổng số mẫu: ${reports.length}
      - Số mẫu KHÔNG ĐẠT: ${failedList.length}
      - Chi tiết mẫu KHÔNG ĐẠT: ${failedList.map((f, i) => `${f.csccn_name}: ${f.errorDetail}`).join('; ')}

      CĂN CỨ PHÁP LÝ (Kho tri thức):
      ${knowledgeBase || "Sử dụng nội dung từ Thông tư 52/2024/TT-BYT để hướng dẫn sếp."}

      NHẬN ĐỊNH TỪ HỆ THỐNG:
      ${systemInsight || "Dữ liệu tháng này ổn định, cần tiếp tục giám sát các điểm có chỉ số cận biên."}

      YÊU CẦU TRÌNH BÀY:
      1. Mục [CĂN CỨ PHÁP LÝ]: Không được ghi "Chưa xác định". Hãy dựa vào kho tri thức ở trên hoặc kiến thức chuyên môn về QCVN để trả lời tham mưu.
      2. Mục [NHẬN ĐỊNH HỆ THỐNG]: Tóm tắt lại nhận định từ hệ thống hoặc đưa ra đánh giá dựa trên tỷ lệ mẫu đạt/không đạt thực tế.
      3. Tuyệt đối không để trống các mục quan trọng.
      4. Phải trình bày quyết đoán, chuyên nghiệp, hỗ trợ tham mưu đúng luật hiện hành.
    `;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemInstruction}\n\nSếp hỏi: ${prompt}` }] }],
        generationConfig: { temperature: 0.2 } // Tăng nhẹ để AI linh hoạt hơn khi thiếu một chút dữ liệu
      })
    });

    const result = await res.json();
    return new Response(JSON.stringify({ answer: result.candidates[0].content.parts[0].text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ answer: "Lỗi hệ thống: " + error.message }), { headers: corsHeaders });
  }
})