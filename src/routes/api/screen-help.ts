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
                    "Sen ekran paylaşımı yardımcısısın. Kullanıcının ekranını görüyorsun. Çok kısa (1-3 cümle), doğal Türkçe konuşma diliyle, butonun nerede olduğunu (sol üst, sağ alt, ortada vs.) ve adını söyle. Bulamazsan '… butonunu göremiyorum, biraz aşağı/sağa kaydır' de.",
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
          const reply: string =
            data?.choices?.[0]?.message?.content?.toString().trim() ||
            "Ekranı gördüm ama net bir cevap veremedim kanka.";
          return Response.json({ reply });
        } catch (e) {
          console.error("screen-help route error:", e);
          return Response.json({ error: "Hata" }, { status: 500 });
        }
      },
    },
  },
});
