import { useCallback, useEffect, useMemo, useState } from "react";
import PaginatedDataTable from "./PaginatedDataTable";
import type { TableData } from "./types";
import { aiAPI } from "../services/api";

const ROW_ID_KEYS = [
  "_hybrid_row_id",
  "student_uuid",
  "studentUuid",
  "uuid",
  "student_id",
  "studentId",
  "_id",
] as const;

export type HybridMessageTemplate = {
  subject?: string;
  body?: string;
};


const PLACEHOLDER_LABELS: Array<{ token: string; label: string }> = [
  { token: "{teacher_name}", label: "Teacher" },
  { token: "{student_name}", label: "Student" },
];

function toFriendlyText(text: string): string {
  let out = String(text || "");
  for (const { token, label } of PLACEHOLDER_LABELS) {
    out = out.split(token).join(label);
  }
  return out;
}

/** Put catalog tokens back before send when the original template used them. */
function toSendText(text: string, originalField: string): string {
  let out = String(text || "");
  const original = String(originalField || "");
  for (const { token, label } of PLACEHOLDER_LABELS) {
    if (!original.includes(token)) continue;
    out = out.replace(new RegExp(`\\b${label}\\b`, "g"), token);
  }
  return out;
}

export function getHybridRowId(
  row: Record<string, unknown>,
  index: number,
): string {
  for (const key of ROW_ID_KEYS) {
    const value = row[key];
    if (value == null) continue;
    if (typeof value === "object" && value !== null && "$oid" in value) {
      const oid = (value as { $oid?: string }).$oid;
      if (oid?.trim()) return oid.trim();
    }
    const text = String(value).trim();
    if (text) return text;
  }
  return `row_${index}`;
}

function sendButtonLabel(actionType?: string): string {
  if (actionType === "birthday_wishes") return "Send birthday wishes";
  if (actionType === "parent_email_reminder") return "Send reminder";
  return "Send message";
}

export interface HybridActionPanelProps {
  tableData: TableData;
  hybridSessionId: string;
  actionType?: string;
  userId: string;
  getErpContext: () => { academic_session: string; branch_token: string };
  messageTemplate?: HybridMessageTemplate;
  sent?: boolean;
  onSent: (answer: string) => void;
  onError: (message: string) => void;
}

export default function HybridActionPanel({
  tableData,
  hybridSessionId,
  actionType,
  userId,
  getErpContext,
  messageTemplate,
  sent = false,
  onSent,
  onError,
}: HybridActionPanelProps) {
  const rows = tableData.rows ?? [];
  const allIds = useMemo(
    () => rows.map((row, index) => getHybridRowId(row, index)),
    [rows],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(allIds),
  );
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [subject, setSubject] = useState(
    () => toFriendlyText(messageTemplate?.subject ?? ""),
  );
  const [body, setBody] = useState(
    () => toFriendlyText(messageTemplate?.body ?? ""),
  );

  useEffect(() => {
    setSelectedIds(new Set(allIds));
  }, [hybridSessionId, allIds]);

  useEffect(() => {
    setSubject(toFriendlyText(messageTemplate?.subject ?? ""));
    setBody(toFriendlyText(messageTemplate?.body ?? ""));
  }, [hybridSessionId, messageTemplate?.subject, messageTemplate?.body]);

  const disabled = sent || sending;
  const hasComposer = Boolean(
    messageTemplate?.subject || messageTemplate?.body || subject || body,
  );

  const toggleRow = useCallback((rowId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback((rowIds: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of rowIds) {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  }, []);

  const selectAllRows = useCallback(() => {
    setSelectedIds(new Set(allIds));
  }, [allIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleConfirmSend = async () => {
    if (selectedIds.size === 0) {
      onError("Please select at least one student.");
      return;
    }

    setShowConfirm(false);
    setSending(true);

    try {
      const authToken = localStorage.getItem("token");
      const { academic_session, branch_token } = getErpContext();
      const response = await aiAPI.hybridSend({
        hybrid_session_id: hybridSessionId,
        user_id: userId,
        selected_student_ids: Array.from(selectedIds),
        bearer_token: authToken || undefined,
        academic_session,
        branch_token,
        message_template: {
          subject: toSendText(
            subject.trim(),
            messageTemplate?.subject ?? "",
          ),
          body: toSendText(body.trim(), messageTemplate?.body ?? ""),
        },
      });

      if (response.status === "success") {
        onSent(response.data?.answer || "Message sent successfully.");
      } else {
        onError(response.data?.answer || response.message || "Send failed.");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to send message.";
      onError(message);
    } finally {
      setSending(false);
    }
  };

  if (!rows.length) {
    return null;
  }

  return (
    <div className="hybrid-action-panel mt-3 w-full">
      <PaginatedDataTable
        tableData={tableData}
        downloadFilename="hybrid-results.csv"
        showDownload={!sent}
        selection={{
          selectedIds,
          onToggleRow: toggleRow,
          onToggleAll: toggleAll,
          getRowId: getHybridRowId,
          disabled,
        }}
      />

      {hasComposer ? (
        <div className="hybrid-message-composer">
          <label className="hybrid-message-label" htmlFor={`hybrid-subject-${hybridSessionId}`}>
            Subject
          </label>
          <input
            id={`hybrid-subject-${hybridSessionId}`}
            type="text"
            className="hybrid-message-subject"
            value={subject}
            disabled={disabled}
            spellCheck={false}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
          />
          <label className="hybrid-message-label" htmlFor={`hybrid-body-${hybridSessionId}`}>
            Message
          </label>
          <textarea
            id={`hybrid-body-${hybridSessionId}`}
            className="hybrid-message-body"
            value={body}
            disabled={disabled}
            spellCheck={false}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Email body"
            rows={5}
          />
        </div>
      ) : null}

      <div className="hybrid-action-footer">
        <span className="hybrid-action-footer-count">
          {sent
            ? "Message sent."
            : `${selectedIds.size} of ${rows.length} selected`}
        </span>
        {!sent ? (
          <div className="hybrid-action-footer-actions">
            <button
              type="button"
              className="paginated-table-btn"
              disabled={disabled}
              onClick={selectAllRows}
            >
              Select all
            </button>
            <button
              type="button"
              className="paginated-table-btn"
              disabled={disabled}
              onClick={clearSelection}
            >
              Clear
            </button>
            <button
              type="button"
              className="paginated-table-btn hybrid-send-btn"
              disabled={disabled || selectedIds.size === 0}
              onClick={() => setShowConfirm(true)}
            >
              {sending ? "Sending…" : sendButtonLabel(actionType)}
            </button>
          </div>
        ) : null}
      </div>

      {showConfirm ? (
        <div className="hybrid-confirm-overlay" role="dialog" aria-modal="true">
          <div className="hybrid-confirm-dialog">
            <p className="hybrid-confirm-text">
              Send to {selectedIds.size} selected student
              {selectedIds.size === 1 ? "" : "s"}?
            </p>
            <div className="hybrid-confirm-actions">
              <button
                type="button"
                className="paginated-table-btn"
                disabled={sending}
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="paginated-table-btn paginated-table-btn-primary"
                disabled={sending}
                onClick={() => void handleConfirmSend()}
              >
                Confirm send
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
