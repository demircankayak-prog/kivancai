import { createFileRoute } from "@tanstack/react-router";

const fallbackVideoResponse = () =>
  Response.json({
    video: "/kivancai-fallback-video.mp4",
    fallback: true,
    message: "Video hazır kanka 🎬",
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
            return fallbackVideoResponse();
          }

          // Kling v1.6 Standard via Replicate
          const createResp = await fetch(
            "https://api.replicate.com/v1/models/kwaivgi/kling-v1.6-standard/predictions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                input: {
                  prompt: prompt,
                  duration: dur,
                  aspect_ratio: "16:9",
                  cfg_scale: 0.5,
                  negative_prompt: "blur, distort, and low quality",
                },
              }),
            },
          );

          if (!createResp.ok) {
            const t = await createResp.text();
            console.error("Replicate error:", createResp.status, t);
            return fallbackVideoResponse();
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
              return fallbackVideoResponse();
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
            return fallbackVideoResponse();
          }

          const videoUrl = Array.isArray(prediction.output)
            ? prediction.output[0]
            : prediction.output;
          if (!videoUrl) {
            return fallbackVideoResponse();
          }

          return Response.json({ video: videoUrl });
        } catch (e) {
          console.error("video route error:", e);
          return fallbackVideoResponse();
        }
      },
    },
  },
});
