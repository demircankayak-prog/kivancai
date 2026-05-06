import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { randomBytes, createHash, timingSafeEqual } from "crypto";

const ownerEmail = () => (process.env.OWNER_EMAIL || "").trim().toLowerCase();

export const BASIC_ALLOWED_MODELS = [
  "google/gemini-3-flash-preview",
  "openai/gpt-5-mini",
];
export const FREE_ALLOWED_MODELS = ["google/gemini-2.5-flash-lite"];

export type Entitlement = {
  premium: boolean;
  owner: boolean;
  plan: "owner" | "full" | "basic" | "gift_full" | null;
  expiresAt: string | null;
  allowedModels: string[] | "all";
};

export async function isOwnerOrPremium(userId: string, email: string | null) {
  return getEntitlement(userId, email);
}

export async function getEntitlement(userId: string, email: string | null): Promise<Entitlement> {
  if (email && ownerEmail() && email.toLowerCase() === ownerEmail()) {
    return { premium: true, owner: true, plan: "owner", expiresAt: null, allowedModels: "all" };
  }
  // Hediye var mı?
  if (email) {
    const { data: gift } = await supabaseAdmin
      .from("gift_grants")
      .select("plan,expires_at")
      .ilike("email", email)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (gift) {
      return { premium: true, owner: false, plan: "gift_full", expiresAt: gift.expires_at as string, allowedModels: "all" };
    }
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
    const plan = data.plan as "full" | "basic";
    return {
      premium: true,
      owner: false,
      plan,
      expiresAt: data.current_period_end as string,
      allowedModels: plan === "full" ? "all" : [...BASIC_ALLOWED_MODELS, ...FREE_ALLOWED_MODELS],
    };
  }
  return { premium: false, owner: false, plan: null, expiresAt: null, allowedModels: FREE_ALLOWED_MODELS };
}

export function generatePlainKey() {
  const raw = randomBytes(24).toString("base64url");
  return `kvc_${raw}`;
}

export function hashKey(plain: string) {
  return createHash("sha256").update(plain).digest("hex");
}

export function verifyApiKey(plain: string, hash: string) {
  const a = Buffer.from(hashKey(plain));
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

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