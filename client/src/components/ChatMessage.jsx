import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import HerbCard from "./HerbCard";
import "./ChatMessage.css";

const CHUNK_SIZE = 4;  // chars per tick
const TICK_MS = 8;     // ms per tick → ~500 chars/sec

export default function ChatMessage({ message }) {
  const isUser = message.role === "user";
  const [displayed, setDisplayed] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const hasAnimated = useRef(false);
  const indexRef = useRef(0);

  useEffect(() => {
    if (message.streaming || !message.content || hasAnimated.current) return;
    hasAnimated.current = true;
    indexRef.current = 0;
    setDisplayed("");
    setIsTyping(true);

    const full = message.content;
    const id = setInterval(() => {
      indexRef.current += CHUNK_SIZE;
      if (indexRef.current >= full.length) {
        setDisplayed(full);
        setIsTyping(false);
        clearInterval(id);
      } else {
        setDisplayed(full.slice(0, indexRef.current));
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [message.streaming, message.content]);

  return (
    <div className={`chat-message ${isUser ? "chat-message--user" : "chat-message--assistant"}`}>
      {isUser ? (
        <p className="chat-message-user-text">{message.content}</p>
      ) : (
        <div className="chat-message-body">
          <div className="chat-message-markdown">
            {message.streaming && !message.content ? (
              <span className="chat-ellipsis" aria-label="Thinking">
                <span /><span /><span />
              </span>
            ) : (
              <ReactMarkdown>{displayed || message.content}</ReactMarkdown>
            )}
          </div>
          {!isTyping && message.herbs && message.herbs.length > 0 && (
            <div className="chat-herb-row">
              {message.herbs.map((herb) => (
                <HerbCard key={herb.id} herb={herb} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
