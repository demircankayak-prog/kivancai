import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const BodySchema = z.object({
  provider: z.enum(["anthropic", "poe"]),
  apiKey: z.string().trim().min(10).max(4000),
  model: z.string().trim().min(1).max(120),
  endpoint: z.string().trim().url().max(300).optional().or(z.literal("")),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.any(),
      }),
    )
    .min(1)
    .max(80),
});

const SYSTEM =
  "Sen Kıvanç AI içinde çalışan net, hızlı ve doğal bir sohbet asistanısın. Türkçe konuşulursa Türkçe cevap ver.";

const contentToText = (content: unknown): string => {
  if (typeof content === "string") return content.slice(0, 20000);
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string")
          return part.text;
        if (part && typeof part === "object" && "image_url" in part)
          return "[Kullanıcı bir görsel ekledi]";
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .slice(0, 20000);
  }
  return "";
};

export const Route = createFileRoute("/api/custom-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const parsed = BodySchema.safeParse(await request.json());
          if (!parsed.success) {
            return Response.json(
              { error: "API ayarları veya mesaj formatı hatalı." },
              { status: 400 },
            );
          }

          const { provider, apiKey, model, endpoint, messages } = parsed.data;
          const textMessages = messages
            .map((m) => ({ role: m.role, content: contentToText(m.content) }))
            .filter((m) => m.content.trim());

          if (provider === "anthropic") {
            const resp = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
              },
              body: JSON.stringify({
                model,
                max_tokens: 4096,
                system: SYSTEM,
                messages: textMessages,
              }),
            });

            const data = await resp.json().catch(() => null);
            if (!resp.ok) {
              return Response.json(
                { error: data?.error?.message || "Anthropic API isteği başarısız oldu." },
                { status: resp.status },
              );
            }

            const content = Array.isArray(data?.content)
              ? data.content
                  .map((p: unknown) => {
                    if (p && typeof p === "object" && "type" in p && "text" in p) {
                      return p.type === "text" && typeof p.text === "string" ? p.text : "";
                    }
                    return "";
                  })
                  .join("\n")
                  .trim()
              : "";
            return Response.json({ content: content || "Yanıt boş döndü." });
          }

          const poeEndpoint = endpoint || "https://api.poe.com/v1/chat/completions";
          const resp = await fetch(poeEndpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages: [{ role: "system", content: SYSTEM }, ...textMessages],
              stream: false,
            }),
          });

          const data = await resp.json().catch(() => null);
          if (!resp.ok) {
            return Response.json(
              { error: data?.error?.message || data?.message || "Poe API isteği başarısız oldu." },
              { status: resp.status },
            );
          }

          const content =
            data?.choices?.[0]?.message?.content ||
            data?.output_text ||
            data?.text ||
            "Yanıt boş döndü.";
          return Response.json({ content });
        } catch (e) {
          console.error("custom chat error:", e);
          return Response.json(
            { error: e instanceof Error ? e.message : "Bilinmeyen hata" },
            { status: 500 },
          );
        }
      },
    },
  },
});
