import ReactMarkdown from "react-markdown";
import HerbCard from "./HerbCard";
import "./ChatMessage.css";

export default function ChatMessage({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`chat-message ${isUser ? "chat-message--user" : "chat-message--assistant"}`}>
      {isUser ? (
        <p className="chat-message-user-text">{message.content}</p>
      ) : (
        <div className="chat-message-body">
          <div className="chat-message-markdown">
            <ReactMarkdown>{message.content}</ReactMarkdown>
            {message.streaming && <span className="chat-cursor" aria-hidden="true" />}
          </div>
          {message.herbs && message.herbs.length > 0 && (
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
