const RECORD_COUNT_PREFIX =
  /^\s*(?:\*\*)?\d+(?:\*\*)?\s+records?\s+found\.?\s*/i;

/** Remove the leading "N record(s) found." line from query answers. */
export function stripRecordCountLine(answer: string): string {
  if (!answer) return "";
  return answer.replace(RECORD_COUNT_PREFIX, "").trimStart();
}
