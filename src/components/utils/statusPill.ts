export type StatusTone = "present" | "leave" | "absent";

/** Map a single table cell to a status pill. Dates, times, and long text stay plain. */
export function statusTone(text: string): StatusTone | null {
  const value = text.trim().toLowerCase();
  if (!value || value === "-" || value.length > 40) return null;
  if (value === "present") return "present";
  if (value === "absent") return "absent";
  if (
    value.includes("leave") ||
    value.includes("half day") ||
    value.includes("half-day")
  ) {
    return "leave";
  }
  return null;
}
