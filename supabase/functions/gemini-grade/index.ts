import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const grades = ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Undergrade"];
const readiness = ["Specialty Export", "Commercial Export", "Local Market Only", "Reject / Re-sort"];
const keys = ["sound_or_ripe_pct", "unripe_green_pct", "black_overfermented_pct", "insect_broken_pct", "foreign_matter_pct"];
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
function validateAssessment(raw: unknown) {
  if (!raw || typeof raw !== "object") throw new Error("Model response was not an object.");
  const v = raw as Record<string, unknown>;
  if (typeof v.is_coffee_sample !== "boolean") throw new Error("Missing sample classification.");
  if (!grades.includes(String(v.ecx_grade))) throw new Error("Invalid grade.");
  if (typeof v.quality_score !== "number" || !Number.isFinite(v.quality_score) || v.quality_score < 0 || v.quality_score > 100) throw new Error("Invalid quality score.");
  if (!v.breakdown || typeof v.breakdown !== "object") throw new Error("Missing defect breakdown.");
  const breakdown = v.breakdown as Record<string, unknown>;
  if (keys.some((k) => typeof breakdown[k] !== "number" || !Number.isFinite(breakdown[k]) || Number(breakdown[k]) < 0 || Number(breakdown[k]) > 100)) throw new Error("Invalid defect percentages.");
  const total = keys.reduce((sum, k) => sum + Number(breakdown[k]), 0);
  if (Math.abs(total - 100) > 2) throw new Error("Defect percentages must total approximately 100.");
  if (!readiness.includes(String(v.export_readiness))) throw new Error("Invalid export readiness.");
  return {
    is_coffee_sample: v.is_coffee_sample,
    ...(typeof v.rejection_reason === "string" ? { rejection_reason: v.rejection_reason.slice(0, 300) } : {}),
    ecx_grade: v.ecx_grade, quality_score: v.quality_score,
    breakdown: Object.fromEntries(keys.map((k) => [k, Number(breakdown[k])])),
    export_readiness: v.export_readiness,
    ...(typeof v.confidence === "number" && Number.isFinite(v.confidence) ? { confidence: Math.max(0, Math.min(1, v.confidence)) } : {}),
    ...(typeof v.assessment_note === "string" ? { assessment_note: v.assessment_note.slice(0, 500) } : {}),
  };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const internalKey = Deno.env.get("BUNALENS_INTERNAL_FUNCTION_KEY");
  if (!internalKey || req.headers.get("x-bunalens-internal-key") !== internalKey) return json({ error: "This grading endpoint is internal to the sync service." }, 403);
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token === authHeader) return json({ error: "A signed-in user session is required." }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!supabaseUrl || !anonKey || !geminiKey) return json({ error: "Server configuration is incomplete." }, 503);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Session is invalid or expired." }, 401);
    const body = await req.json();
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "").replace(/\s/g, "") : "";
    const mimeType = body.mimeType;
    const sampleType = body.sampleType;
    const woreda = body.woreda;
    const stationId = body.stationId;
    const idempotencyKey = body.idempotencyKey;
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) return json({ error: "Unsupported image format." }, 400);
    if (!["red_cherry", "green_bean"].includes(sampleType)) return json({ error: "Invalid coffee sample type." }, 400);
    if (!["Gomma", "Limmu Kossa", "Mana", "Seka Chekorsa", "Gera", "Kersa", "Jimma Town"].includes(woreda)) return json({ error: "Invalid origin woreda." }, 400);
    if (typeof stationId !== "string" || !/^[0-9a-f-]{36}$/i.test(stationId)) return json({ error: "A registered washing station is required for cloud grading." }, 400);
    if (typeof idempotencyKey !== "string" || !/^[a-zA-Z0-9_-]{8,128}$/.test(idempotencyKey)) return json({ error: "A valid capture idempotency key is required." }, 400);
    if (!imageBase64 || imageBase64.length > 14_000_000) return json({ error: "Image is missing or exceeds the 10 MB limit." }, 413);
    const { data: station, error: stationError } = await userClient.from("stations")
      .select("id,owner_id,credits,pro_expires_at").eq("id", stationId).eq("owner_id", userData.user.id).maybeSingle();
    if (stationError || !station) return json({ error: "You do not have access to this washing station." }, 403);
    const proActive = station.pro_expires_at && new Date(station.pro_expires_at).getTime() > Date.now();
    if (!proActive && Number(station.credits) < 1) return json({ error: "No scan credits are available." }, 402);
    const prompt = "You are a coffee quality visual screening assistant. Inspect the supplied " +
      (sampleType === "red_cherry" ? "red coffee cherry" : "green coffee bean") +
      " sample photographed in " + woreda + ", Jimma Zone, Ethiopia. Return only JSON matching the schema. Assess visible evidence only. Do not claim laboratory certainty, moisture content, cup score, hidden defects, or official ECX certification. Estimate five mutually exclusive visible composition percentages that total 100. If this is not the requested coffee sample, set is_coffee_sample=false and explain briefly. Do not return prices or financial claims.";
    const modelResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(geminiKey), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
        generationConfig: {
          temperature: 0.1, responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              is_coffee_sample: { type: "BOOLEAN" }, rejection_reason: { type: "STRING" },
              ecx_grade: { type: "STRING", enum: grades }, quality_score: { type: "NUMBER" },
              breakdown: { type: "OBJECT", properties: {
                sound_or_ripe_pct: { type: "NUMBER" }, unripe_green_pct: { type: "NUMBER" },
                black_overfermented_pct: { type: "NUMBER" }, insect_broken_pct: { type: "NUMBER" },
                foreign_matter_pct: { type: "NUMBER" },
              }, required: keys },
              export_readiness: { type: "STRING", enum: readiness },
              confidence: { type: "NUMBER" }, assessment_note: { type: "STRING" },
            },
            required: ["is_coffee_sample", "ecx_grade", "quality_score", "breakdown", "export_readiness"],
          },
        },
      }),
    });
    if (!modelResponse.ok) {
      const details = await modelResponse.text();
      console.error("Gemini request failed", modelResponse.status, details.slice(0, 1000));
      return json({ error: "AI grading provider is temporarily unavailable." }, 502);
    }
    const modelJson = await modelResponse.json();
    const candidateText = modelJson?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => typeof p.text === "string")?.text;
    if (!candidateText) return json({ error: "AI provider returned no assessment." }, 502);
    let assessment: ReturnType<typeof validateAssessment>;
    try { assessment = validateAssessment(JSON.parse(candidateText)); }
    catch (error) {
      console.error("Invalid Gemini structured response", error);
      return json({ error: "AI provider returned an invalid assessment. Retake the photograph." }, 502);
    }
    if (assessment.is_coffee_sample) {
      const { data: debitOk, error: debitError } = await userClient.rpc("consume_station_scan_credit", { p_station_id: stationId, p_idempotency_key: idempotencyKey });
      if (debitError) {
        console.error("Scan credit debit failed", debitError);
        return json({ error: "Could not confirm station scan entitlement. No assessment was saved." }, 503);
      }
      if (!debitOk) return json({ error: "No scan credits are available." }, 402);
    }
    return json({ result: assessment, model: "gemini-2.5-flash", assessed_at: new Date().toISOString() });
  } catch (error) {
    console.error("gemini-grade failed", error);
    return json({ error: "Unable to complete the grading request." }, 500);
  }
});
