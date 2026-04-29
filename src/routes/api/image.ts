import { createFileRoute } from "@tanstack/react-router";

const fallbackImage = (prompt: string) => {
  const safePrompt = prompt.replace(/[<>&]/g, "").slice(0, 120) || "KıvançAI görsel alanı";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#071827"/><stop offset="1" stop-color="#0b3d5c"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/><circle cx="512" cy="382" r="172" fill="#f3f1e7" opacity=".95"/><text x="512" y="380" text-anchor="middle" font-family="Arial, sans-serif" font-size="150" font-weight="800" fill="#064568">KK</text><text x="512" y="500" text-anchor="middle" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="#064568">kivancai</text><text x="512" y="720" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#eaf6ff">${safePrompt}</text><text x="512" y="790" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#9ec8dc">Görsel modu hazır — tekrar deneyebilirsin</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const Route = createFileRoute("/api/image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { prompt, inputImage } = await request.json();
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return Response.json({ image: fallbackImage(prompt || "") });
          }
          if (!prompt || typeof prompt !== "string") {
            return new Response(JSON.stringify({ error: "Prompt gerekli" }), { status: 400 });
          }

          const userContent: any = inputImage
            ? [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: inputImage } },
              ]
            : prompt;

          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image",
              messages: [{ role: "user", content: userContent }],
              modalities: ["image", "text"],
            }),
          });

          if (!resp.ok) {
            if (resp.status === 429) {
              return Response.json({ image: fallbackImage(prompt) });
            }
            if (resp.status === 402) {
              return Response.json({ image: fallbackImage(prompt) });
            }
            const t = await resp.text();
            console.error("Image gen error:", resp.status, t);
            return Response.json({ image: fallbackImage(prompt) });
          }

          const data = await resp.json();
          const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          if (!imageUrl) {
            return new Response(JSON.stringify({ error: "Görsel dönmedi" }), { status: 500 });
          }
          return Response.json({ image: imageUrl });
        } catch (e) {
          console.error("image route error:", e);
          return Response.json({ image: fallbackImage("KıvançAI") });
        }
      },
    },
  },
});