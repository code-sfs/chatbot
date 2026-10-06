import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { FiChevronRight, FiMic, FiMessageCircle } from "react-icons/fi";
import AiMascot from "./AiMascot";
import { QUICK_ACTIONS } from "../chatbotData";
import type { ChatbotScreen } from "../chatbotData";
import { getSuggestedPrompts } from "../../utils/resolvePersona";
import { formatDisplayName } from "./formatDisplayName";

const HOP_THEN_RUN_MS = 1050;
const VISIBLE_PROMPT_COUNT = 6;

interface HomeViewProps {
  userName?: string | null;
  roles: string;
  onNavigate: (screen: ChatbotScreen) => void;
  onSelectPrompt: (prompt: string) => void;
}

const actionIcon = (icon: "mic" | "chat") =>
  icon === "mic" ? <FiMic size={18} /> : <FiMessageCircle size={18} />;

export default function HomeView({
  userName,
  roles,
  onNavigate,
  onSelectPrompt,
}: HomeViewProps) {
  const displayName = formatDisplayName(userName);
  const suggestedPrompts = getSuggestedPrompts(roles);
  const [departing, setDeparting] = useState(false);
  const [showAllPrompts, setShowAllPrompts] = useState(false);
  const leavingRef = useRef(false);
  const visiblePrompts = showAllPrompts
    ? suggestedPrompts
    : suggestedPrompts.slice(0, VISIBLE_PROMPT_COUNT);
  const hiddenPromptCount = Math.max(
    0,
    suggestedPrompts.length - VISIBLE_PROMPT_COUNT,
  );

  const handlePromptClick = (prompt: string) => {
    if (leavingRef.current) return;
    leavingRef.current = true;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      onSelectPrompt(prompt);
      return;
    }

    setDeparting(true);
    window.setTimeout(() => onSelectPrompt(prompt), HOP_THEN_RUN_MS);
  };

  return (
    <div className={`chatbot-screen home-view${departing ? " home-view--depart" : ""}`}>
      <motion.div
        className="home-header"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="home-greeting">
          {displayName ? `Hi ${displayName},` : "Hi, I'm SchoolsOS AI"}
        </h1>
        <p className="home-subtitle">
          Ask any questions you have — your SchoolsOS AI buddy is always ready to
          help.
        </p>
      </motion.div>

      <div
        className={`home-mascot-wrap${departing ? " home-mascot-wrap--depart" : ""}`}
      >
        <AiMascot size={108} animate={!departing} floatDistance={4} />
      </div>

      <div className="home-prompts-section">
        <p className="home-section-label">Try asking</p>
        <div className="suggested-prompts-scroll">
          {visiblePrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="suggested-prompt-chip"
              onClick={() => handlePromptClick(prompt)}
              disabled={departing}
            >
              <FiMessageCircle
                className="home-prompt-icon"
                size={15}
                aria-hidden
              />
              <span className="home-prompt-text">{prompt}</span>
              <FiChevronRight
                className="home-prompt-chevron"
                size={15}
                aria-hidden
              />
            </button>
          ))}
          {hiddenPromptCount > 0 ? (
            <button
              type="button"
              className="home-prompts-more"
              onClick={() => setShowAllPrompts((open) => !open)}
              disabled={departing}
            >
              {showAllPrompts ? "Show less" : `More (${hiddenPromptCount})`}
            </button>
          ) : null}
        </div>
      </div>

      <div className="home-bottom-stack">
        <div className="quick-action-grid">
          {QUICK_ACTIONS.map((action, index) => (
            <motion.button
              key={action.id}
              type="button"
              className="quick-action-card"
              onClick={() => onNavigate(action.screen)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * index, duration: 0.3 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="quick-action-icon">{actionIcon(action.icon)}</span>
              <span className="quick-action-label">{action.label}</span>
              <span className="quick-action-desc">{action.description}</span>
            </motion.button>
          ))}
        </div>


      </div>
    </div>
  );
}
