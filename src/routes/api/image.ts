import { createFileRoute } from "@tanstack/react-router";

const fallbackImage = (prompt: string) => {
  const safePrompt = prompt.replace(/[<>&]/g, "").slice(0, 120) || "KıvançAI görsel alanı";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs><linearGradient id="sky" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#123a55"/><stop offset=".62" stop-color="#2a6270"/><stop offset="1" stop-color="#1f4c33"/></linearGradient><linearGradient id="field" x1="0" x2="1"><stop stop-color="#204f37"/><stop offset="1" stop-color="#34704a"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#sky)"/><circle cx="760" cy="210" r="82" fill="#f4d27a" opacity=".92"/><path d="M0 650 C170 565 330 690 505 610 C690 525 810 650 1024 570 L1024 1024 L0 1024 Z" fill="url(#field)"/><path d="M156 814 C290 732 410 828 558 760 C690 700 826 740 1024 680 L1024 1024 L0 1024 L0 890 C52 876 104 846 156 814 Z" fill="#183f2e" opacity=".9"/><g transform="translate(382 575) scale(1.55)" fill="#101820"><ellipse cx="116" cy="92" rx="88" ry="42"/><circle cx="218" cy="70" r="34"/><path d="M235 42 l32 -30 l-7 44 z"/><path d="M197 45 l-18 -38 l44 22 z"/><rect x="56" y="118" width="20" height="72" rx="9"/><rect x="126" y="120" width="20" height="70" rx="9"/><rect x="172" y="112" width="18" height="66" rx="8"/><path d="M32 86 C-8 56 -20 36 -36 18" stroke="#101820" stroke-width="18" fill="none" stroke-linecap="round"/></g><text x="54" y="916" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#f2fbff">${safePrompt}</text><text x="54" y="956" font-family="Arial, sans-serif" font-size="20" fill="#c8e4ee">KıvançAI önizleme</text><g transform="translate(842 846)"><rect width="132" height="82" rx="41" fill="#071827" opacity=".82"/><circle cx="42" cy="41" r="29" fill="#f3f1e7"/><text x="42" y="51" text-anchor="middle" font-family="Arial, sans-serif" font-size="25" font-weight="900" fill="#064568">KK</text><text x="78" y="48" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#fff">AI</text></g></svg>`;
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
              model: "google/gemini-2.5-flash-image",
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
          const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          if (!imageUrl) {
            return new Response(JSON.stringify({ error: "Görsel dönmedi" }), { status: 500 });
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