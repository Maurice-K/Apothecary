import { CORS_HEADERS, getAllowedOrigin } from "./cors.ts";

export interface SseStream {
  readable: ReadableStream<Uint8Array>;
  // Aborts when the client disconnects, so upstream work can stop early.
  signal: AbortSignal;
  send(event: string, data: unknown): void;
  close(): void;
}

export function sseHeaders(req: Request): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": getAllowedOrigin(req),
    ...CORS_HEADERS,
  };
}

export function createSseStream(): SseStream {
  const encoder = new TextEncoder();
  const disconnect = new AbortController();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const readable = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      controller = null;
      disconnect.abort();
    },
  });

  return {
    readable,
    signal: disconnect.signal,
    send(event, data) {
      if (!controller) return;
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      try {
        controller.enqueue(encoder.encode(payload));
      } catch {
        // Stream already closed by the client.
      }
    },
    close() {
      if (!controller) return;
      try {
        controller.close();
      } catch {
        // Already closed.
      }
      controller = null;
    },
  };
}
