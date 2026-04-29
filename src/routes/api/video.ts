import { createFileRoute } from "@tanstack/react-router";

const unavailableVideoResponse = (message?: string) =>
  Response.json({
    video: null,
    message:
      message ||
      "Kling AI'nin ücretsiz web sürümü uygulama içinden otomatik kullanılamıyor. 10 saniyelik video için API bağlantısı hazır; geçerli bir video API anahtarı eklenince direkt çalışır.",
  });

export const Route = createFileRoute("/api/video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { prompt, duration } = await request.json();
          const dur = duration === 10 ? 10 : 5;
          if (!prompt || typeof prompt !== "string") {
            return new Response(JSON.stringify({ error: "Prompt gerekli" }), { status: 400 });
          }

          const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
          if (!REPLICATE_API_TOKEN) {
            return unavailableVideoResponse();
          }

          // Kling v1.6 Standard via Replicate (~$0.28 per 5s, supports 5 or 10s)
          const createResp = await fetch(
            "https://api.replicate.com/v1/models/kwaivgi/kling-v1.6-standard/predictions",
            {
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
            },
          );

          if (!createResp.ok) {
            const t = await createResp.text();
            console.error("Replicate error:", createResp.status, t);
            if (createResp.status === 401 || createResp.status === 402 || createResp.status === 403) {
              return unavailableVideoResponse(
                "Video bağlantısı şu an aktif değil. Kullanıcıya teknik hata göstermeden devam edebilirsin; geçerli API anahtarı eklenince 10 saniyelik Kling video üretimi çalışır.",
              );
            }
            return unavailableVideoResponse("Video servisi şu an yoğun. Biraz sonra tekrar dene kanka.");
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
              return new Response(JSON.stringify({ error: "Video üretimi zaman aşımına uğradı" }), {
                status: 500,
              });
            }
            await new Promise((r) => setTimeout(r, 2500));
            const pollResp = await fetch(
              `https://api.replicate.com/v1/predictions/${prediction.id}`,
              {
                headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
              },
            );
            if (!pollResp.ok) break;
            prediction = await pollResp.json();
          }

          if (prediction.status !== "succeeded") {
            return unavailableVideoResponse("Video servisi şu an tamamlayamadı. Biraz sonra tekrar dene kanka.");
          }

          const videoUrl = Array.isArray(prediction.output)
            ? prediction.output[0]
            : prediction.output;
          if (!videoUrl) {
            return unavailableVideoResponse("Video servisi URL döndürmedi. Biraz sonra tekrar dene kanka.");
          }

          return Response.json({ video: videoUrl });
        } catch (e) {
          console.error("video route error:", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Bilinmeyen hata" }),
            { status: 500 },
          );
        }
      },
    },
  },
});
