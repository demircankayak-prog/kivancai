import { createFileRoute } from "@tanstack/react-router";

// Derin, karizmatik ERKEK ses. Tarayıcı robot sesi ve Google Translate TTS
// tamamen kaldırıldı.
// 1) ElevenLabs "Charlie" (anahtar varsa)
// 2) Pollinations openai-audio "onyx" (tamamen ücretsiz, anahtarsız)
const ELEVEN_MALE_VOICE = "IKne3meq5aSn9XLyUdCD"; // Charlie - derin erkek
const POLLINATIONS_MALE_VOICE = "onyx";

const cleanForSpeech = (text: string) =>
  text
    .replace(/[*_`#>~]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1500);

const pollinationsTts = async (text: string, voice: string): Promise<Response | null> => {
  try {
    const url = `https://text.pollinations.ai/${encodeURIComponent(
      `Aşağıdaki metni Türkçe, doğal ve akıcı bir şekilde seslendir: ${text}`,
    )}?model=openai-audio&voice=${encodeURIComponent(voice)}`;
    const r = await fetch(url);
    const ct = r.headers.get("content-type") || "";
    if (r.ok && r.body && ct.includes("audio")) {
      return new Response(r.body, {
        headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
      });
    }
    console.error("pollinations tts failed:", r.status, ct);
  } catch (err) {
    console.error("pollinations tts error:", err);
  }
  return null;
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
          const cleanText = cleanForSpeech(text);
          if (!cleanText) {
            return new Response(JSON.stringify({ error: "text gerekli" }), { status: 400 });
          }

          // 1) ElevenLabs (anahtar varsa) — derin erkek ses
          const apiKey = process.env.ELEVENLABS_API_KEY;
          if (apiKey) {
            const vid =
              (typeof voiceId === "string" && voiceId.trim().length > 15 && voiceId.trim()) ||
              ELEVEN_MALE_VOICE;
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
                      stability: 0.45,
                      similarity_boost: 0.85,
                      style: 0.3,
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

          // 2) Ücretsiz, anahtarsız yüksek kaliteli erkek ses
          const free = await pollinationsTts(cleanText, POLLINATIONS_MALE_VOICE);
          if (free) return free;

          return new Response(JSON.stringify({ error: "TTS kullanılamıyor" }), { status: 502 });
        } catch (e) {
          console.error("tts route error:", e);
          return new Response(JSON.stringify({ error: "TTS hata" }), { status: 500 });
        }
      },
    },
  },
});
