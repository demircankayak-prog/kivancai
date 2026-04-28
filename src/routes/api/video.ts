import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { prompt, duration } = await request.json();
          const dur = duration === 10 ? 10 : 5;
          const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
          if (!REPLICATE_API_TOKEN) {
            return new Response(
              JSON.stringify({ error: "Video üretimi için Replicate API key eklenmemiş. Sahibi ayarlardan eklemeli." }),
              { status: 500 }
            );
          }
          if (!prompt || typeof prompt !== "string") {
            return new Response(JSON.stringify({ error: "Prompt gerekli" }), { status: 400 });
          }

          // Kling v1.6 Standard via Replicate (~$0.28 per 5s, supports 5 or 10s)
          const createResp = await fetch("https://api.replicate.com/v1/models/kwaivgi/kling-v1.6-standard/predictions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
              "Content-Type": "application/json",
              Prefer: "wait=60",
            },
            body: JSON.stringify({
              input: {
                prompt: prompt,
                duration: dur,
                aspect_ratio: "16:9",
                cfg_scale: 0.5,
                negative_prompt: "",
              },
            }),
          });

          if (!createResp.ok) {
            const t = await createResp.text();
            console.error("Replicate error:", createResp.status, t);
            return new Response(
              JSON.stringify({ error: `Video oluşturulamadı (${createResp.status}). Replicate hesabında kredi var mı kontrol et.` }),
              { status: 500 }
            );
          }

          let prediction = await createResp.json();

          // Poll until done (max ~3 min)
          const startTime = Date.now();
          while (
            prediction.status !== "succeeded" &&
            prediction.status !== "failed" &&
            prediction.status !== "canceled"
          ) {
            if (Date.now() - startTime > 180000) {
              return new Response(JSON.stringify({ error: "Video üretimi zaman aşımına uğradı" }), { status: 500 });
            }
            await new Promise((r) => setTimeout(r, 2500));
            const pollResp = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
              headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
            });
            if (!pollResp.ok) break;
            prediction = await pollResp.json();
          }

          if (prediction.status !== "succeeded") {
            return new Response(
              JSON.stringify({ error: prediction.error || "Video üretimi başarısız oldu" }),
              { status: 500 }
            );
          }

          const videoUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
          if (!videoUrl) {
            return new Response(JSON.stringify({ error: "Video URL'si dönmedi" }), { status: 500 });
          }

          return Response.json({ video: videoUrl });
        } catch (e) {
          console.error("video route error:", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Bilinmeyen hata" }),
            { status: 500 }
          );
        }
      },
    },
  },
});
