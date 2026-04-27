import { createFileRoute } from "@tanstack/react-router";
import {
  FileText,
  Lightbulb,
  Menu,
  Mic,
  Palette,
  Paperclip,
  PenSquare,
  Plus,
  Search,
  Send,
  Sparkles,
  User,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

const promptActions = [
  { label: "Proje Başlat", icon: FileText },
  { label: "Tasarım Yap", icon: Palette },
  { label: "Araştırma Yap", icon: Search },
  { label: "Fikir Geliştir", icon: Lightbulb },
];

function Index() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden w-12 shrink-0 flex-col items-center justify-between border-r border-sidebar-border bg-sidebar py-5 md:flex">
          <div className="flex flex-col items-center gap-7">
            <button aria-label="Menüyü aç" className="text-muted-foreground transition hover:text-foreground">
              <Menu size={18} />
            </button>
            <button
              aria-label="Yeni sohbet oluştur"
              className="grid h-9 w-9 place-items-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground shadow-[var(--shadow-control)] transition hover:bg-accent"
            >
              <PenSquare size={17} />
            </button>
          </div>
          <button aria-label="Ayarlar" className="text-muted-foreground transition hover:text-foreground">
            <Sparkles size={18} />
          </button>
        </aside>

        <aside className="hidden w-52 shrink-0 border-r border-sidebar-border bg-sidebar/95 px-4 py-5 md:block lg:w-60">
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-2xl font-bold leading-none text-foreground">Kıvanç Yapay Zeka</h2>
            <Sparkles className="h-7 w-7 text-brand" aria-hidden="true" />
          </div>
          <button className="mt-8 h-10 w-full rounded-lg bg-secondary px-4 text-sm font-semibold text-secondary-foreground shadow-[var(--shadow-control)] transition hover:bg-accent">
            E-posta Gir
          </button>
        </aside>

        <section className="relative flex min-w-0 flex-1 flex-col bg-[image:var(--gradient-stage)]">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 px-4 sm:px-7">
            <div className="flex items-center gap-3 md:hidden">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">Kıvanç AI</p>
                <p className="text-xs text-muted-foreground">ChatGPT 5.2</p>
              </div>
            </div>
            <div className="hidden md:block" />
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="hidden sm:inline">Kıvaniy plus planına yükseltin</span>
              <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-[var(--shadow-avatar)]">
                <User size={15} />
              </div>
            </div>
          </header>

          <div className="relative flex flex-1 items-center justify-center px-4 pb-20 pt-10 sm:px-8 md:pb-28">
            <Sparkles className="pointer-events-none absolute bottom-10 right-8 h-14 w-14 text-muted-foreground/45 md:h-20 md:w-20" aria-hidden="true" />

            <div className="w-full max-w-2xl -translate-y-4 text-left sm:-translate-y-8">
              <h1 className="text-balance text-5xl font-extrabold leading-none tracking-normal text-brand sm:text-6xl lg:text-7xl">
                Merhaba Kıvanç
              </h1>
              <p className="mt-4 text-pretty text-2xl font-medium leading-tight text-foreground sm:text-3xl">
                Sizin için özel bir plan. Lütfen e-postanızı girin.
              </p>

              <form className="mt-6 rounded-2xl border border-input bg-card/90 p-4 shadow-[var(--shadow-composer)] backdrop-blur-sm">
                <label htmlFor="email" className="sr-only">
                  E-posta adresiniz
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="E-posta adresinizi girin..."
                  className="h-9 w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <button type="button" aria-label="Ekle" className="transition hover:text-foreground">
                      <Plus size={20} />
                    </button>
                    <button type="button" className="inline-flex items-center gap-2 text-sm font-medium transition hover:text-foreground">
                      <span className="text-lg font-semibold">A</span>
                      <span>Tools</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <button type="button" className="inline-flex items-center gap-2 text-sm font-medium transition hover:text-foreground">
                      <Paperclip size={16} />
                      <span>Kaydet</span>
                    </button>
                    <button type="button" aria-label="Mikrofon" className="transition hover:text-foreground">
                      <Mic size={18} />
                    </button>
                    <button type="submit" aria-label="Gönder" className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 sm:hidden">
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </form>

              <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start sm:pl-7">
                {promptActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      className="inline-flex h-11 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-[var(--shadow-control)] transition hover:bg-accent"
                    >
                      <Icon size={17} className="text-brand" />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
