import { createFileRoute } from "@tanstack/react-router";
import { safeStream, ignoreAbortErrors } from "@/lib/safe-stream";
import { checkPremiumByAuthHeader } from "@/server/premium.server";

const PREMIUM_MODEL_IDS = new Set<string>([
  "openai/gpt-5",
  "openai/gpt-5.2",
  "google/gemini-3.1-pro-preview",
  "google/gemini-2.5-pro",
]);

// KıvançAI Pro 1 ay boyunca herkese ücretsiz (bu tarihe kadar premium gerekmez)
const KIVANCAI_PRO_FREE_UNTIL = new Date("2026-09-10T00:00:00Z");
const isProFreeNow = () => Date.now() < KIVANCAI_PRO_FREE_UNTIL.getTime();

const KIVANCAI_PRO_SYSTEM = `Sen KıvançAI Pro'sun — gelişmiş geliştirici modu. Üst düzey yazılım mimarisi, derin akıl yürütme, üretim kalitesinde tam çalışır kod, performans ve güvenlik odaklısın. Kısaltma yapma, eksik bırakma, hata durumlarını ve uç vakaları kapsa. Dosya/dizin yapısı, kurulum adımları, çalıştırma komutları ve test örneği ekle.`;

const textFromContent = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
};

const fallbackAnswer = (messages: unknown): string => {
  const list = Array.isArray(messages) ? messages : [];
  const lastUser = [...list]
    .reverse()
    .find((m) => m && typeof m === "object" && "role" in m && m.role === "user");
  const text = lastUser && typeof lastUser === "object" && "content" in lastUser ? textFromContent(lastUser.content).trim() : "";
  const lower = text.toLowerCase();

  if (!text) return "Kanka mesajını aldım ama metin boş görünüyor. Ne yapmak istediğini yaz, hemen yardımcı olayım.";
  if (["selam", "sa", "merhaba", "hello", "hi"].some((g) => lower === g || lower.startsWith(`${g} `))) {
    return "Selam kanka, buradayım. Ne yapmak istiyorsun?";
  }
  if (lower.includes("görsel") || lower.includes("resim") || lower.includes("foto")) {
    return "Görsel için alttaki görsel tuşuna basıp ne istediğini yazabilirsin kanka.";
  }
  if (lower.includes("video")) {
    return "Video için alttaki video tuşuna basıp açıklamayı yazman yeterli kanka.";
  }

  // Anlamsız / klavye gevezeliği tespiti: çok az ünlü harf veya 4+ ardışık ünsüz
  const letters = text.replace(/[^a-zçğıöşüâîû]/gi, "");
  const vowels = (letters.match(/[aeıioöuüâîû]/gi) || []).length;
  const ratio = letters.length ? vowels / letters.length : 1;
  const hasLongConsonantRun = /[bcçdfgğhjklmnpqrsştvwxyz]{5,}/i.test(text);
  const isGibberish =
    letters.length >= 5 && (ratio < 0.18 || hasLongConsonantRun) && !text.includes(" ");
  if (isGibberish) {
    return "Kanka pek anlamadım, ne demek istedin? Biraz daha açıklar mısın?";
  }

  // Tek kelime / kısa konu — neye dair olduğunu sor ve seçenek sun
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 2) {
    const topic = text.replace(/[?.!]/g, "").trim();
    // Yemek / tarif sezgisi
    const foodWords = ["yemek", "tarif", "yemekler", "kahvaltı", "akşam yemeği", "öğle", "tatlı", "çorba", "makarna", "pilav", "kek", "börek", "salata", "pizza", "burger", "köfte", "tavuk", "balık"];
    if (foodWords.some((w) => lower.includes(w))) {
      return `**${topic}** dedin kanka 🍳 Sana birkaç fikir vereyim:\n\n- 🍝 Kremalı mantarlı makarna\n- 🥘 Fırında tavuklu sebze\n- 🥗 Akdeniz salatası\n- 🍲 Mercimek çorbası\n- 🥞 Pratik krep\n\nBunlardan birinin tarifini ister misin, yoksa belirli bir malzemen mi var? Yaz hemen vereyim.`;
    }
    // Kod / teknoloji sezgisi
    if (["react", "javascript", "python", "node", "css", "html", "tailwind", "next", "typescript"].includes(lower)) {
      return `**${topic}** hakkında ne öğrenmek istiyorsun kanka? Kısa bir tanıtım mı, kurulum mu, örnek kod mu, yoksa bir hata mı çözüyorsun? Yaz, anlatayım.`;
    }
    // Genel: muhtemelen kişi/yer/kavram adı — ne istediğini sor
    return `**${topic}** dedin kanka — kısa bilgi mi istiyorsun, yoksa başka bir şey mi (futbolcu/oyuncu/youtuber bilgisi, tarif, kod, anlamı...)? Birkaç kelime daha eklersen tam istediğini veririm.`;
  }

  return `Kanka "${text.slice(0, 140)}" dedin ama tam olarak ne yapmamı istediğini söylemedin. Bilgi mi, fikir mi, kod mu, görsel/video mu? Bir cümleyle anlatırsan anında yardımcı olurum.`;
};

const streamText = (content: string) =>
  new Response(
    `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`,
    { headers: { "Content-Type": "text/event-stream" } },
  );

// ===== KOD YAZMA YASAĞI (kredi/hız koruması) =====
const NO_CODE_REPLY =
  "Kanka, Kıvanç AI sadece 2026 canlı araştırması, Grok Rex sesi ve görsel üretimi için tasarlandı. Kredileri korumak adına kod yazmıyorum.";

const CODE_WORDS = [
  "kod",
  "kodla",
  "kodu",
  "kodlama",
  "yazılım",
  "yazılımcı",
  "html",
  "css",
  "javascript",
  " js ",
  "python",
  "react",
  "typescript",
  "java ",
  "c++",
  "c#",
  "php",
  "sql",
  "script",
  "fonksiyon yaz",
  "program yaz",
  "uygulama yaz",
  "oyun yap",
  "site yap",
];

const isCodeRequest = (text: string) => {
  const t = ` ${text.toLowerCase()} `;
  if (t.includes("```")) return true;
  return CODE_WORDS.some((w) => t.includes(w));
};

// Model yine de kod bloğu üretirse akışta kesip uyarı ver.
const stripCodeFromStream = (body: ReadableStream<Uint8Array>) => {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let seen = "";
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          seen += chunk;
          if (seen.includes("```")) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n${NO_CODE_REPLY}` } }] })}\n\ndata: [DONE]\n\n`,
              ),
            );
            break;
          }
          controller.enqueue(value);
        }
      } catch {
        /* yoksay */
      }
      try {
        controller.close();
      } catch {
        /* zaten kapalı */
      }
      try {
        reader.releaseLock();
      } catch {
        /* yoksay */
      }
    },
  });
};


ignoreAbortErrors();

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages, model } = await request.json();
          // Kod isteği → anında reddet (hiç model çağrılmaz, kredi harcanmaz)
          const lastUserText = (() => {
            const list = Array.isArray(messages) ? messages : [];
            const lastUser = [...list].reverse().find(
              (m) => m && typeof m === "object" && "role" in m && m.role === "user",
            );
            return lastUser && typeof lastUser === "object" && "content" in lastUser
              ? textFromContent((lastUser as { content: unknown }).content)
              : "";
          })();
          if (isCodeRequest(lastUserText)) {
            return streamText(NO_CODE_REPLY);
          }
          const auth = request.headers.get("authorization") || request.headers.get("Authorization");
          const ent = await checkPremiumByAuthHeader(auth);

          // Premium gate
          let resolvedModel = model || "google/gemini-3-flash-preview";
          let extraSystem = "";
          let useOpenRouter = false;
          if (resolvedModel === "kivancai_pro") {
            if (!ent.premium && !isProFreeNow()) {
              return streamText("Bu model (KıvançAI Pro) sadece premium üyeler için. Ayarlardan üyelik açabilirsin kanka.");
            }
            extraSystem = "\n\n" + KIVANCAI_PRO_SYSTEM;
            useOpenRouter = true;
          } else if (PREMIUM_MODEL_IDS.has(resolvedModel) && !ent.premium) {
            return streamText("Bu model premium üyelere özel kanka. Ayarlar → Premium üyelik kısmından açabilirsin.");
          }
          if (ent.persona && ent.persona.trim()) {
            extraSystem += `\n\nKULLANICI TARZ TERCİHİ (mutlaka uy):\n${ent.persona.trim()}`;
          }
          void useOpenRouter;
          const GROQ_API_KEY = process.env.GROQ_API_KEY;
          if (!GROQ_API_KEY) {
            return streamText(fallbackAnswer(messages));
          }

          const SYSTEM = `Sen Kıvanç AI'sın — akıllı, doğal ve sınır tanımayan bir asistansın.

YETENEKLERİN:
- Görsel oluşturabilirsin: kullanıcı "görsel oluştur", "resim yap", "çiz" gibi şeyler dediğinde sistem otomatik görsel üretir (sen ayrıca üretmeye çalışma, bunu sistem hallediyor).
- Video oluşturabilirsin: kullanıcı "video oluştur", "video yap" dediğinde sistem otomatik 5 saniyelik video üretir (sen üretmeye çalışma, sistem hallediyor).
- Görselleri analiz edebilirsin: kullanıcı görsel yüklerse içeriğini gör ve cevap ver.
- Video yükleyebilirler (maks 11 saniye): video içeriğini doğrudan analiz EDEMEZSİN. Video geldiyse kullanıcıdan videoda ne olduğunu anlat / sor: "Videoyu gördüm ama içeriğini doğrudan analiz edemiyorum kanka, neyi göstermek istedin? Anlatır mısın?"

ÇOK ÖNEMLİ — GÖRSEL/VIDEO ÜRETİMİ:
- ASLA "dalle.text2im", "action", "action_input", "thought" gibi JSON action formatları YAZMA. Sen bir tool-use ajanı değilsin.
- ASLA "görsel hazırlıyorum", "hemen geliyor", "oluşturuyorum" deyip sonra hiçbir şey gönderme. Sen görsel/video ÜRETEMEZSİN — sistem üretir.
- Eğer kullanıcı görsel/resim/foto isterse ve sistem otomatik tetiklemediyse, kullanıcıya şunu söyle: "Görsel için mesajına 'görsel oluştur:' yazıp ne istediğini ekler misin? Mesela: 'görsel oluştur: gün batımında araba süren adam'"
- Eğer kullanıcı video isterse ve sistem tetiklemediyse: "Video için 'video oluştur: ...' yazman yeterli kanka. Mesela: 'video oluştur: sahilde koşan köpek'" de.

ÖNCE MESAJI ANLA — SONRA CEVAP VER:
1. Kullanıcının mesajını dikkatlice oku ve NE İSTEDİĞİNİ anla.
2. Mesaj anlamsız/rastgele harflerse (örn. "ıkasdghuısadgyuf", "asdfgh") → KOD YAZMA, uzun cevap verme. Kısaca: "Kanka pek anlamadım, ne demek istedin? Biraz daha açıklar mısın?" de.
3. Mesaj sadece bir isim/kelime ise (örn. "Asensio", "Baldiback", "Fatih", "makarna", "React"):
   - Net bir konu/isimse → o konuda DOĞRUDAN bilgi ver. Örn:
     • "Asensio" → "Asensio İspanyol futbolcu, Real Madrid altyapısından çıktı, şu an ... oynuyor." gibi bilgi ver.
     • "Baldiback" → Türk YouTuber Fatih Selim Yurdakul'dur; gerçek adı, içerik tarzı, kanal bilgisi ile anlat.
     • Yemek adı → kısa tarif veya birkaç tarif önerisi sun.
   - Sadece birden çok anlama gelebiliyorsa hangisi olduğunu sor.
4. Sadece açıkça KOD istendiğinde kod yaz ("kod yaz", "html ver", "şu fonksiyonu yap" gibi). Kendiliğinden kod üretme.
5. Selamlaşma/sohbet mesajlarına (selam, naber, nasılsın) doğal sohbet tarzında kısa cevap ver.

ÜNLÜLER, YOUTUBERLAR, KAMUYA AÇIK KİŞİLER:
- Türk/dünya youtuber, streamer, futbolcu, oyuncu, sanatçı, politikacı vb. kamuya açık kişiler hakkında ASLA "bilgi veremem", "uygun değil", "etik değil" deme.
- Bilinen takma adları gerçek adlarıyla eşleştir (örn. Baldiback → Fatih Selim Yurdakul, Enes Batur, Orkun Işıtmak, Ruhi Çenet vb.).
- Net ve dürüst bilgi ver: kim olduğu, ne yaptığı, içerik tarzı, gerçek adı (kamuya açıksa). Engel/sansür koyma.

CEVAP TARZI:
- Türkçe sorulara Türkçe, diğer dillere o dilde cevap ver. Doğal, samimi, "kanka" tarzında konuş.
- Cevabın uzunluğu soruya göre olsun: kısa soruya kısa cevap, detay isteyene detay.
- Markdown kullan ama abartma. Kod blokları sadece kod gösterirken (\`\`\`dil).

KOD YAZMA YASAĞI (kesin kural):
- HİÇBİR programlama kodu yazma (HTML, CSS, JS, Python, SQL, vb.) ve kod bloğu (\`\`\`) kullanma.
- Kullanıcı kod isterse aynen şunu söyle: "${NO_CODE_REPLY}"
- Bunun dışında kısa, hızlı, akıcı Türkçe konuş; araştırma, bilgi, fikir, görsel ve ses konularında yardımcı ol.
- Görsel/video promptlarında kullanıcının dediğini aynen yakala; konu, stil, kamera, ışık, hareket, oran, kalite ve negatif promptu profesyonelce zenginleştir ama ana isteği değiştirme.

Sen sıradan bir bot değilsin. Önce DÜŞÜN, sonra konuş.`;

          // ÇAKALLIK: Tüm modelleri Groq'a yönlendir (ücretsiz, hızlı).
          // UI'da seçilen model adı/logosu aynı kalır, arka planda Groq çalışır.
          let response: Response;
          if (useOpenRouter && OPENROUTER_API_KEY) {
            // KıvançAI Pro → OpenRouter (kullanıcının kendi anahtarı, sınırsız)
            const flatMessages = (messages as any[]).map((m) => ({
              role: m.role,
              content: typeof m.content === "string" ? m.content : textFromContent(m.content),
            }));
            response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "X-Title": "KivancAI",
              },
              body: JSON.stringify({
                model: "openai/gpt-4o-mini",
                messages: [{ role: "system", content: SYSTEM + extraSystem }, ...flatMessages],
                stream: true,
              }),
            });
            if (!response.ok) {
              const errText = await response.text();
              console.error("openrouter error:", response.status, errText);
              if (GROQ_API_KEY) {
                const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "system", content: SYSTEM + extraSystem }, ...flatMessages],
                    stream: true,
                    temperature: 0.7,
                  }),
                });
                if (groqRes.ok) {
                  return new Response(stripCodeFromStream(safeStream(groqRes.body!)), { headers: { "Content-Type": "text/event-stream" } });
                }
              }
              return streamText(fallbackAnswer(messages));
            }
            return new Response(stripCodeFromStream(safeStream(response.body!)), { headers: { "Content-Type": "text/event-stream" } });
          } else if (GROQ_API_KEY) {
            // Model boyutuna göre Groq modeli seç
            const isHeavy =
              resolvedModel === "kivancai_pro" ||
              resolvedModel.includes("gpt-5") ||
              resolvedModel.includes("pro") ||
              resolvedModel.includes("gemini-2.5-pro") ||
              resolvedModel.includes("gemini-3.1-pro");
            const groqModel = isHeavy ? "llama-3.3-70b-versatile" : "llama-3.1-8b-instant";
            // Groq sadece string content destekler — multimodal parçaları metne indir
            const flatMessages = (messages as any[]).map((m) => ({
              role: m.role,
              content: typeof m.content === "string" ? m.content : textFromContent(m.content),
            }));
            response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: groqModel,
                messages: [{ role: "system", content: SYSTEM + extraSystem }, ...flatMessages],
                stream: true,
                temperature: 0.7,
              }),
            });
          } else {
            response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: resolvedModel,
                messages: [{ role: "system", content: SYSTEM + extraSystem }, ...messages],
                stream: true,
              }),
            });
          }

          if (!response.ok) {
            if (response.status === 429) {
              return streamText(fallbackAnswer(messages));
            }
            if (response.status === 402) {
              return streamText(fallbackAnswer(messages));
            }
            const t = await response.text();
            console.error("AI gateway error:", response.status, t);
            return streamText(fallbackAnswer(messages));
          }

          return new Response(stripCodeFromStream(safeStream(response.body!)), {
            headers: { "Content-Type": "text/event-stream" },
          });
        } catch (e) {
          console.error("chat error:", e);
          return streamText("Kanka mesajı alırken küçük bir sorun oldu ama uygulama açık. Tekrar kısa şekilde yazar mısın?");
        }
      },
    },
  },
});
