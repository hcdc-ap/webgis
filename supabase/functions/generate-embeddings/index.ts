import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const apiKey = Deno.env.get('GEMINI_API_KEY') ?? ''
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Lấy 50 dòng để nạp cho nhanh
    const { data: records, error: fetchError } = await supabase
      .from('hcdc_knowledge')
      .select('id, content')
      .is('embedding', null)
      .limit(50)

    if (fetchError) throw fetchError
    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ message: "Dữ liệu đã nạp xong hết rồi sếp ơi!" }), { headers: corsHeaders })
    }

    let successCount = 0;
    let errorCount = 0;

    // SỬ DỤNG ĐÚNG TÊN MODEL SẾP VỪA QUÉT ĐƯỢC
    const modelName = "models/gemini-embedding-2"; 

    for (const record of records) {
      try {
        const modelName = "models/gemini-embedding-2"; 
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${modelName}:embedContent?key=${apiKey}`;

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelName,
            taskType: "RETRIEVAL_DOCUMENT",
            outputDimensionality: 768, // <--- THÊM DÒNG NÀY ĐỂ KHỚP VỚI DATABASE
            content: { parts: [{ text: record.content }] }
          })
        })

        const json = await res.json()

        if (json.error) {
          console.error(`Lỗi Google: ${json.error.message}`);
          errorCount++;
          continue;
        }

        const vector = json.embedding.values // Lúc này vector sẽ chỉ còn đúng 768 số

        const { error: updateError } = await supabase
          .from('hcdc_knowledge')
          .update({ embedding: vector })
          .eq('id', record.id);

        if (!updateError) {
          successCount++;
          console.log(`✅ Đã khớp 768 chiều: ${record.id}`);
        } else {
          console.error(`Lỗi DB: ${updateError.message}`);
          errorCount++;
        }
      } catch (e) {
        errorCount++;
      }
      await new Promise(r => setTimeout(r, 150));
    }

    return new Response(JSON.stringify({ 
      message: `Hoàn tất: Thành công ${successCount}, Thất bại ${errorCount}.` 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})