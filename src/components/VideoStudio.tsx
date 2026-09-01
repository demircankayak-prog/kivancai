import { useEffect, useRef, useState } from "react";
import { Download, Film, Loader2, X } from "lucide-react";
import flagAsset from "@/assets/turk-bayragi.jpg.asset.json";

// Hugging Face token — koda gömülü, kullanıcıdan istenmez.
const HF_TOKEN = (import.meta.env["VITE_HF_TOKEN"] as string | undefined) ?? "hf_PASTE_YOUR_TOKEN_HERE";
const HF_URL = "https://api-inference.huggingface.co/models/cerspense/zeroscope_v2_576w";
const QUALITY_SUFFIX =
  "highly natural, realistic physics, cinematic, no deformities, clean composition, high quality";

const LIMIT_KEY = "jarvis_video_limit";
const DAILY_LIMIT = 5;

const today = () => new Date().toISOString().slice(0, 10);

const readUsed = () => {
  try {
    const raw = localStorage.getItem(LIMIT_KEY);
    if (!raw) return 0;
    const p = JSON.parse(raw) as { date?: string; used?: number };
    return p.date === today() ? (p.used ?? 0) : 0;
  } catch {
    return 0;
  }
};

const writeUsed = (used: number) => {
  try {
    localStorage.setItem(LIMIT_KEY, JSON.stringify({ date: today(), used }));
  } catch {
    /* yoksay */
  }
};

// Kredisiz çeviri: önce projedeki ücretsiz metin API'si (Groq), olmazsa MyMemory.
const translateToEnglish = async (text: string): Promise<string> => {
  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `Translate the following Turkish video prompt to natural English. Reply with ONLY the translation, no quotes, no extra words:\n${text}`,
          },
        ],
      }),
    });
    if (resp.ok && resp.body) {
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let out = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        out += dec.decode(value, { stream: true });
      }
      const clean = out.replace(/^["'\s]+|["'\s]+$/g, "").trim();
      if (clean && clean.length < 600) return clean;
    }
  } catch {
    /* devam */
  }
  try {
    const r = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=tr|en`,
    );
    const j = (await r.json()) as { responseData?: { translatedText?: string } };
    if (j.responseData?.translatedText) return j.responseData.translatedText;
  } catch {
    /* devam */
  }
  return text;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function VideoStudio({ onClose }: { onClose: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [used, setUsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    setUsed(readUsed());
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const remaining = Math.max(0, DAILY_LIMIT - used);

  const generate = async () => {
    if (busy || !prompt.trim() || remaining <= 0) return;
    setBusy(true);
    setVideoUrl(null);
    setStatus("Komutunuz İngilizceye çevriliyor...");
    const en = await translateToEnglish(prompt.trim());
    const finalPrompt = `${en}, ${QUALITY_SUFFIX}`;
    setStatus("Efendim, videonuz işleniyor. Model ısıtılıyor, lütfen sayfadan ayrılmayın...");

    try {
      for (let attempt = 0; attempt < 12; attempt++) {
        const resp = await fetch(HF_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: finalPrompt }),
        });

        if (resp.status === 503) {
          let wait = 20;
          try {
            const j = (await resp.json()) as { estimated_time?: number };
            if (typeof j.estimated_time === "number") wait = Math.min(90, Math.ceil(j.estimated_time));
          } catch {
            /* varsayılan */
          }
          setStatus(
            `Efendim, videonuz işleniyor. Model ısıtılıyor (${wait} sn), lütfen sayfadan ayrılmayın...`,
          );
          await sleep(wait * 1000);
          continue;
        }

        if (!resp.ok) {
          setStatus("Kanka video motoru şu an yoğun, birazdan tekrar dene.");
          setBusy(false);
          return;
        }

        const blob = await resp.blob();
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setVideoUrl(url);
        const next = readUsed() + 1;
        writeUsed(next);
        setUsed(next);
        setStatus("");
        setBusy(false);
        return;
      }
      setStatus("Model hâlâ ısınıyor kanka, birkaç dakika sonra tekrar dene.");
    } catch {
      setStatus("Bağlantı kurulamadı kanka, tekrar dene.");
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/85 p-4 backdrop-blur-sm">
      <div className="kv-rise max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-composer)]">
        <div className="relative">
          <img
            src={flagAsset.url}
            alt="Türk bayrağı"
            className="h-44 w-full rounded-t-2xl object-cover"
          />
          <button
            onClick={onClose}
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-background/70 text-foreground transition hover:bg-background"
            aria-label="Kapat"
          >
            <X size={16} />
          </button>
        </div>
        <p className="border-b border-border px-5 py-3 text-center text-sm font-extrabold tracking-wide text-foreground">
          BİZ BİR TÜRK MİLLİYETÇİSİYİZ.
        </p>

        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Film size={16} /> Video Üret
            </h2>
            <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
              Kalan Video Hakkı: {remaining} / {DAILY_LIMIT}
            </span>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Nasıl bir video olsun? (Türkçe yazabilirsin)"
            className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          <button
            onClick={generate}
            disabled={busy || remaining <= 0 || !prompt.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />}
            {busy ? "Üretiliyor..." : remaining <= 0 ? "Günlük hakkın bitti" : "Videoyu Oluştur"}
          </button>

          {busy && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3">
              <span className="relative grid h-8 w-8 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-brand/30" />
                <Loader2 size={18} className="animate-spin text-brand" />
              </span>
              <p className="text-xs text-muted-foreground">{status}</p>
            </div>
          )}
          {!busy && status && <p className="text-xs text-muted-foreground">{status}</p>}

          {videoUrl && (
            <div className="space-y-3">
              <video
                src={videoUrl}
                controls
                autoPlay
                loop
                className="w-full rounded-xl border border-border"
              />
              <a
                href={videoUrl}
                download="kivancai-video.mp4"
                className="flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition hover:bg-accent"
              >
                <Download size={15} /> Videoyu İndir
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
