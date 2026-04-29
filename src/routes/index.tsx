import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  FileText,
  Lightbulb,
  Menu,
  Mic,
  Palette,
  PenSquare,
  Plus,
  Search,
  Send,
  User,
  LogOut,
  Save,
  Info,
  X,
  Bookmark,
  Paperclip,
  Image as ImageIcon,
  Loader2,
  Film,
  Settings2,
  KeyRound,
  Bell,
  Bot,
  Brush,
  Globe2,
  HelpCircle,
  Link2,
  MessageSquare,
  NotebookTabs,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logoImg from "@/assets/kivancai-logo-circle.png";

export const Route = createFileRoute("/")({
  component: Index,
});

type Attachment = { kind: "image" | "video"; url: string; name?: string };
type Msg = {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  generatedImage?: string; // watermarklı data url
  generatedVideo?: string; // video url
};
type CustomAiProvider = "anthropic" | "poe";
type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

const CUSTOM_AI_MODELS = {
  anthropic: ["claude-3-5-sonnet-latest", "claude-sonnet-4-5", "claude-opus-4-1"],
  poe: ["Claude-3.5-Sonnet", "Claude-Sonnet-4.5", "Grok-4", "GPT-5", "Gemini-2.5-Pro"],
};

interface ModelOption {
  id: string;
  label: string;
  provider: string;
  description: string;
  available: boolean;
}

const MODELS: ModelOption[] = [
  {
    id: "google/gemini-3-flash-preview",
    label: "Gemini 3 Flash",
    provider: "Google",
    description: "Hızlı, dengeli — günlük sorular için ideal",
    available: true,
  },
  {
    id: "google/gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    provider: "Google",
    description: "En güçlü Gemini — derin akıl yürütme",
    available: true,
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "Google",
    description: "Görsel + uzun bağlam + karmaşık analiz",
    available: true,
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "Google",
    description: "Dengeli — hız ve kalite",
    available: true,
  },
  {
    id: "google/gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    provider: "Google",
    description: "En hızlı — basit görevler için",
    available: true,
  },
  {
    id: "openai/gpt-5.2",
    label: "GPT-5.2",
    provider: "OpenAI",
    description: "OpenAI'nin en yeni modeli — karmaşık problem çözme",
    available: true,
  },
  {
    id: "openai/gpt-5",
    label: "GPT-5",
    provider: "OpenAI",
    description: "Güçlü çok yönlü — mükemmel akıl yürütme",
    available: true,
  },
  {
    id: "openai/gpt-5-mini",
    label: "GPT-5 Mini",
    provider: "OpenAI",
    description: "Orta düzey — düşük maliyet, iyi performans",
    available: true,
  },
  {
    id: "openai/gpt-5-nano",
    label: "GPT-5 Nano",
    provider: "OpenAI",
    description: "Hız ve verimlilik için tasarlandı",
    available: true,
  },
  {
    id: "openai/gpt-5",
    label: "Grok 3 (xAI)",
    provider: "xAI",
    description: "Elon Musk'ın AI'si — gerçek zamanlı, esprili yanıtlar",
    available: true,
  },
  {
    id: "openai/gpt-5",
    label: "ChatGPT 4o",
    provider: "OpenAI",
    description: "ChatGPT'nin klasik gücü — günlük sohbet",
    available: true,
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    description: "Uzun yazı ve nüanslı yanıtlar — Anthropic kalitesi",
    available: true,
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Perplexity Sonar",
    provider: "Perplexity",
    description: "Web araması ile canlı yanıtlar",
    available: true,
  },
  {
    id: "google/gemini-2.5-flash-lite",
    label: "DuckDuckGo AI",
    provider: "DuckDuckGo",
    description: "Gizlilik odaklı arama destekli AI",
    available: true,
  },
  {
    id: "openai/gpt-5-mini",
    label: "Llama 3.1 405B",
    provider: "Meta",
    description: "Açık kaynak dev model — Meta'nın gücü",
    available: true,
  },
  {
    id: "openai/gpt-5-mini",
    label: "Mistral Large",
    provider: "Mistral",
    description: "Avrupa'nın güçlü modeli — kod ve mantık",
    available: true,
  },
  {
    id: "google/gemini-3.1-pro-preview",
    label: "DeepSeek R1",
    provider: "DeepSeek",
    description: "Derin akıl yürütme uzmanı",
    available: true,
  },
];

const promptActions = [
  {
    label: "Proje Başlat",
    icon: FileText,
    prompt: "Bana yeni bir proje fikri için detaylı bir başlangıç planı yap.",
  },
  { label: "Tasarım Yap", icon: Palette, prompt: "Modern ve şık bir tasarım önerisi yapar mısın?" },
  { label: "Araştırma Yap", icon: Search, prompt: "Şu konu hakkında derin araştırma yap: " },
  {
    label: "Fikir Geliştir",
    icon: Lightbulb,
    prompt: "Şu fikri geliştir ve daha iyi hale getir: ",
  },
];

const SETTINGS_ITEMS = [
  { label: "Etkinlik", icon: Bell, detail: "Sohbet ve kullanım geçmişi" },
  { label: "Tema", icon: Brush, detail: "Koyu minimal arayüz" },
  { label: "KıvançAI için talimatlar", icon: Bot, detail: "Asistan davranışı" },
  { label: "Bağlı uygulamalar", icon: Link2, detail: "Poe, Anthropic ve diğerleri" },
  { label: "Herkese açık bağlantılarınız", icon: Globe2, detail: "Paylaşılan linkler" },
  { label: "NotebookLM", icon: NotebookTabs, detail: "Not ve kaynak alanı" },
  { label: "Geri bildirim gönder", icon: MessageSquare, detail: "Öneri ve hata bildirimi" },
  { label: "Yardım", icon: HelpCircle, detail: "Destek merkezi" },
];

function Index() {
  const navigate = useNavigate();
  const { user, profile, signOut, loading } = useAuth();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [modelKey, setModelKey] = useState(MODELS[0].label);
  const selectedModel = MODELS.find((m) => m.label === modelKey) ?? MODELS[0];
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [savedChats, setSavedChats] = useState<
    Array<{ id: string; title: string; messages: Msg[] }>
  >([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aboutOpen, setAboutOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [recording, setRecording] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [quickPanel, setQuickPanel] = useState<null | "image" | "video" | "settings">(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickPrompt, setQuickPrompt] = useState("");
  const [videoDuration, setVideoDuration] = useState<5 | 10>(5);
  const [customAiEnabled, setCustomAiEnabled] = useState(false);
  const [customAiProvider, setCustomAiProvider] = useState<CustomAiProvider>("anthropic");
  const [customAiKey, setCustomAiKey] = useState("");
  const [customAiModel, setCustomAiModel] = useState(CUSTOM_AI_MODELS.anthropic[0]);
  const [customAiEndpoint, setCustomAiEndpoint] = useState(
    "https://api.poe.com/v1/chat/completions",
  );

  const openQuickPanel = (panel: "image" | "video" | "settings") => {
    setModelMenuOpen(false);
    setQuickPanel((q) => (q === panel ? null : panel));
    setQuickPrompt("");
  };

  const changeCustomProvider = (provider: CustomAiProvider) => {
    setCustomAiProvider(provider);
    setCustomAiModel(CUSTOM_AI_MODELS[provider][0]);
  };

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const MAX_VIDEO_SECONDS = 11;
  const checkVideoDuration = (file: File): Promise<number> =>
    new Promise((resolve) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(v.src);
        resolve(v.duration);
      };
      v.onerror = () => resolve(0);
      v.src = URL.createObjectURL(file);
    });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!requireAuth()) return;
    for (const f of files) {
      if (f.type.startsWith("image/")) {
        const url = await fileToDataUrl(f);
        setPendingAttachments((p) => [...p, { kind: "image", url, name: f.name }]);
      } else if (f.type.startsWith("video/")) {
        const dur = await checkVideoDuration(f);
        if (dur > MAX_VIDEO_SECONDS + 0.5) {
          alert(`Video en fazla ${MAX_VIDEO_SECONDS} saniye olmalı. Bu video ${dur.toFixed(1)}s.`);
          continue;
        }
        const url = await fileToDataUrl(f);
        setPendingAttachments((p) => [...p, { kind: "video", url, name: f.name }]);
      } else {
        alert("Sadece görsel ve video kabul ediliyor.");
      }
    }
  };

  // Watermark ekle (sağ alta logo + "Kıvanç AI" yazısı)
  const addWatermark = (imageDataUrl: string): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        const logo = new Image();
        logo.crossOrigin = "anonymous";
        logo.onload = () => {
          const pad = Math.max(16, Math.round(img.width * 0.02));
          const logoSize = Math.max(48, Math.round(img.width * 0.08));
          const text = "Kıvanç AI";
          const fontSize = Math.max(18, Math.round(img.width * 0.025));
          ctx.font = `bold ${fontSize}px sans-serif`;
          const textWidth = ctx.measureText(text).width;
          const boxH = logoSize + pad;
          const boxW = logoSize + textWidth + pad * 1.5;
          const x = canvas.width - boxW - pad;
          const y = canvas.height - boxH - pad;
          // arka plan
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          const r = boxH / 2;
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.arcTo(x + boxW, y, x + boxW, y + boxH, r);
          ctx.arcTo(x + boxW, y + boxH, x, y + boxH, r);
          ctx.arcTo(x, y + boxH, x, y, r);
          ctx.arcTo(x, y, x + boxW, y, r);
          ctx.closePath();
          ctx.fill();
          // logo
          ctx.drawImage(logo, x + pad / 2, y + (boxH - logoSize) / 2, logoSize, logoSize);
          // metin
          ctx.fillStyle = "white";
          ctx.textBaseline = "middle";
          ctx.fillText(text, x + pad / 2 + logoSize + pad / 2, y + boxH / 2);
          resolve(canvas.toDataURL("image/png"));
        };
        logo.onerror = () => resolve(imageDataUrl);
        logo.src = logoImg;
      };
      img.onerror = () => resolve(imageDataUrl);
      img.src = imageDataUrl;
    });

  // Mesajdan görsel oluşturma niyeti var mı?
  const isImageRequest = (text: string): boolean => {
    const t = text.toLowerCase();
    if (t.startsWith("/görsel") || t.startsWith("/gorsel") || t.startsWith("/image")) return true;
    const triggers = [
      "görsel oluştur",
      "görsel yap",
      "resim oluştur",
      "resim yap",
      "fotoğraf oluştur",
      "fotoğraf yap",
      "çiz",
      "görselleştir",
      "bir görsel",
      "bir resim",
      "image of",
      "generate image",
      "create image",
      "görsel hazırla",
      "resim hazırla",
      "fotoğraf hazırla",
      "foto yap",
      "foto oluştur",
      "görsel ver",
      "resim ver",
      "fotoğraf ver",
      "görselini yap",
      "resmini yap",
    ];
    return triggers.some((k) => t.includes(k));
  };

  // Video oluşturma niyeti
  const isVideoRequest = (text: string): boolean => {
    const t = text.toLowerCase();
    if (t.startsWith("/video")) return true;
    const triggers = [
      "video oluştur",
      "video yap",
      "video hazırla",
      "video ver",
      "bir video",
      "videosunu yap",
      "generate video",
      "create video",
      "video çek",
      "klip yap",
      "klip oluştur",
    ];
    return triggers.some((k) => t.includes(k));
  };

  const generateImage = async (prompt: string, inputImage?: string) => {
    setGeneratingImage(true);
    try {
      const cleanPrompt = prompt.replace(/^\/(görsel|gorsel|image)\s*/i, "");
      const resp = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: cleanPrompt, inputImage }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.image) {
        setMessages((p) => [
          ...p,
          { role: "assistant", content: `⚠️ ${data.error || "Görsel oluşturulamadı"}` },
        ]);
        return;
      }
      const watermarked = await addWatermark(data.image);
      setMessages((p) => [
        ...p,
        {
          role: "assistant",
          content: "İşte istediğin görsel kanka 🎨",
          generatedImage: watermarked,
        },
      ]);
    } catch (e) {
      setMessages((p) => [
        ...p,
        { role: "assistant", content: "⚠️ Görsel oluşturulurken hata oldu." },
      ]);
    } finally {
      setGeneratingImage(false);
    }
  };

  const generateVideo = async (prompt: string, duration: 5 | 10 = 5) => {
    setGeneratingVideo(true);
    setMessages((p) => [
      ...p,
      {
        role: "assistant",
        content: `🎬 ${duration} saniyelik video hazırlanıyor kanka (Kling AI), bu 1-3 dk sürebilir...`,
      },
    ]);
    try {
      const cleanPrompt = prompt.replace(/^\/video\s*/i, "");
      const resp = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: cleanPrompt, duration }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.video) {
        setMessages((p) => {
          const arr = [...p];
          arr[arr.length - 1] = {
            role: "assistant",
            content:
              data.message ||
              "🎬 Video oluşturma bağlantısı hazır ama şu an aktif değil kanka. Teknik hata yok; geçerli video API bağlantısı eklenince 10 saniyelik videolar direkt çalışır.",
          };
          return arr;
        });
        return;
      }
      setMessages((p) => {
        const arr = [...p];
        arr[arr.length - 1] = {
          role: "assistant",
          content: "İşte istediğin video kanka 🎬",
          generatedVideo: data.video,
        };
        return arr;
      });
    } catch (e) {
      setMessages((p) => {
        const arr = [...p];
        arr[arr.length - 1] = {
          role: "assistant",
          content:
            "🎬 Video servisine şu an ulaşılamıyor kanka. Uygulama bozulmadı; biraz sonra tekrar deneyebilirsin.",
        };
        return arr;
      });
    } finally {
      setGeneratingVideo(false);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem("kivanc-saved-chats");
    if (stored)
      try {
        setSavedChats(JSON.parse(stored));
      } catch {
        setSavedChats([]);
      }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const requireAuth = () => {
    if (!user) {
      navigate({ to: "/auth" });
      return false;
    }
    return true;
  };

  const sendMessage = async (text: string) => {
    if (
      (!text.trim() && pendingAttachments.length === 0) ||
      streaming ||
      generatingImage ||
      generatingVideo
    )
      return;
    if (!requireAuth()) return;

    const userMsg: Msg = {
      role: "user",
      content: text,
      attachments: pendingAttachments.length ? pendingAttachments : undefined,
    };
    const attachmentsForThisSend = pendingAttachments;
    setPendingAttachments([]);
    const newMessages: Msg[] = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");

    // Video oluşturma isteği mi? (önce kontrol et — "video" kelimesi geçmesi yeterli)
    if (isVideoRequest(text)) {
      await generateVideo(text);
      return;
    }

    // Görsel oluşturma isteği mi?
    if (isImageRequest(text)) {
      const firstImage = attachmentsForThisSend.find((a) => a.kind === "image");
      await generateImage(text, firstImage?.url);
      return;
    }

    setStreaming(true);

    try {
      // Multimodal: görselleri AI'ya yolla
      const apiMessages = newMessages.map((m) => {
        if (m.role === "user" && m.attachments && m.attachments.length > 0) {
          const images = m.attachments.filter((a) => a.kind === "image");
          if (images.length > 0) {
            const videoNote =
              m.attachments.filter((a) => a.kind === "video").length > 0
                ? "\n[Kullanıcı ayrıca bir video yükledi — videoları henüz analiz edemiyorum, ama açıklamasını sorabilirsin.]"
                : "";
            return {
              role: "user",
              content: [
                { type: "text", text: (m.content || "Bu görsel(ler)e bak.") + videoNote },
                ...images.map((img) => ({ type: "image_url", image_url: { url: img.url } })),
              ],
            };
          }
          if (m.attachments.some((a) => a.kind === "video")) {
            return {
              role: "user",
              content:
                (m.content || "Bir video yükledim.") +
                "\n[Not: Kullanıcı bir video yükledi. Şu an video içeriğini analiz edemiyorum — kullanıcıya videoda ne olduğunu sormalı veya açıklamasını istemeliyim.]",
            };
          }
        }
        return { role: m.role, content: m.content };
      });

      if (customAiEnabled) {
        if (!customAiKey.trim()) {
          setMessages((p) => [
            ...p,
            {
              role: "assistant",
              content: "⚠️ Kişisel AI için önce artı menüsünden API anahtarını girmen gerekiyor.",
            },
          ]);
          setStreaming(false);
          return;
        }

        const resp = await fetch("/api/custom-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: customAiProvider,
            apiKey: customAiKey.trim(),
            model: customAiModel.trim(),
            endpoint: customAiProvider === "poe" ? customAiEndpoint.trim() : undefined,
            messages: apiMessages,
          }),
        });
        const data = await resp.json().catch(() => ({ error: "Kişisel AI yanıtı okunamadı." }));
        if (!resp.ok) {
          setMessages((p) => [
            ...p,
            {
              role: "assistant",
              content: `⚠️ ${data.error || "Kişisel AI isteği başarısız oldu."}`,
            },
          ]);
          setStreaming(false);
          return;
        }
        setMessages((p) => [
          ...p,
          { role: "assistant", content: data.content || "Yanıt boş döndü." },
        ]);
        setStreaming(false);
        return;
      }

      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, model: selectedModel.id }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Bir sorun oluştu" }));
        setMessages((p) => [...p, { role: "assistant", content: `⚠️ ${err.error || "Hata"}` }]);
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      setMessages((p) => [...p, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              setMessages((p) =>
                p.map((m, i) => (i === p.length - 1 ? { ...m, content: assistantText } : m)),
              );
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      setMessages((p) => [...p, { role: "assistant", content: "⚠️ Bağlantı hatası" }]);
    } finally {
      setStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const newChat = () => {
    setMessages([]);
    setInput("");
  };

  const saveCurrentChat = () => {
    if (!requireAuth()) return;
    if (messages.length === 0) return;
    const title = messages[0].content.slice(0, 40);
    const next = [{ id: crypto.randomUUID(), title, messages }, ...savedChats].slice(0, 30);
    setSavedChats(next);
    localStorage.setItem("kivanc-saved-chats", JSON.stringify(next));
  };

  const loadChat = (id: string) => {
    const c = savedChats.find((x) => x.id === id);
    if (c) setMessages(c.messages);
  };

  const toggleMic = () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };
    const SR = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SR) {
      alert("Tarayıcınız ses tanımayı desteklemiyor.");
      return;
    }
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }
    const rec = new SR();
    rec.lang = "tr-TR";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setInput((prev) => (prev ? prev + " " + t : t));
    };
    rec.onend = () => setRecording(false);
    rec.onerror = () => setRecording(false);
    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  };

  const initials = (profile?.display_name || user?.email || "U").slice(0, 1).toUpperCase();
  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Misafir";
  const ipAddress = "192.168.1.24";

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="flex min-h-screen">
        {/* Mini sidebar */}
        <aside className="hidden w-12 shrink-0 flex-col items-center justify-between border-r border-sidebar-border bg-sidebar py-5 md:flex">
          <div className="flex flex-col items-center gap-5">
            <button
              aria-label="Menüyü aç/kapa"
              onClick={() => setSidebarOpen((o) => !o)}
              className="text-muted-foreground transition hover:text-foreground"
            >
              <Menu size={18} />
            </button>
            <button
              aria-label="Yeni sohbet"
              onClick={newChat}
              title="Yeni sohbet"
              className="grid h-9 w-9 place-items-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground shadow-[var(--shadow-control)] transition hover:bg-accent"
            >
              <PenSquare size={17} />
            </button>
            <button
              aria-label="Kaydet"
              onClick={saveCurrentChat}
              title="Sohbeti kaydet"
              className="text-muted-foreground transition hover:text-foreground"
            >
              <Save size={18} />
            </button>
            <button
              aria-label="Hakkında"
              onClick={() => setAboutOpen(true)}
              title="Hakkında"
              className="text-muted-foreground transition hover:text-foreground"
            >
              <Info size={18} />
            </button>
          </div>
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Ayarlar"
              title="Ayarlar"
              className="grid h-9 w-9 place-items-center rounded-full border border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-[var(--shadow-control)] transition hover:bg-accent"
            >
              <Settings2 size={18} />
            </button>
            {user && (
              <button
                onClick={signOut}
                aria-label="Çıkış"
                title="Çıkış yap"
                className="text-muted-foreground transition hover:text-foreground"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </aside>

        {/* Geniş sidebar */}
        {sidebarOpen && (
          <aside className="hidden w-52 shrink-0 border-r border-sidebar-border bg-sidebar/95 px-4 py-5 md:flex md:flex-col lg:w-60">
            <div className="flex items-center gap-3">
              <h2 className="font-serif text-2xl font-bold leading-none text-foreground">
                Kıvanç AI
              </h2>
              <img
                src={logoImg}
                alt="Kıvanç AI"
                className="h-9 w-9 rounded-lg object-contain drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]"
              />
            </div>

            <button
              onClick={newChat}
              className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-secondary px-4 text-sm font-semibold text-secondary-foreground shadow-[var(--shadow-control)] transition hover:bg-accent"
            >
              <PenSquare size={15} /> Yeni Sohbet
            </button>

            {!user ? (
              <button
                onClick={() => navigate({ to: "/auth" })}
                className="mt-3 h-10 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                E-posta ile Giriş
              </button>
            ) : (
              <div className="mt-3 rounded-lg border border-border bg-card/60 p-3 text-xs">
                <p className="font-semibold text-foreground">{displayName}</p>
                <p className="truncate text-muted-foreground">{user.email}</p>
              </div>
            )}

            <div className="mt-5 flex-1 overflow-y-auto">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Kayıtlı Sohbetler
              </p>
              {savedChats.length === 0 ? (
                <p className="text-xs text-muted-foreground">Henüz kayıtlı sohbet yok.</p>
              ) : (
                <ul className="space-y-1">
                  {savedChats.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => loadChat(c.id)}
                        className="flex w-full items-center gap-2 truncate rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
                      >
                        <Bookmark size={12} className="shrink-0" />
                        <span className="truncate">{c.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-3 space-y-1">
              <button
                onClick={() => setSettingsOpen(true)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <Settings2 size={13} /> Ayarlar
              </button>
              <button
                onClick={() => setAboutOpen(true)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
              >
                <Info size={13} /> Hakkında
              </button>
            </div>
          </aside>
        )}

        {/* Main area */}
        <section className="relative flex min-w-0 flex-1 flex-col bg-[image:var(--gradient-stage)]">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 px-4 sm:px-7">
            <div className="flex items-center gap-3 md:hidden">
              <button onClick={() => setSidebarOpen((o) => !o)}>
                <Menu size={20} />
              </button>
              <img src={logoImg} alt="" className="h-7 w-7 rounded-md object-contain" />
              <p className="text-sm font-bold">Kıvanç AI</p>
            </div>
            <div className="hidden items-center gap-2 text-xs font-semibold text-muted-foreground md:flex">
              <img src={logoImg} alt="KıvançAI" className="h-6 w-6 rounded-full object-cover" />
              KıvançAI
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-2">
                  <span className="hidden text-sm font-medium text-foreground sm:inline">
                    {displayName}
                  </span>
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={displayName}
                      className="h-9 w-9 rounded-full border-2 border-brand object-cover shadow-[var(--shadow-avatar)]"
                    />
                  ) : (
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-[var(--shadow-avatar)]">
                      {initials}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => navigate({ to: "/auth" })}
                  className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-secondary-foreground transition hover:bg-accent"
                  aria-label="Giriş yap"
                  title="Giriş yap"
                >
                  <User size={16} />
                </button>
              )}
            </div>
          </header>

          {/* Messages area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            {messages.length === 0 ? (
              <div className="grid h-full place-items-center">
                <div className="w-full max-w-2xl text-left">
                  <h1 className="text-balance text-5xl font-extrabold leading-none tracking-normal text-brand sm:text-6xl lg:text-7xl">
                    Merhaba {user ? displayName : "Kıvanç"}
                  </h1>
                  <p className="mt-4 text-pretty text-2xl font-medium leading-tight text-foreground sm:text-3xl">
                    {user
                      ? "Sınır tanımayan AI ile ne yapmak istersin?"
                      : "Başlamak için bir e-posta ile kayıt ol."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-6">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {m.role === "assistant" && (
                      <img
                        src={logoImg}
                        alt="KıvançAI"
                        className="h-8 w-8 shrink-0 rounded-full border border-border object-cover"
                      />
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-foreground border border-border"
                      }`}
                    >
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {m.attachments.map((a, j) =>
                            a.kind === "image" ? (
                              <img
                                key={j}
                                src={a.url}
                                alt=""
                                className="max-h-48 rounded-lg object-cover"
                              />
                            ) : (
                              <video key={j} src={a.url} controls className="max-h-48 rounded-lg" />
                            ),
                          )}
                        </div>
                      )}
                      {m.generatedImage && (
                        <div className="mb-2">
                          <img
                            src={m.generatedImage}
                            alt="Oluşturulan görsel"
                            className="max-h-96 w-full rounded-lg object-contain"
                          />
                          <a
                            href={m.generatedImage}
                            download="kivanc-ai-gorsel.png"
                            className="mt-2 inline-block text-xs font-medium text-brand hover:underline"
                          >
                            ⬇ İndir
                          </a>
                        </div>
                      )}
                      {m.generatedVideo && (
                        <div className="mb-2">
                          <video
                            src={m.generatedVideo}
                            controls
                            className="max-h-96 w-full rounded-lg"
                          />
                          <a
                            href={m.generatedVideo}
                            download="kivanc-ai-video.mp4"
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-xs font-medium text-brand hover:underline"
                          >
                            ⬇ İndir
                          </a>
                        </div>
                      )}
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-muted prose-pre:text-foreground prose-code:text-brand">
                        <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
                {generatingImage && (
                  <div className="flex gap-3 justify-start">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                      <ImageIcon size={16} />
                    </div>
                    <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                      <Loader2 className="inline animate-spin" size={14} /> Görsel oluşturuluyor…
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="px-4 pb-6 pt-2 sm:px-8">
            <form
              onSubmit={handleSubmit}
              className="mx-auto max-w-3xl rounded-2xl border border-input bg-card/95 p-4 shadow-[var(--shadow-composer)] backdrop-blur-sm"
            >
              {pendingAttachments.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {pendingAttachments.map((a, i) => (
                    <div key={i} className="relative">
                      {a.kind === "image" ? (
                        <img src={a.url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                      ) : (
                        <video src={a.url} className="h-16 w-16 rounded-lg object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => setPendingAttachments((p) => p.filter((_, j) => j !== i))}
                        className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-destructive text-destructive-foreground"
                        aria-label="Kaldır"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                hidden
                onChange={handleFileSelect}
              />
              {quickPanel && quickPanel !== "settings" && (
                <div className="mb-3 rounded-xl border border-brand/40 bg-brand/5 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-brand">
                      {quickPanel === "image" ? "🎨 Görsel oluştur" : "🎬 Video oluştur (Kling AI)"}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickPanel(null);
                        setQuickPrompt("");
                      }}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Kapat"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <input
                    type="text"
                    autoFocus
                    value={quickPrompt}
                    onChange={(e) => setQuickPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && quickPrompt.trim()) {
                        e.preventDefault();
                        const p = quickPrompt.trim();
                        const panel = quickPanel;
                        const dur = videoDuration;
                        setQuickPanel(null);
                        setQuickPrompt("");
                        if (panel === "image") {
                          setMessages((m) => [...m, { role: "user", content: `🎨 ${p}` }]);
                          generateImage(p);
                        } else {
                          setMessages((m) => [
                            ...m,
                            { role: "user", content: `🎬 ${p} (${dur}sn)` },
                          ]);
                          generateVideo(p, dur);
                        }
                      }
                    }}
                    placeholder={
                      quickPanel === "image"
                        ? "Ne çizmek istiyorsun? (ör: gün batımında dağ)"
                        : "Nasıl bir video? (ör: sahilde koşan köpek)"
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-brand"
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {quickPanel === "video" ? (
                      <div className="flex items-center gap-1 rounded-md bg-background p-1">
                        <button
                          type="button"
                          onClick={() => setVideoDuration(5)}
                          className={`rounded px-2 py-1 text-xs font-medium transition ${videoDuration === 5 ? "bg-brand text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          5 sn
                        </button>
                        <button
                          type="button"
                          onClick={() => setVideoDuration(10)}
                          className={`rounded px-2 py-1 text-xs font-medium transition ${videoDuration === 10 ? "bg-brand text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          10 sn
                        </button>
                      </div>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      disabled={!quickPrompt.trim() || generatingImage || generatingVideo}
                      onClick={() => {
                        const p = quickPrompt.trim();
                        if (!p) return;
                        const panel = quickPanel;
                        const dur = videoDuration;
                        setQuickPanel(null);
                        setQuickPrompt("");
                        if (panel === "image") {
                          setMessages((m) => [...m, { role: "user", content: `🎨 ${p}` }]);
                          generateImage(p);
                        } else {
                          setMessages((m) => [
                            ...m,
                            { role: "user", content: `🎬 ${p} (${dur}sn)` },
                          ]);
                          generateVideo(p, dur);
                        }
                      }}
                      className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
                    >
                      Oluştur →
                    </button>
                  </div>
                </div>
              )}
              {quickPanel === "settings" && (
                <div className="mb-3 rounded-xl border border-border bg-background/80 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <KeyRound size={15} className="text-brand" /> Kişisel AI ayarları
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuickPanel(null)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Kapat"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <label className="mb-3 flex items-center justify-between gap-3 rounded-md bg-secondary px-3 py-2 text-xs text-secondary-foreground">
                    <span>Kendi API anahtarımı kullan</span>
                    <input
                      type="checkbox"
                      checked={customAiEnabled}
                      onChange={(e) => setCustomAiEnabled(e.target.checked)}
                      className="h-4 w-4 accent-brand"
                    />
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={customAiProvider}
                      onChange={(e) => changeCustomProvider(e.target.value as CustomAiProvider)}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-brand"
                    >
                      <option value="anthropic">Anthropic</option>
                      <option value="poe">Poe.com</option>
                    </select>
                    <select
                      value={customAiModel}
                      onChange={(e) => setCustomAiModel(e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-brand"
                    >
                      {CUSTOM_AI_MODELS[customAiProvider].map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="password"
                    value={customAiKey}
                    onChange={(e) => setCustomAiKey(e.target.value)}
                    placeholder={
                      customAiProvider === "anthropic" ? "Anthropic API key" : "Poe API key"
                    }
                    className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-brand"
                  />
                  {customAiProvider === "poe" && (
                    <input
                      type="url"
                      value={customAiEndpoint}
                      onChange={(e) => setCustomAiEndpoint(e.target.value)}
                      placeholder="Poe uyumlu API endpoint"
                      className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-brand"
                    />
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Anahtar sadece bu tarayıcı oturumunda tutulur; mesajlar uygulama sunucusu
                    üzerinden modele iletilir.
                  </p>
                </div>
              )}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  user
                    ? "Bir şey sor… (görsel için: 'görsel oluştur: dağ manzarası')"
                    : "Mesaj göndermek için giriş yap…"
                }
                className="h-9 w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="relative flex items-center gap-3 text-muted-foreground">
                  {/* Plus / Model picker */}
                  <button
                    type="button"
                    onClick={() => {
                      setQuickPanel(null);
                      setModelMenuOpen((o) => !o);
                    }}
                    aria-label="Model seç"
                    title="AI modeli seç"
                    className="grid h-8 w-8 place-items-center rounded-md transition hover:bg-accent hover:text-foreground"
                  >
                    <Plus size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Dosya ekle"
                    title="Görsel veya video yükle (video maks 11 sn)"
                    className="grid h-8 w-8 place-items-center rounded-md transition hover:bg-accent hover:text-foreground"
                  >
                    <Paperclip size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openQuickPanel("image");
                    }}
                    aria-label="Görsel oluştur"
                    title="Görsel oluştur"
                    className={`grid h-8 w-8 place-items-center rounded-md transition hover:bg-accent hover:text-foreground ${quickPanel === "image" ? "bg-accent text-foreground" : ""}`}
                  >
                    <ImageIcon size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openQuickPanel("video");
                    }}
                    aria-label="Video oluştur"
                    title="Video oluştur (Kling AI)"
                    className={`grid h-8 w-8 place-items-center rounded-md transition hover:bg-accent hover:text-foreground ${quickPanel === "video" ? "bg-accent text-foreground" : ""}`}
                  >
                    <Film size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openQuickPanel("settings")}
                    aria-label="Kişisel AI ayarları"
                    title="Poe/Anthropic API ayarları"
                    className={`grid h-8 w-8 place-items-center rounded-md transition hover:bg-accent hover:text-foreground ${quickPanel === "settings" ? "bg-accent text-foreground" : ""}`}
                  >
                    <Settings2 size={18} />
                  </button>

                  {modelMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setModelMenuOpen(false)} />
                      <div className="absolute bottom-12 left-0 z-50 max-h-80 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-2xl">
                        <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          AI Modelleri ({MODELS.length})
                        </p>
                        {MODELS.map((m, idx) => (
                          <button
                            key={`${m.label}-${idx}`}
                            type="button"
                            disabled={!m.available}
                            onClick={() => {
                              if (m.available) {
                                setModelKey(m.label);
                                setModelMenuOpen(false);
                              }
                            }}
                            className={`group relative flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left text-sm transition ${
                              modelKey === m.label
                                ? "bg-brand/15 text-brand"
                                : "text-foreground hover:bg-accent"
                            } ${!m.available ? "cursor-not-allowed opacity-50" : ""}`}
                            title={m.description}
                          >
                            <div className="flex w-full items-center justify-between">
                              <span className="font-medium">{m.label}</span>
                              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {m.provider}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">{m.description}</span>
                            {!m.available && (
                              <span className="mt-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                YAKINDA
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      sendMessage("Bana yardımcı olabileceğin tüm konuları kısaca anlat.")
                    }
                    className="hidden items-center gap-2 text-sm font-medium transition hover:text-foreground sm:inline-flex"
                  >
                    <span className="text-lg font-semibold">A</span>
                    <span>Araçlar</span>
                  </button>
                </div>

                <div className="flex items-center gap-3 text-muted-foreground">
                  <button
                    type="button"
                    onClick={saveCurrentChat}
                    title="Bu sohbeti kaydet"
                    className="inline-flex items-center gap-2 text-sm font-medium transition hover:text-foreground"
                  >
                    <Save size={16} />
                    <span className="hidden sm:inline">Kaydet</span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleMic}
                    aria-label="Mikrofon"
                    title="Sesli giriş"
                    className={`transition ${recording ? "text-destructive animate-pulse" : "hover:text-foreground"}`}
                  >
                    <Mic size={18} />
                  </button>
                  <button
                    type="submit"
                    disabled={streaming || !input.trim()}
                    aria-label="Gönder"
                    className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </form>

            {messages.length === 0 && (
              <div className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-2 sm:justify-start">
                {promptActions.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.label}
                      type="button"
                      onClick={() => {
                        if (a.prompt.endsWith(": ") || a.prompt.endsWith(" ")) {
                          setInput(a.prompt);
                        } else {
                          sendMessage(a.prompt);
                        }
                      }}
                      className="inline-flex h-10 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-[var(--shadow-control)] transition hover:bg-accent"
                    >
                      <Icon size={15} className="text-brand" />
                      {a.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Settings modal */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-background/70 px-3 pb-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <img src={logoImg} alt="KıvançAI" className="h-10 w-10 rounded-full object-cover" />
                <div>
                  <h3 className="text-base font-bold text-popover-foreground">Ayarlar</h3>
                  <p className="text-xs text-muted-foreground">KıvançAI kontrol merkezi</p>
                </div>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
                aria-label="Ayarları kapat"
              >
                <X size={17} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-2">
              {SETTINGS_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-accent"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-brand">
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-popover-foreground">
                        {item.label}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.detail}
                      </span>
                    </span>
                  </button>
                );
              })}
              <div className="mx-3 my-2 border-t border-border" />
              <div className="mx-3 mb-3 flex items-center gap-3 rounded-xl bg-secondary px-3 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-background text-brand">
                  <Shield size={17} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-secondary-foreground">IP adresiniz</p>
                  <p className="truncate text-xs text-muted-foreground">{ipAddress}</p>
                </div>
              </div>
              {user && (
                <button
                  type="button"
                  onClick={signOut}
                  className="mx-3 mb-3 flex w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-xl bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground transition hover:opacity-90"
                >
                  <LogOut size={16} /> Çıkış yap
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* About modal */}
      {aboutOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4"
          onClick={() => setAboutOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setAboutOpen(false)}
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3">
              <img src={logoImg} alt="" className="h-9 w-9 rounded-lg object-contain" />
              <h3 className="font-serif text-xl font-bold">Kıvanç AI Hakkında</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Sınırsız kodlama ve yaratıcılık asistanı. Sohbet, görsel üretimi, video alanı ve
              kişisel AI bağlantıları için hazırlanmış sade KıvançAI deneyimi.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">v1.0 — © Kıvanç</p>
          </div>
        </div>
      )}
    </main>
  );
}
