import { createFileRoute } from "@tanstack/react-router";

// Ses akışı: önce ElevenLabs (anahtar varsa, en doğal), yoksa/başarısızsa
// tamamen ücretsiz ve anahtarsız internet TTS (Google Translate TTS, tr-TR).
const ELEVEN_DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL";

// Ücretsiz servis istek başına ~200 karakter alıyor: cümle bazlı böl.
const chunkText = (text: string, max = 190): string[] => {
  const parts = text.match(/[^.!?…\n]+[.!?…]*/g) || [text];
  const chunks: string[] = [];
  let cur = "";
  for (const raw of parts) {
    const piece = raw.trim();
    if (!piece) continue;
    if (piece.length > max) {
      if (cur) {
        chunks.push(cur);
        cur = "";
      }
      const words = piece.split(" ");
      let line = "";
      for (const w of words) {
        if ((line + " " + w).trim().length > max) {
          if (line) chunks.push(line.trim());
          line = w;
        } else {
          line = `${line} ${w}`;
        }
      }
      if (line.trim()) chunks.push(line.trim());
      continue;
    }
    if ((cur + " " + piece).trim().length > max) {
      chunks.push(cur.trim());
      cur = piece;
    } else {
      cur = `${cur} ${piece}`;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.slice(0, 12);
};

const freeInternetTts = async (text: string): Promise<Uint8Array | null> => {
  try {
    const chunks = chunkText(text);
    const buffers: Uint8Array[] = [];
    for (const chunk of chunks) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        chunk,
      )}&tl=tr&client=tw-ob&ttsspeed=1`;
      const r = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
          Referer: "https://translate.google.com/",
        },
      });
      if (!r.ok) {
        console.error("free tts chunk failed:", r.status);
        continue;
      }
      buffers.push(new Uint8Array(await r.arrayBuffer()));
    }
    if (!buffers.length) return null;
    const total = buffers.reduce((n, b) => n + b.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const b of buffers) {
      out.set(b, offset);
      offset += b.length;
    }
    return out;
  } catch (err) {
    console.error("free tts error:", err);
    return null;
  }
};

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { text, voiceId } = await request.json();
          if (!text || typeof text !== "string") {
            return new Response(JSON.stringify({ error: "text gerekli" }), { status: 400 });
          }
          const cleanText = text
            .replace(/[*_`#>~]+/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 1200);

          // 1) ElevenLabs (anahtar varsa — en doğal insan sesi)
          const apiKey = process.env.ELEVENLABS_API_KEY;
          if (apiKey) {
            const vid =
              (typeof voiceId === "string" && voiceId.trim().length > 15 && voiceId.trim()) ||
              ELEVEN_DEFAULT_VOICE;
            try {
              const resp = await fetch(
                `https://api.elevenlabs.io/v1/text-to-speech/${vid}/stream?output_format=mp3_44100_128`,
                {
                  method: "POST",
                  headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    text: cleanText,
                    model_id: "eleven_multilingual_v2",
                    voice_settings: {
                      stability: 0.48,
                      similarity_boost: 0.82,
                      style: 0.34,
                      use_speaker_boost: true,
                      speed: 1.0,
                    },
                  }),
                },
              );
              if (resp.ok && resp.body) {
                return new Response(resp.body, {
                  headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
                });
              }
              console.error("elevenlabs tts fallback:", resp.status);
            } catch (err) {
              console.error("elevenlabs tts error:", err);
            }
          }

          // 2) Tamamen ücretsiz, anahtarsız internet TTS
          const free = await freeInternetTts(cleanText);
          if (free) {
            return new Response(free.buffer as ArrayBuffer, {
              headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
            });
          }
          return new Response(JSON.stringify({ error: "TTS kullanılamıyor" }), { status: 502 });
        } catch (e) {
          console.error("tts route error:", e);
          return new Response(JSON.stringify({ error: "TTS hata" }), { status: 500 });
        }
      },
    },
  },
});
