import { createFileRoute } from "@tanstack/react-router";

// Ekrandan görüntü + soru → Gemini Vision ile yer/buton tespit edip kısa cevap
export const Route = createFileRoute("/api/screen-help")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { image, question } = await request.json();
          if (!image || typeof image !== "string") {
            return Response.json({ error: "image (data url) gerekli" }, { status: 400 });
          }
          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            return Response.json({ error: "LOVABLE_API_KEY yok" }, { status: 500 });
          }
          const q =
            (typeof question === "string" && question.trim()) ||
            "Kullanıcı bu ekranda gezinmeye çalışıyor. Ne görüyorsun, hangi butona basmalı? Çok kısa ve net cevap ver.";

          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content:
                    "Sen ekran paylaşımı yardımcısısın. Kullanıcının ekranını görüyorsun. Eğer kullanıcı bir butonu/alanı sorarsa yaklaşık konumunu bul. SADECE geçerli JSON döndür: {\"reply\":\"1-2 cümle doğal Türkçe cevap\",\"label\":\"kısa etiket\",\"crop\":{\"x\":0.0,\"y\":0.0,\"w\":0.25,\"h\":0.25}}. crop değerleri 0-1 arası normalize ekran oranı olsun ve hedefin etrafında biraz pay bıraksın. Hedef yoksa crop null döndür ve kullanıcıya aşağı/sağa kaydırmasını söyle. Markdown veya kod bloğu yazma.",
                },
                {
                  role: "user",
                  content: [
                    { type: "text", text: q },
                    { type: "image_url", image_url: { url: image } },
                  ],
                },
              ],
            }),
          });
          if (!resp.ok) {
            const t = await resp.text();
            console.error("screen-help error:", resp.status, t);
            return Response.json({ error: "Görsel analiz başarısız" }, { status: 502 });
          }
          const data = await resp.json();
          const raw: string = data?.choices?.[0]?.message?.content?.toString().trim() || "";
          const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
          let parsed: { reply?: string; label?: string; crop?: unknown } | null = null;
          try {
            parsed = JSON.parse(cleaned);
          } catch {
            parsed = null;
          }
          const cropCandidate = parsed?.crop as { x?: number; y?: number; w?: number; h?: number } | null;
          const crop =
            cropCandidate &&
            [cropCandidate.x, cropCandidate.y, cropCandidate.w, cropCandidate.h].every(
              (n) => typeof n === "number" && Number.isFinite(n),
            )
              ? {
                  x: Math.max(0, Math.min(0.98, cropCandidate.x!)),
                  y: Math.max(0, Math.min(0.98, cropCandidate.y!)),
                  w: Math.max(0.08, Math.min(1, cropCandidate.w!)),
                  h: Math.max(0.08, Math.min(1, cropCandidate.h!)),
                }
              : null;
          const reply =
            parsed?.reply?.toString().trim() ||
            raw ||
            "Ekranı gördüm ama net bir cevap veremedim kanka.";
          return Response.json({ reply, label: parsed?.label?.toString().trim() || "Ekran kırpımı", crop });
        } catch (e) {
          console.error("screen-help route error:", e);
          return Response.json({ error: "Hata" }, { status: 500 });
        }
      },
    },
  },
});
