import { createFileRoute } from "@tanstack/react-router";

// ElevenLabs Scribe v2 — Türkçe konuşma tanıma
export const Route = createFileRoute("/api/stt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const apiKey = process.env.ELEVENLABS_API_KEY;
          if (!apiKey) {
            return Response.json({ error: "ELEVENLABS_API_KEY yok" }, { status: 500 });
          }

          const incoming = await request.formData();
          const file = incoming.get("file");
          if (!(file instanceof File) && !(file instanceof Blob)) {
            return Response.json({ error: "Ses dosyası gerekli" }, { status: 400 });
          }

          const fd = new FormData();
          fd.append("file", file, "audio.webm");
          fd.append("model_id", "scribe_v2");
          fd.append("language_code", "tur");
          fd.append("tag_audio_events", "false");
          fd.append("diarize", "false");

          const resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
            method: "POST",
            headers: { "xi-api-key": apiKey },
            body: fd,
          });
          if (!resp.ok) {
            const t = await resp.text();
            console.error("STT error:", resp.status, t);
            return Response.json({ error: "Konuşma tanınamadı" }, { status: 502 });
          }
          const data = await resp.json();
          return Response.json({ text: (data.text || "").trim() });
        } catch (e) {
          console.error("stt route error:", e);
          return Response.json({ error: "STT hata" }, { status: 500 });
        }
      },
    },
  },
});
