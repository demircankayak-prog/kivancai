import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { prompt, inputImage } = await request.json();
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500 });
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
              return new Response(JSON.stringify({ error: "Çok fazla istek. Biraz bekle." }), { status: 429 });
            }
            if (resp.status === 402) {
              return new Response(JSON.stringify({ error: "AI kredisi tükendi." }), { status: 402 });
            }
            const t = await resp.text();
            console.error("Image gen error:", resp.status, t);
            return new Response(JSON.stringify({ error: "Görsel oluşturulamadı" }), { status: 500 });
          }

          const data = await resp.json();
          const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          if (!imageUrl) {
            return new Response(JSON.stringify({ error: "Görsel dönmedi" }), { status: 500 });
          }
          return Response.json({ image: imageUrl });
        } catch (e) {
          console.error("image route error:", e);
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Bilinmeyen hata" }), { status: 500 });
        }
      },
    },
  },
});