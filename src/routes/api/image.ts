import { createFileRoute } from "@tanstack/react-router";

// Görsel motoru: FLUX (ücretsiz, anahtarsız, limitsiz internet altyapısı).
// Türkçe istem otomatik olarak İngilizceye çevrilir ve kalite etiketleri eklenir.

const QUALITY_SUFFIX =
  "ultra detailed, high quality, 8k, sharp focus, realistic lighting, professional photography";

const translateToEnglish = async (prompt: string): Promise<string> => {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return prompt;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "You translate image prompts into concise, vivid English. Reply with ONLY the translated prompt, no quotes, no explanation.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!r.ok) return prompt;
    const data = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const text = (data.choices?.[0]?.message?.content || "").trim().replace(/^["'`]+|["'`]+$/g, "");
    if (!text || text.length > 600) return prompt;
    return text;
  } catch (err) {
    console.error("translate error:", err);
    return prompt;
  }
};

export const Route = createFileRoute("/api/image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { prompt } = await request.json();
          if (!prompt || typeof prompt !== "string") {
            return new Response(JSON.stringify({ error: "Prompt gerekli" }), { status: 400 });
          }
          const english = await translateToEnglish(prompt.trim());
          const finalPrompt = `${english}, ${QUALITY_SUFFIX}`;
          const seed = Math.floor(Math.random() * 1_000_000);
          const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
            finalPrompt,
          )}?model=flux&width=1024&height=1024&nologo=true&enhance=true&seed=${seed}`;
          return Response.json({ image: imageUrl, prompt: finalPrompt });
        } catch (e) {
          console.error("image route error:", e);
          return new Response(JSON.stringify({ error: "Görsel oluşturulamadı" }), { status: 500 });
        }
      },
    },
  },
});
