import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import logoImg from "@/assets/logo.png";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const emailSchema = z.string().trim().email({ message: "Geçerli bir e-posta girin" }).max(255);
const passwordSchema = z.string().min(6, { message: "Şifre en az 6 karakter olmalı" }).max(72);
const nameSchema = z.string().trim().min(2, { message: "İsim en az 2 karakter olmalı" }).max(50);

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: "/" });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const eRes = emailSchema.safeParse(email);
    if (!eRes.success) return setError(eRes.error.issues[0].message);
    const pRes = passwordSchema.safeParse(password);
    if (!pRes.success) return setError(pRes.error.issues[0].message);

    setBusy(true);
    try {
      if (mode === "signup") {
        const nRes = nameSchema.safeParse(name);
        if (!nRes.success) {
          setError(nRes.error.issues[0].message);
          setBusy(false);
          return;
        }
        const { error: err } = await supabase.auth.signUp({
          email: eRes.data,
          password: pRes.data,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: nRes.data },
          },
        });
        if (err) {
          if (err.message.toLowerCase().includes("invalid")) {
            setError("Geçerli bir e-posta girin. Sahte adresler kabul edilmez.");
          } else if (err.message.toLowerCase().includes("already")) {
            setError("Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.");
          } else {
            setError(err.message);
          }
        } else {
          setInfo(`📩 ${eRes.data} adresine bir doğrulama linki gönderildi. Lütfen e-postanızı açıp linke tıklayın, sonra giriş yapın.`);
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: eRes.data,
          password: pRes.data,
        });
        if (err) {
          if (err.message.toLowerCase().includes("email not confirmed")) {
            setError("E-postanızı henüz doğrulamadınız. Posta kutunuzdaki linke tıklayın.");
          } else {
            setError("E-posta veya şifre hatalı.");
          }
        } else {
          navigate({ to: "/" });
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[image:var(--gradient-stage)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/95 p-8 shadow-[var(--shadow-composer)] backdrop-blur-md">
        <div className="mb-6 flex items-center gap-3">
          <img
            src={logoImg}
            alt="Kıvanç AI"
            className="h-9 w-9 drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]"
          />
          <h1 className="font-serif text-2xl font-bold">Kıvanç AI</h1>
        </div>
        <h2 className="text-xl font-semibold">{mode === "signup" ? "Hesap oluştur" : "Giriş yap"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signup" ? "Sınırsız AI gücüne erişin" : "Hesabınıza tekrar hoş geldiniz"}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Adınız Soyadınız"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-brand/40"
              required
            />
          )}
          <input
            type="email"
            placeholder="E-posta adresiniz"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-brand/40"
            required
          />
          <input
            type="password"
            placeholder="Şifre (en az 6 karakter)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-brand/40"
            required
          />

          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          {info && <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signup" ? "Hesap oluştur" : "Giriş yap"}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "signup" ? "Zaten hesabın var mı? " : "Hesabın yok mu? "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signup" ? "signin" : "signup");
              setError(null);
              setInfo(null);
            }}
            className="font-semibold text-brand hover:underline"
          >
            {mode === "signup" ? "Giriş yap" : "Kayıt ol"}
          </button>
        </div>
        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Ana sayfa</Link>
        </div>
      </div>
    </main>
  );
}
