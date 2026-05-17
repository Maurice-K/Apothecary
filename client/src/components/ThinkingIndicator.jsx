import { useEffect, useState } from "react";
import "./ThinkingIndicator.css";

const PHRASES = {
  thinking: [
    "Pondering",
    "Considering the question",
    "Consulting the herbalist",
    "Listening carefully",
  ],
  searching: [
    "Searching the apothecary",
    "Browsing the catalog",
    "Picking herbs from the shelf",
    "Looking through the jars",
  ],
  researching: [
    "Researching the herb",
    "Cross-referencing studies",
    "Reading the literature",
    "Checking traditional sources",
  ],
  composing: [
    "Synthesizing findings",
    "Writing up the recommendations",
    "Putting it together",
  ],
};

const PHRASE_INTERVAL_MS = 2200;
const FADE_MS = 220;

export default function ThinkingIndicator({ phase }) {
  const phrases = PHRASES[phase] ?? PHRASES.thinking;
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  // Reset to the first phrase whenever the phase changes so the user
  // immediately sees a phrase that matches what's happening.
  useEffect(() => {
    setIdx(0);
    setVisible(true);
  }, [phase]);

  useEffect(() => {
    if (phrases.length < 2) return;
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % phrases.length);
        setVisible(true);
      }, FADE_MS);
    }, PHRASE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phrases]);

  return (
    <span
      className={`chat-thinking ${visible ? "is-visible" : "is-fading"}`}
      aria-live="polite"
    >
      {phrases[idx]}
      <span className="chat-thinking-dot">.</span>
      <span className="chat-thinking-dot">.</span>
      <span className="chat-thinking-dot">.</span>
    </span>
  );
}
