import { createFileRoute } from "@tanstack/react-router";

export type SearchSource = {
  title: string;
  url: string;
  site: string;
  snippet?: string;
};

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "web";
  }
};

// DuckDuckGo (duck.ai altyapısı) — ücretsiz, anahtarsız canlı internet
const duck = async (q: string): Promise<SearchSource[]> => {
  try {
    const r = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
      },
    });
    if (!r.ok) return [];
    const html = await r.text();
    const out: SearchSource[] = [];
    const linkRe = /<a[^>]+href="([^"]*uddg=[^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) && out.length < 8) {
      const raw = decodeEntities(m[1]);
      const uddg = /uddg=([^&]+)/.exec(raw)?.[1];
      if (!uddg) continue;
      let url: string;
      try {
        url = decodeURIComponent(uddg);
      } catch {
        continue;
      }
      const title = stripTags(m[2]);
      if (!title || out.some((o) => o.url === url)) continue;
      out.push({ title: title.slice(0, 120), url, site: hostOf(url) });
    }
    // snippet'leri eşleştir
    const snippets = [...html.matchAll(/class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g)].map((s) =>
      stripTags(s[1]).slice(0, 320),
    );
    out.forEach((o, i) => {
      if (snippets[i]) o.snippet = snippets[i];
    });
    return out;
  } catch {
    return [];
  }
};

const wiki = async (q: string): Promise<SearchSource[]> => {
  try {
    const r = await fetch(
      `https://tr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        q,
      )}&format=json&srlimit=3&origin=*`,
    );
    if (!r.ok) return [];
    const d = (await r.json()) as {
      query?: { search?: { title: string; snippet: string }[] };
    };
    return (d.query?.search || []).map((s) => ({
      title: s.title,
      url: `https://tr.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, "_"))}`,
      site: "tr.wikipedia.org",
      snippet: stripTags(s.snippet),
    }));
  } catch {
    return [];
  }
};

const youtube = async (q: string): Promise<SearchSource[]> => {
  try {
    const r = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        "Accept-Language": "tr-TR,tr;q=0.9",
      },
    });
    if (!r.ok) return [];
    const html = await r.text();
    const out: SearchSource[] = [];
    const re = /"videoId":"([\w-]{11})","thumbnail".*?"text":"([^"]{3,110})"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && out.length < 3) {
      const url = `https://www.youtube.com/watch?v=${m[1]}`;
      if (out.some((o) => o.url === url)) continue;
      out.push({ title: decodeEntities(m[2]), url, site: "youtube.com" });
    }
    return out;
  } catch {
    return [];
  }
};

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { q } = (await request.json()) as { q?: string };
          const query = (q || "").trim().slice(0, 200);
          if (!query) return Response.json({ sources: [], context: "" });

          const [d, w, y] = await Promise.all([duck(query), wiki(query), youtube(query)]);
          const seen = new Set<string>();
          const sources = [...w, ...d, ...y].filter((s) => {
            if (seen.has(s.url)) return false;
            seen.add(s.url);
            return true;
          }).slice(0, 12);

          const context = sources
            .filter((s) => s.snippet)
            .slice(0, 8)
            .map((s, i) => `[${i + 1}] ${s.title} (${s.site})\n${s.snippet}`)
            .join("\n\n");

          return Response.json(
            { sources, context },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch {
          return Response.json({ sources: [], context: "" });
        }
      },
    },
  },
});
