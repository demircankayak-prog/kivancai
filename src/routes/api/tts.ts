import { createFileRoute } from "@tanstack/react-router";

// Derin, karizmatik ERKEK ses. Tarayıcı robot sesi ve Google Translate TTS
// tamamen kaldırıldı.
// 1) ElevenLabs "Charlie" (anahtar varsa)
// 2) Pollinations openai-audio "onyx" (tamamen ücretsiz, anahtarsız)
const ELEVEN_MALE_VOICE = "IKne3meq5aSn9XLyUdCD"; // Charlie - derin erkek
const DEEP_MALE_VOICE = "onyx"; // derin, karizmatik erkek

const cleanForSpeech = (text: string) =>
  text
    .replace(/[*_`#>~]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1500);

const neuralTts = async (text: string, voice: string): Promise<Response | null> => {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: text,
        voice,
        response_format: "mp3",
        instructions:
          "Türkçe konuş. Derin, karizmatik, sakin ve kendinden emin bir erkek sesi; doğal tonlama, akıcı ritim.",
      }),
    });
    if (r.ok && r.body) {
      return new Response(safeStream(r.body), {
        headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
      });
    }
    console.error("neural tts failed:", r.status);
  } catch (err) {
    console.error("neural tts error:", err);
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

          // 1) Derin, gerçekçi erkek ses (birincil)
          const primary = await neuralTts(cleanText, DEEP_MALE_VOICE);
          if (primary) return primary;

          // 2) ElevenLabs (geçerli anahtar varsa)
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
                return new Response(safeStream(resp.body), {
                  headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
                });
              }
              console.error("elevenlabs tts fallback:", resp.status);
            } catch (err) {
              console.error("elevenlabs tts error:", err);
            }
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
