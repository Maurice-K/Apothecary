import { useCallback, useRef, useState } from "react";
import { streamNutritionist } from "../api/nutritionist";

export function useNutritionist() {
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(false);
  // Buffers accumulated during a stream — flushed all at once on done
  const contentBuf = useRef("");
  const herbsBuf = useRef(null);

  const send = useCallback(
    async (text) => {
      if (streaming) return;
      setError(null);
      abortRef.current = false;
      contentBuf.current = "";
      herbsBuf.current = null;

      const apiMessages = [
        ...messages
          .filter((m) => m.role === "user" || m.content.length > 0)
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: text },
      ];

      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: "", herbs: null, streaming: true },
      ]);
      setStreaming(true);

      await streamNutritionist(apiMessages, {
        onTextDelta: (delta) => {
          if (abortRef.current) return;
          contentBuf.current += delta;
        },
        onHerbResults: (herbs) => {
          if (abortRef.current) return;
          herbsBuf.current = herbs;
        },
        onToolUse: () => {},
        onDone: () => {
          if (abortRef.current) return;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") {
              next[next.length - 1] = {
                ...last,
                content: contentBuf.current,
                herbs: herbsBuf.current,
                streaming: false,
              };
            }
            return next;
          });
          setStreaming(false);
        },
        onError: (err) => {
          if (abortRef.current) return;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") {
              next[next.length - 1] = {
                ...last,
                content: contentBuf.current,
                herbs: herbsBuf.current,
                streaming: false,
              };
            }
            return next;
          });
          setError(err);
          setStreaming(false);
        },
      });
    },
    [streaming, messages]
  );

  const reset = useCallback(() => {
    abortRef.current = true;
    setMessages([]);
    setStreaming(false);
    setError(null);
  }, []);

  return { messages, streaming, error, send, reset };
}
