import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { isOwnerOrPremium, generatePlainKey, hashKey } from "./premium.server";

export const getEntitlement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context as { userId: string; claims: { email?: string } };
    return isOwnerOrPremium(userId, claims?.email ?? null);
  });

export const generateApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const plain = generatePlainKey();
    const hash = hashKey(plain);
    const prefix = plain.slice(0, 8);
    const last4 = plain.slice(-4);
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