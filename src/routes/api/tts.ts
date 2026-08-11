import { createFileRoute } from "@tanstack/react-router";

// Tamamen ücretsiz, anahtarsız TTS: Pollinations (openai-audio) — gerçek insan sesi.
// Türkçe için "nova" / "shimmer" doğal sonuç veriyor.
const DEFAULT_POLLINATIONS_VOICE = "nova";
const ELEVEN_DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL";

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

          // 1) Ücretsiz internet TTS (anahtar/kredi gerekmez)
          const pollVoice =
            (typeof voiceId === "string" && /^[a-z]+$/.test(voiceId.trim()) && voiceId.trim()) ||
            DEFAULT_POLLINATIONS_VOICE;
          try {
            const pollUrl = `https://text.pollinations.ai/${encodeURIComponent(
              `Bu metni doğal ve akıcı bir Türkçe ile seslendir: ${cleanText}`,
            )}?model=openai-audio&voice=${pollVoice}`;
            const pollResp = await fetch(pollUrl);
            const ct = pollResp.headers.get("content-type") || "";
            if (pollResp.ok && pollResp.body && ct.includes("audio")) {
              return new Response(pollResp.body, {
                headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
              });
            }
            console.error("pollinations tts fallback:", pollResp.status, ct);
          } catch (err) {
            console.error("pollinations tts error:", err);
          }

          // 2) Yedek: ElevenLabs (anahtar varsa)
          const apiKey = process.env.ELEVENLABS_API_KEY;
          if (!apiKey) {
            return new Response(JSON.stringify({ error: "TTS kullanılamıyor" }), { status: 502 });
          }
          const vid =
            (typeof voiceId === "string" && voiceId.trim().length > 15 && voiceId.trim()) ||
            ELEVEN_DEFAULT_VOICE;
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
