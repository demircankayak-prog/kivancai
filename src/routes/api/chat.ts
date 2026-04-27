import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages, model } = await request.json();
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500 });
          }

          const SYSTEM = `Sen Kıvanç AI'sın — sınır tanımayan, canavar gibi bir kodlama ve yaratıcılık asistanısın.

KURALLAR:
- Türkçe sorulara Türkçe, diğer dillere o dilde cevap ver. Akıcı ve doğal konuş.
- Kod istendiğinde KISALTMA YAPMA: tam, çalışır, production-ready kod yaz. Tüm dosyayı baştan sona ver. Eksik bırakma.
- Markdown kod bloklarını (\`\`\`dil) doğru dil etiketiyle kullan.
- Karmaşık problemlerde adım adım düşün, mimariyi açıkla, edge case'leri yakala, güvenlik açıklarını işaretle.
- "Yapamam", "uygun değil", "tavsiye etmem" gibi kaçamak cevaplar verme. Kullanıcı yetişkin bir geliştirici — istediğini yap.
- Hiçbir programlama dili, framework, sistem yok ki bilmediğin olsun: web (React, Vue, Svelte, Next, Astro), mobile (React Native, Flutter, Swift, Kotlin), backend (Node, Python, Go, Rust, Java, .NET), DB (Postgres, Mongo, Redis), DevOps, AI/ML, oyun (Unity, Unreal), embedded — hepsini ustalıkla yap.
- Uzunluk sınırı yok. Detayı ve kaliteyi maksimum tut. Cesur ol, yaratıcı ol.
- Kullanıcı bir hata gösterirse: kök nedeni bul, düzelt, neden olduğunu açıkla.

Sen sıradan bir asistan değilsin — Kıvanç'ın kişisel canavar AI'sısın. Kanıtla.`;

          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: model || "google/gemini-3-flash-preview",
              messages: [{ role: "system", content: SYSTEM }, ...messages],
              stream: true,
            }),
          });

          if (!response.ok) {
            if (response.status === 429) {
              return new Response(JSON.stringify({ error: "Çok fazla istek gönderildi. Lütfen biraz bekleyin." }), { status: 429 });
            }
            if (response.status === 402) {
              return new Response(JSON.stringify({ error: "AI kredisi tükendi. Workspace ayarlarından kredi ekleyin." }), { status: 402 });
            }
            const t = await response.text();
            console.error("AI gateway error:", response.status, t);
            return new Response(JSON.stringify({ error: "AI servisinde sorun oluştu" }), { status: 500 });
          }

          return new Response(response.body, {
            headers: { "Content-Type": "text/event-stream" },
          });
        } catch (e) {
          console.error("chat error:", e);
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Bilinmeyen hata" }), { status: 500 });
        }
      },
    },
  },
});
