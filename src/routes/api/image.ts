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
          const { prompt } = await request.json();
          if (!prompt || typeof prompt !== "string") {
            return new Response(JSON.stringify({ error: "Prompt gerekli" }), { status: 400 });
          }
          // Tamamen ücretsiz, anahtarsız görsel: Pollinations
          const seed = Math.floor(Math.random() * 1_000_000);
          const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
            prompt.trim(),
          )}?width=1024&height=1024&nologo=true&seed=${seed}`;
          return Response.json({ image: imageUrl });
        } catch (e) {
          console.error("image route error:", e);
          return fallbackImageResponse("KıvançAI");
        }
      },
    },
  },
});