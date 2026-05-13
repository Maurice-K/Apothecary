import { useEffect } from "react";
import { useNutritionist } from "../hooks/useNutritionist";
import Chat from "../components/Chat";
import ChatInput from "../components/ChatInput";
import "./Nutritionist.css";

const STARTER_PROMPTS = [
  "How do I get better sleep?",
  "What helps with low iron?",
  "How can I reduce stress naturally?",
  "Help with digestion after meals",
  "Boost immunity for winter",
];

export default function NutritionistPage() {
  const { messages, streaming, error, send, reset } = useNutritionist();
  const hasMessages = messages.length > 0;

  useEffect(() => {
    document.querySelector(".chat-input-textarea")?.focus();
  }, []);

  return (
    <div className="nutritionist-page">
      <div className="nutritionist-page-header">
        <div className="nutritionist-page-header-text">
          <h2 className="nutritionist-title">Ask the Nutritionist</h2>
          <p className="nutritionist-subtitle">
            Herbal wellness guidance, grounded in the catalog
          </p>
        </div>
        {hasMessages && (
          <button className="nutritionist-reset-btn" onClick={reset}>
            New chat
          </button>
        )}
      </div>

      {hasMessages ? (
        <Chat messages={messages} streaming={streaming} />
      ) : (
        <div className="nutritionist-empty">
          <p className="nutritionist-empty-text">
            What would you like help with today?
          </p>
          <div className="nutritionist-chips">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                className="nutritionist-chip"
                onClick={() => send(prompt)}
                disabled={streaming}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      <ChatInput onSend={send} disabled={streaming} error={error} />
    </div>
  );
}
