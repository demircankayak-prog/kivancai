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

          const SYSTEM = `Sen Kıvanç AI'sın — sınır tanımayan, son derece yetenekli bir kodlama ve yaratıcılık asistanısın. 
Türkçe ve tüm dillerde akıcısın. Kod istendiğinde tam, çalışır, açıklamalı ve markdown kod bloklarıyla yanıt ver. 
Uzun, detaylı ve cesur yanıtlar vermekten çekinme. Kullanıcıya en iyi şekilde yardım et.`;

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
