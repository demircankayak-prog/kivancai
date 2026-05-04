import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { randomBytes, createHash, timingSafeEqual } from "crypto";

const ownerEmail = () => (process.env.OWNER_EMAIL || "").trim().toLowerCase();

async function isOwnerOrPremium(userId: string, email: string | null) {
  if (email && ownerEmail() && email.toLowerCase() === ownerEmail()) {
    return { premium: true, owner: true, plan: "owner" as const, expiresAt: null as string | null };
  }
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("plan,current_period_end,status")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("current_period_end", new Date().toISOString())
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data) {
    return { premium: true, owner: false, plan: data.plan as string, expiresAt: data.current_period_end as string };
  }
  return { premium: false, owner: false, plan: null, expiresAt: null };
}

export const getEntitlement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context as { userId: string; claims: { email?: string } };
    return isOwnerOrPremium(userId, claims?.email ?? null);
  });

function generatePlainKey() {
  // kvc_<32 hex chars>
  const raw = randomBytes(24).toString("base64url");
  return `kvc_${raw}`;
}

function hashKey(plain: string) {
  return createHash("sha256").update(plain).digest("hex");
}

export const generateApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const plain = generatePlainKey();
    const hash = hashKey(plain);
    const prefix = plain.slice(0, 8);
    const last4 = plain.slice(-4);
    // upsert (one key per user, paylaşılamaz)
    const { error } = await supabaseAdmin
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
    const { data } = await supabaseAdmin
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
    await supabaseAdmin.from("api_keys").delete().eq("user_id", userId);
    return { ok: true };
  });

export const markKeyRevealed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    await supabaseAdmin.from("api_keys").update({ revealed: true }).eq("user_id", userId);
    return { ok: true };
  });

const personaSchema = z.object({ persona: z.string().max(2000) });

export const savePersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => personaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { error } = await supabaseAdmin
      .from("user_settings")
      .upsert({ user_id: userId, persona: data.persona, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPersona = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const { data } = await supabaseAdmin
      .from("user_settings")
      .select("persona")
      .eq("user_id", userId)
      .maybeSingle();
    return { persona: data?.persona ?? "" };
  });

// Internal helper used by chat API to check premium server-side
export async function checkPremiumByAuthHeader(authHeader: string | null): Promise<{ premium: boolean; userId: string | null; persona: string }> {
  if (!authHeader?.startsWith("Bearer ")) return { premium: false, userId: null, persona: "" };
  const token = authHeader.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { premium: false, userId: null, persona: "" };
  const u = data.user;
  const ent = await isOwnerOrPremium(u.id, u.email ?? null);
  const { data: s } = await supabaseAdmin
    .from("user_settings")
    .select("persona")
    .eq("user_id", u.id)
    .maybeSingle();
  return { premium: ent.premium, userId: u.id, persona: s?.persona ?? "" };
}

export function verifyApiKey(plain: string, hash: string) {
  const a = Buffer.from(hashKey(plain));
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}