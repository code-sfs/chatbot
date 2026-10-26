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

export const HEALTH_CARD_UNAUTHORIZED_MESSAGE =
  "🚫 You are not authorized to update health cards. Please contact the school administrator for access.";

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

export function roleDenialMessage(
  flow: string | undefined | null,
  roles: string | string[] | undefined | null,
): string | null {
  if (!flow) return null;
  const cleaned = normalizeRoles(roles);
  const isStudent = cleaned.some((role) => role === "student");
  const isNurse = cleaned.some((role) => role.includes("nurse"));

  if (HEALTH_CARD_FLOWS.has(flow)) {
    return isNurse ? null : HEALTH_CARD_UNAUTHORIZED_MESSAGE;
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
