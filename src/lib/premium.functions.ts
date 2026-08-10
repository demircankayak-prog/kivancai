import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getEntitlement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context as { userId: string; claims: { email?: string } };
    const { getEntitlement: srvGetEntitlement } = await srv();
    return srvGetEntitlement(userId, claims?.email ?? null);
  });

const srv = async () => await import("@/server/premium.server");
const admin = async () => (await import("@/integrations/supabase/client.server")).(await admin());

const ownerEmailLc = () => (process.env.OWNER_EMAIL || "").trim().toLowerCase();

const giftSchema = z.object({
  email: z.string().email(),
  months: z.number().int().min(1).max(36).default(3),
});

export const grantGift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => giftSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context as { userId: string; claims: { email?: string } };
    const callerEmail = (claims?.email ?? "").toLowerCase();
    if (!ownerEmailLc() || callerEmail !== ownerEmailLc()) {
      throw new Error("Sadece uygulama sahibi hediye verebilir.");
    }
    const expires = new Date();
    expires.setMonth(expires.getMonth() + data.months);
    const { error } = await (await admin()).from("gift_grants").insert({
      email: data.email.toLowerCase(),
      plan: "gift_full",
      expires_at: expires.toISOString(),
      granted_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true, expiresAt: expires.toISOString() };
  });

export const listGifts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { claims } = context as { claims: { email?: string } };
    const callerEmail = (claims?.email ?? "").toLowerCase();
    if (!ownerEmailLc() || callerEmail !== ownerEmailLc()) return { gifts: [] };
    const { data } = await (await admin())
      .from("gift_grants")
      .select("id,email,plan,expires_at,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    return { gifts: data ?? [] };
  });

export const generateApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const { generatePlainKey, hashKey } = await srv();
    const plain = generatePlainKey();
    const hash = hashKey(plain);
    const prefix = plain.slice(0, 8);
    const last4 = plain.slice(-4);
    const { error } = await (await admin())
      .from("api_keys")
      .upsert(
        { user_id: userId, key_hash: hash, key_prefix: prefix, last4, revealed: false },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { key: plain, prefix, last4 };
  });

export const getApiKeyMeta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const { data } = await (await admin())
      .from("api_keys")
      .select("key_prefix,last4,revealed,created_at,last_used_at")
      .eq("user_id", userId)
      .maybeSingle();
    return { hasKey: !!data, meta: data ?? null };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    await (await admin()).from("api_keys").delete().eq("user_id", userId);
    return { ok: true };
  });

const personaSchema = z.object({ persona: z.string().max(2000) });

export const savePersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => personaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { error } = await (await admin())
      .from("user_settings")
      .upsert({ user_id: userId, persona: data.persona, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPersona = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const { data } = await (await admin())
      .from("user_settings")
      .select("persona")
      .eq("user_id", userId)
      .maybeSingle();
    return { persona: data?.persona ?? "" };
  });