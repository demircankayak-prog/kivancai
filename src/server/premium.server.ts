import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { randomBytes, createHash, timingSafeEqual } from "crypto";

const ownerEmail = () => (process.env.OWNER_EMAIL || "").trim().toLowerCase();

export async function isOwnerOrPremium(userId: string, email: string | null) {
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