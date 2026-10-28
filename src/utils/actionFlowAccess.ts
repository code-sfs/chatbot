/**
 * Client mirror of chatbotApi/utils/action_flow_access.py.
 * Used when the UI picks a flow without a classify result (lexical overrides
 * and an already-open flow). Classify denials still prefer the backend message.
 */

const STAFF_LABELS: Record<string, string> = {
  assignment_create: "create assignment",
  assignment: "create assignment",
  attendance: "mark attendance",
  voice_attendance: "mark attendance",
  full_voice_attendance: "mark attendance",
  review_submission: "review submissions",
  review: "review submissions",
  marks_entry: "enter marks",
  marks: "enter marks",
  teacher_diary: "use the teacher diary",
  course_progress: "view course progress",
  leave: "apply for leave",
  leave_approval: "approve leave",
  student_leave_approval: "approve student leave",
  message_create: "create a message",
  message: "create a message",
  approval_disambiguation: "approve leave",
};

const STUDENT_LABELS: Record<string, string> = {
  assignment_submit: "submit an assignment",
  submission: "submit an assignment",
};

const HEALTH_CARD_FLOWS = new Set(["health_card"]);
const REQUISITION_FLOWS = new Set(["requisition", "requisition_request"]);

/** Matches backend FINANCE_ALLOWED_FLOWS (+ UI aliases). */
const FINANCE_ALLOWED_FLOWS = new Set([
  "leave",
  "leave_approval",
  "library",
  "library_reserve_book",
  "complaint",
]);

function isHmRole(roles: string[]): boolean {
  return roles.some(
    (role) =>
      role === "hm" ||
      /\bhm\b/.test(role) ||
      role.includes("head mistress") ||
      role.includes("headmistress") ||
      role.includes("head master") ||
      role.includes("headmaster"),
  );
}

export const HEALTH_CARD_UNAUTHORIZED_MESSAGE =
  "You are not authorized to update health cards.";

function normalizeRoles(roles: string | string[] | undefined | null): string[] {
  if (!roles) return [];
  const parts = Array.isArray(roles) ? roles : String(roles).split(",");
  return parts
    .flatMap((role) =>
      String(role)
        .replace(/[[\]]/g, "")
        .split(","),
    )
    .map((role) => role.trim().replace(/^['"]|['"]$/g, "").toLowerCase())
    .filter(Boolean);
}

function flowLabel(flow: string): string | null {
  return (
    STAFF_LABELS[flow] ||
    STUDENT_LABELS[flow] ||
    (flow === "library" || flow === "library_reserve_book"
      ? "reserve a book"
      : flow === "complaint"
        ? "file a complaint"
        : null)
  );
}

/** Matches persona_config finance rule: roles containing finance or account. */
function isFinancePersona(roles: string[]): boolean {
  return roles.some(
    (role) => role.includes("finance") || role.includes("account"),
  );
}

export function roleDenialMessage(
  flow: string | undefined | null,
  roles: string | string[] | undefined | null,
): string | null {
  if (!flow) return null;
  const cleaned = normalizeRoles(roles);
  const isStudent = cleaned.some((role) => role === "student");
  const isNurse = cleaned.some((role) => role.includes("nurse"));

  if (isNurse && flow !== "health_card" && flow !== "complaint") {
    const label = flowLabel(flow);
    if (label) {
      return `You are not authorised to ${label}.`;
    }
  }

  // Finance/account: only leave, staff leave approval, library, complaint.
  // Principal / teacher / other staff are unchanged (finance keywords only).
  if (isFinancePersona(cleaned) && !FINANCE_ALLOWED_FLOWS.has(flow)) {
    const label = flowLabel(flow);
    if (label) {
      return `You are not authorised to ${label}.`;
    }
  }

  if (HEALTH_CARD_FLOWS.has(flow)) {
    return isNurse ? null : HEALTH_CARD_UNAUTHORIZED_MESSAGE;
  }

  if (REQUISITION_FLOWS.has(flow)) {
    return isHmRole(cleaned)
      ? null
      : "You are not authorised to create a requisition request.";
  }

  const staffLabel = STAFF_LABELS[flow];
  if (staffLabel) {
    if (cleaned.length === 0 || isStudent) {
      return `You are not authorised to ${staffLabel}.`;
    }
    return null;
  }

  const studentLabel = STUDENT_LABELS[flow];
  if (studentLabel) {
    if (cleaned.length === 0 || !isStudent) {
      return `You are not authorised to ${studentLabel}.`;
    }
  }
  return null;
}
