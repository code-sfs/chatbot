import AiMascot from "./AiMascot";

export default function ThinkingIndicator() {
  return (
    <div
      className="thinking-indicator"
      aria-live="polite"
      aria-label="SchoolsOS AI is thinking"
    >
      <span className="thinking-text">
        SchoolsOS AI is thinking
        <span className="thinking-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </span>
      <span className="thinking-mascot-run" aria-hidden="true">
        <span className="thinking-mascot-runner">
          <AiMascot size={28} animate={false} showAura={false} />
        </span>
      </span>
    </div>
  );
}
