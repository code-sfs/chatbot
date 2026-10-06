const RECORD_COUNT_PREFIX =
  /^\s*(?:\*\*)?\d+(?:\*\*)?\s+records?\s+found\.?\s*/i;

const TABLE_START = /^\s*\|.+\|\s*$/m;

/** Remove the leading "N record(s) found." line from query answers. */
export function stripRecordCountLine(answer: string): string {
  if (!answer) return "";
  const withoutCount = answer.replace(RECORD_COUNT_PREFIX, "").trimStart();
  const tableAt = withoutCount.search(TABLE_START);
  if (tableAt > 0) {
    return withoutCount.slice(tableAt).trim();
  }
  return withoutCount;
}
