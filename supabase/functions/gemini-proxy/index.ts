// gemini-proxy: thay cho route /api/gemini/generate của server.js để chạy được trên GitHub Pages.
// Chỉ người dùng ĐÃ ĐĂNG NHẬP mới gọi được (chặn việc dùng anon key công khai để đốt quota Gemini).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ALLOWED_MODELS = new Set(["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"]);
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json({ error: "Cần đăng nhập để dùng AI." }, 401);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "Chưa cấu hình GEMINI_API_KEY." }, 500);

  let body: { model?: string; payload?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Body không hợp lệ." }, 400); }
  const model = body.model && ALLOWED_MODELS.has(body.model) ? body.model : "gemini-2.5-flash";
  if (!body.payload) return json({ error: "Thiếu payload." }, 400);

  const up = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body.payload),
    },
  );
  return new Response(await up.text(), { status: up.status, headers: { ...cors, "Content-Type": "application/json" } });
});
