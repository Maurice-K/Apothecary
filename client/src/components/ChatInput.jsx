import { useEffect, useRef, useState } from "react";
import "./ChatInput.css";

export default function ChatInput({ onSend, disabled, error }) {
  const [text, setText] = useState("");
  const [countdown, setCountdown] = useState(0);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (error?.type === "rate_limit") {
      setCountdown(error.retry_after_seconds ?? 60);
    }
  }, [error]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || isDisabled) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isDisabled = disabled || countdown > 0;

  return (
    <div className="chat-input-wrapper">
      {error && error.type !== "rate_limit" && (
        <p className="chat-input-error" role="alert">
          {error.message ?? "Something went wrong. Please try again."}
        </p>
      )}
      {countdown > 0 && (
        <p className="chat-input-rate-limit" role="status">
          Too many requests — please wait {countdown}s
        </p>
      )}
      <div className="chat-input-row">
        <textarea
          ref={textareaRef}
          className="chat-input-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about herbs and wellness…"
          rows={1}
          disabled={isDisabled}
          aria-label="Message input"
        />
        <button
          className="chat-input-send"
          onClick={handleSubmit}
          disabled={isDisabled || !text.trim()}
          aria-label="Send message"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
