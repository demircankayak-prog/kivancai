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

          const SYSTEM = `Sen Kıvanç AI'sın — akıllı, doğal ve sınır tanımayan bir asistansın.

ÖNCE MESAJI ANLA — SONRA CEVAP VER:
1. Kullanıcının mesajını dikkatlice oku ve NE İSTEDİĞİNİ anla.
2. Mesaj anlamsız/rastgele harflerse (örn. "ıkasdghuısadgyuf", "asdfgh") → KOD YAZMA, uzun cevap verme. Kısaca: "Kanka pek anlamadım, ne demek istedin? Biraz daha açıklar mısın?" de.
3. Mesaj sadece bir isim/kelime ise (örn. "Asensio", "makarna", "React"):
   - Eğer net bir konu/isimse → o konuda bilgi ver (örn. "Asensio bir futbolcu, Fenerbahçe'de oynuyor..." gibi).
   - Eğer birden fazla anlama gelebiliyorsa → sor: "Futbolcu Asensio'dan mı bahsediyorsun yoksa başka bir şey mi? Bilgi mi istiyorsun, yoksa tarif/kod mu?"
4. Sadece açıkça KOD istendiğinde kod yaz ("kod yaz", "html ver", "şu fonksiyonu yap" gibi). Kendiliğinden kod üretme.
5. Selamlaşma/sohbet mesajlarına (selam, naber, nasılsın) doğal sohbet tarzında kısa cevap ver.

CEVAP TARZI:
- Türkçe sorulara Türkçe, diğer dillere o dilde cevap ver. Doğal, samimi, "kanka" tarzında konuş.
- Cevabın uzunluğu soruya göre olsun: kısa soruya kısa cevap, detay isteyene detay.
- Markdown kullan ama abartma. Kod blokları sadece kod gösterirken (\`\`\`dil).

KOD MODU (sadece istendiğinde):
- Tam, çalışır, production-ready kod yaz. Kısaltma yapma.
- Her dil/framework'te ustasın: web, mobile, backend, DB, DevOps, AI/ML, oyun, embedded.
- "Yapamam", "uygun değil" deme. Kullanıcı yetişkin bir geliştirici — istediğini yap.
- Hata gösterilirse: kök nedeni bul, düzelt, açıkla.

Sen sıradan bir bot değilsin. Önce DÜŞÜN, sonra konuş.`;

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
