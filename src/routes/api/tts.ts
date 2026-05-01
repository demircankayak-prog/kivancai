import { createFileRoute } from "@tanstack/react-router";

// ElevenLabs Turbo v2.5 — düşük gecikme, doğal Türkçe TTS
// Varsayılan ses: Daniel (onwK4e9ZLuTAKqWW03F9) — sıcak erkek sesi
const DEFAULT_VOICE = "onwK4e9ZLuTAKqWW03F9";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { text, voiceId } = await request.json();
          if (!text || typeof text !== "string") {
            return new Response(JSON.stringify({ error: "text gerekli" }), { status: 400 });
          }
          const apiKey = process.env.ELEVENLABS_API_KEY;
          if (!apiKey) {
            return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY yok" }), {
              status: 500,
            });
          }

          const vid = (typeof voiceId === "string" && voiceId.trim()) || DEFAULT_VOICE;
          const cleanText = text
            .replace(/[*_`#>~]+/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 2500);

          const resp = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${vid}/stream?output_format=mp3_44100_128`,
            {
              method: "POST",
              headers: {
                "xi-api-key": apiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text: cleanText,
                model_id: "eleven_turbo_v2_5",
                voice_settings: {
                  stability: 0.45,
                  similarity_boost: 0.8,
                  style: 0.35,
                  use_speaker_boost: true,
                  speed: 1.0,
                },
              }),
            },
          );

          if (!resp.ok || !resp.body) {
            const t = await resp.text();
            console.error("TTS error:", resp.status, t);
            return new Response(JSON.stringify({ error: "TTS başarısız" }), { status: 502 });
          }

          return new Response(resp.body, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "no-store",
            },
          });
        } catch (e) {
          console.error("tts route error:", e);
          return new Response(JSON.stringify({ error: "TTS hata" }), { status: 500 });
        }
      },
    },
  },
});
