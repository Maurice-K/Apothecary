import { useCallback, useRef, useState } from "react";
import { streamNutritionist } from "../api/nutritionist";

export function useNutritionist() {
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  // Used to ignore callbacks from a stream that was superseded by reset()
  const abortRef = useRef(false);

  const send = useCallback(
    async (text) => {
      if (streaming) return;
      setError(null);
      abortRef.current = false;

      // Snapshot the API-safe message list before updating state
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
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") {
              next[next.length - 1] = { ...last, content: last.content + delta };
            }
            return next;
          });
        },
        onHerbResults: (herbs) => {
          if (abortRef.current) return;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") {
              next[next.length - 1] = { ...last, herbs };
            }
            return next;
          });
        },
        onToolUse: () => {},
        onDone: () => {
          if (abortRef.current) return;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") {
              next[next.length - 1] = { ...last, streaming: false };
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
              next[next.length - 1] = { ...last, streaming: false };
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
