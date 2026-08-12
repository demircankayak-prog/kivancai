// İstemci bağlantıyı kestiğinde yukarı akıştan gelen AbortError sunucuyu
// çökertmesin diye güvenli aktarım katmanı.
const isAbort = (e: unknown) =>
  !!e &&
  (((e as { name?: string }).name === "AbortError") ||
    /aborted/i.test(String((e as { message?: string })?.message ?? "")));

// Kullanıcı yanıtı/sesi durdurunca (bağlantı kapanınca) oluşan AbortError
// dev sunucusunda "runtime error" olarak görünmesin.
declare const process: { on?: (ev: string, cb: (e: unknown) => void) => void } | undefined;
let installed = false;
export const ignoreAbortErrors = () => {
  if (installed) return;
  installed = true;
  try {
    if (typeof process !== "undefined" && process?.on) {
      process.on("unhandledRejection", (reason: unknown) => {
        if (!isAbort(reason)) console.error("unhandledRejection:", reason);
      });
      process.on("uncaughtException", (err: unknown) => {
        if (!isAbort(err)) console.error("uncaughtException:", err);
      });
    }
  } catch {
    /* yoksay */
  }
};

export const safeStream = (body: ReadableStream<Uint8Array>) =>
  new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch {
        try {
          controller.close();
        } catch {
          /* zaten kapalı */
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* yoksay */
        }
      }
    },
    cancel() {
      try {
        void body.cancel();
      } catch {
        /* yoksay */
      }
    },
  });
