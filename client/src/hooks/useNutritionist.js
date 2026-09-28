import { useCallback, useEffect, useRef, useState } from "react";
import { streamNutritionist } from "../api/nutritionist";

export function useNutritionist() {
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  // In-flight request. Aborting it cancels the fetch, and the closed
  // connection stops the server-side agent loop.
  const controllerRef = useRef(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const send = useCallback(
    async (text) => {
      if (streaming) return;
      setError(null);
      const controller = new AbortController();
      controllerRef.current = controller;
      // Buffers accumulated during this stream — flushed all at once on done.
      // Local to this send so an aborted stream can never write into a newer one.
      let content = "";
      let herbs = null;
      // Whether we've already flipped the streaming message into the
      // "composing" phase so we don't setState on every text delta.
      let composed = false;

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

      const finish = () =>
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content,
              herbs,
              streaming: false,
            };
          }
          return next;
        });

      await streamNutritionist(
        apiMessages,
        {
          onTextDelta: (delta) => {
            content += delta;
            if (!composed) {
              composed = true;
              setPhase("composing");
            }
          },
          onHerbResults: (results) => {
            herbs = results;
          },
          onToolUse: (event) => {
            if (event?.name === "herb_search") setPhase("searching");
            else if (event?.name === "web_search") setPhase("researching");
          },
          onDone: () => {
            finish();
            setStreaming(false);
          },
          onError: (err) => {
            finish();
            setError(err);
            setStreaming(false);
          },
        },
        { signal: controller.signal }
      );

      if (controllerRef.current === controller) controllerRef.current = null;
    },
    [streaming, messages]
  );

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setMessages([]);
    setStreaming(false);
    setError(null);
  }, []);

  return { messages, streaming, error, send, reset };
}
