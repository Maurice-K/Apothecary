import { useEffect, useRef } from "react";
import ChatMessage from "./ChatMessage";
import "./Chat.css";

export default function Chat({ messages }) {
  const bottomRef = useRef(null);
  const listRef = useRef(null);

  // Smooth scroll when a new message is added
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Instant scroll as content grows (typewriter, herb cards appearing)
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="chat-list" ref={listRef}>
      {messages.map((msg, i) => (
        <ChatMessage key={i} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
