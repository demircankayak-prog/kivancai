// İstemci bağlantıyı kestiğinde yukarı akıştan gelen AbortError sunucuyu
// çökertmesin diye güvenli aktarım katmanı.
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
