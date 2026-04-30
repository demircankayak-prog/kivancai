import { createFileRoute } from "@tanstack/react-router";

const fallbackImage = (prompt: string) => {
  void prompt;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs><linearGradient id="sky" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#123a55"/><stop offset=".62" stop-color="#2a6270"/><stop offset="1" stop-color="#1f4c33"/></linearGradient><linearGradient id="field" x1="0" x2="1"><stop stop-color="#204f37"/><stop offset="1" stop-color="#34704a"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#sky)"/><circle cx="760" cy="210" r="82" fill="#f4d27a" opacity=".92"/><path d="M0 650 C170 565 330 690 505 610 C690 525 810 650 1024 570 L1024 1024 L0 1024 Z" fill="url(#field)"/><path d="M156 814 C290 732 410 828 558 760 C690 700 826 740 1024 680 L1024 1024 L0 1024 L0 890 C52 876 104 846 156 814 Z" fill="#183f2e" opacity=".9"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const fallbackImageResponse = (prompt: string) =>
  Response.json({ image: fallbackImage(prompt), fallback: true });

export const Route = createFileRoute("/api/image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { prompt, inputImage } = await request.json();
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return fallbackImageResponse(prompt || "");
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
              model: "google/gemini-3.1-flash-image-preview",
              messages: [{ role: "user", content: userContent }],
              modalities: ["image", "text"],
            }),
          });

          if (!resp.ok) {
            if (resp.status === 429) {
              return fallbackImageResponse(prompt);
            }
            if (resp.status === 402) {
              return fallbackImageResponse(prompt);
            }
            const t = await resp.text();
            console.error("Image gen error:", resp.status, t);
            return fallbackImageResponse(prompt);
          }

          const data = await resp.json();
          const msg = data.choices?.[0]?.message;
          const imageUrl =
            msg?.images?.[0]?.image_url?.url ||
            msg?.images?.[0]?.url ||
            (Array.isArray(msg?.content)
              ? msg.content.find((c: any) => c?.image_url?.url)?.image_url?.url
              : undefined);
          if (!imageUrl) {
            console.error("Image gen empty response:", JSON.stringify(data).slice(0, 500));
            return fallbackImageResponse(prompt);
          }
          return Response.json({ image: imageUrl });
        } catch (e) {
          console.error("image route error:", e);
          return fallbackImageResponse("KıvançAI");
        }
      },
    },
  },
});