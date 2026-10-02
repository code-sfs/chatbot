import { Children, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { stripRecordCountLine } from "../utils/stripRecordCountLine";
import { statusTone } from "./utils/statusPill";

interface MemoizedAnswerProps {
  answer: string;
  messageIdx: number;
  onOpenPreview?: (url: string, filename: string) => void;
}

const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif)(?:[?#].*)?$/i;
const PDF_EXT_RE = /\.pdf(?:[?#].*)?$/i;
const EDU_FILE_URL_RE = /api\.eduacademics\.com\/v1\/files\//i;

const isPreviewableFileLink = (url: string): boolean =>
  IMAGE_EXT_RE.test(url) || PDF_EXT_RE.test(url) || EDU_FILE_URL_RE.test(url);

const pickFilenameFromUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    const fromPath = parsed.pathname.split("/").filter(Boolean).pop();
    return fromPath || "Attachment";
  } catch {
    return "Attachment";
  }
};

/**
 * Memoized markdown answer to prevent unnecessary re-renders.
 */
const MemoizedAnswer = memo(
  ({ answer, messageIdx, onOpenPreview }: MemoizedAnswerProps) => {
    const openPreview = (url: string, filename: string) => {
      if (onOpenPreview) {
        onOpenPreview(url, filename);
      }
    };

    const displayAnswer = stripRecordCountLine(answer);
    if (!displayAnswer) {
      return null;
    }

    return (
      <div
        key={`answer-${messageIdx}-${displayAnswer.slice(0, 20)}`}
        className="markdown-content"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            table: ({ node, ...props }) => (
              <div className="markdown-table-container">
                <table {...props} />
              </div>
            ),
            td: ({ node, children, ...props }) => {
              const text = Children.toArray(children)
                .map((child) =>
                  typeof child === "string" || typeof child === "number"
                    ? String(child)
                    : "",
                )
                .join("")
                .trim();
              const tone = text ? statusTone(text) : null;
              if (!tone) {
                return <td {...props}>{children}</td>;
              }
              return (
                <td {...props}>
                  <span className={`status-pill status-pill--${tone}`}>
                    {text}
                  </span>
                </td>
              );
            },
            ol: ({ node, ...props }) => (
              <ol
                style={{
                  listStyle: "decimal",
                  paddingLeft: "1.5em",
                  margin: "0.25em 0",
                }}
                {...props}
              />
            ),
            ul: ({ node, ...props }) => (
              <ul
                style={{
                  listStyle: "disc",
                  paddingLeft: "1.5em",
                  margin: "0.25em 0",
                }}
                {...props}
              />
            ),
            li: ({ node, ...props }) => (
              <li style={{ margin: "0.1em 0" }} {...props} />
            ),
            a: ({ node, href, children, ...props }) => {
              const safeHref = href || "";
              const childArray = Children.toArray(children);
              const firstChild = childArray[0];
              const linkLabel =
                typeof firstChild === "string" && firstChild.trim().length > 0
                  ? firstChild
                  : pickFilenameFromUrl(safeHref);

              if (safeHref && isPreviewableFileLink(safeHref)) {
                return (
                  <a
                    {...props}
                    href={safeHref}
                    onClick={(e) => {
                      e.preventDefault();
                      openPreview(safeHref, linkLabel);
                    }}
                  >
                    {children}
                  </a>
                );
              }

              return (
                <a
                  {...props}
                  href={safeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              );
            },
          }}
        >
          {displayAnswer}
        </ReactMarkdown>
      </div>
    );
  },
  (prevProps, nextProps) =>
    prevProps.answer === nextProps.answer &&
    prevProps.messageIdx === nextProps.messageIdx &&
    prevProps.onOpenPreview === nextProps.onOpenPreview,
);

MemoizedAnswer.displayName = "MemoizedAnswer";

export default MemoizedAnswer;
