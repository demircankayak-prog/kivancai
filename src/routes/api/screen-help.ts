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
          const q =
            (typeof question === "string" && question.trim()) ||
            "Kullanıcı bu ekranda gezinmeye çalışıyor. Ne görüyorsun, hangi butona basmalı? Çok kısa ve net cevap ver.";

          const SYS =
            "Sen ekran paylaşımı yardımcısısın. Kullanıcının ekranını görüyorsun. Eğer kullanıcı bir butonu/alanı sorarsa yaklaşık konumunu bul. SADECE geçerli JSON döndür: {\"reply\":\"1-2 cümle doğal Türkçe cevap\",\"label\":\"kısa etiket\",\"crop\":{\"x\":0.0,\"y\":0.0,\"w\":0.25,\"h\":0.25}}. crop değerleri 0-1 arası normalize ekran oranı olsun ve hedefin etrafında biraz pay bıraksın. Hedef yoksa crop null döndür ve kullanıcıya aşağı/sağa kaydırmasını söyle. Markdown veya kod bloğu yazma.";
          const body = (model: string) => ({
            model,
            messages: [
              { role: "system", content: SYS },
              {
                role: "user",
                content: [
                  { type: "text", text: q },
                  { type: "image_url", image_url: { url: image } },
                ],
              },
            ],
          });

          const HF_TOKEN = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;

          let resp: Response | null = null;
          // 1) Hugging Face Qwen2.5-VL (ücretsiz kota)
          if (HF_TOKEN) {
            try {
              const hf = await fetch("https://router.huggingface.co/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${HF_TOKEN}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(body("Qwen/Qwen2.5-VL-72B-Instruct")),
              });
              if (hf.ok) resp = hf;
              else console.error("hf vision error:", hf.status, (await hf.text()).slice(0, 200));
            } catch (e) {
              console.error("hf vision fetch error:", e);
            }
          }
          // 2) Yedek: yerleşik vision modeli
          if (!resp && LOVABLE_API_KEY) {
            resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body("google/gemini-2.5-flash")),
            });
          }
          if (!resp || !resp.ok) {
            if (resp) console.error("screen-help error:", resp.status, (await resp.text()).slice(0, 200));
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
