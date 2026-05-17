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
  // Tracks whether we've already flipped the streaming message into the
  // "composing" phase so we don't setState on every text delta.
  const composedRef = useRef(false);

  const send = useCallback(
    async (text) => {
      if (streaming) return;
      setError(null);
      abortRef.current = false;
      contentBuf.current = "";
      herbsBuf.current = null;
      composedRef.current = false;

      const apiMessages = [
        ...messages
          .filter((m) => m.role === "user" || m.content.length > 0)
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: text },
      ];

      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        {
          role: "assistant",
          content: "",
          herbs: null,
          streaming: true,
          phase: "thinking",
        },
      ]);
      setStreaming(true);

      const setPhase = (phase) =>
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant" && last.streaming && last.phase !== phase) {
            next[next.length - 1] = { ...last, phase };
          }
          return next;
        });

      await streamNutritionist(apiMessages, {
        onTextDelta: (delta) => {
          if (abortRef.current) return;
          contentBuf.current += delta;
          if (!composedRef.current) {
            composedRef.current = true;
            setPhase("composing");
          }
        },
        onHerbResults: (herbs) => {
          if (abortRef.current) return;
          herbsBuf.current = herbs;
        },
        onToolUse: (event) => {
          if (abortRef.current) return;
          if (event?.name === "herb_search") setPhase("searching");
          else if (event?.name === "web_search") setPhase("researching");
        },
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
