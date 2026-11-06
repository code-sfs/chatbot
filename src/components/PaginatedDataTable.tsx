import { useEffect, useMemo, useState } from "react";
import { FiDownload, FiFilter } from "react-icons/fi";
import type { TableData } from "./types";
import {
  downloadTableXls,
  formatColumnHeader,
} from "./utils/exportTableCsv";
import { statusTone } from "./utils/statusPill";

function StatusCell({ text }: { text: string }) {
  const tone = statusTone(text);
  if (!tone) return text;
  return <span className={`status-pill status-pill--${tone}`}>{text}</span>;
}

function cellText(value: unknown, blankAsEmpty = false): string {
  if (value === null || value === undefined || value === "") {
    return blankAsEmpty ? "" : "-";
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isBlankCell(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/** Read a cell even if key casing/spacing differs slightly. */
function getRowValue(
  row: Record<string, unknown>,
  column: string,
): unknown {
  if (Object.prototype.hasOwnProperty.call(row, column)) {
    return row[column];
  }
  const want = column.trim().toLowerCase();
  const match = Object.keys(row).find((k) => k.trim().toLowerCase() === want);
  return match ? row[match] : undefined;
}

/** Keep rows matching the filter (contains, or exact for chips). */
export function filterRowsByColumn(
  rows: Record<string, unknown>[],
  column: string,
  text: string,
  mode: "contains" | "exact" = "contains",
): Record<string, unknown>[] {
  const needle = text.trim().toLowerCase();
  if (!column || !needle) return rows;
  return rows.filter((row) => {
    const cell = String(getRowValue(row, column) ?? "")
      .trim()
      .toLowerCase();
    return mode === "exact" ? cell === needle : cell.includes(needle);
  });
}

type SortDir = "asc" | "desc";

function uniqueColumnValues(
  rows: Record<string, unknown>[],
  column: string,
): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const value = String(getRowValue(row, column) ?? "").trim();
    if (value) seen.add(value);
  }
  return [...seen].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
}

/** Prefer Status-like columns, else first column with a small set of values. */
function pickDefaultFilterColumn(
  columns: string[],
  rows: Record<string, unknown>[],
): string {
  if (!columns.length) return "";
  const statusCol = columns.find((c) => /status/i.test(c));
  if (statusCol) return statusCol;
  for (const col of columns) {
    const values = uniqueColumnValues(rows, col);
    if (values.length >= 2 && values.length <= 8) return col;
  }
  return columns[0];
}

/** Chip filters when a column has a small set of distinct values. */
function canUseChips(values: string[]): boolean {
  return values.length >= 2 && values.length <= 8;
}

/** Parse common table dates (dd-mm-yyyy / yyyy-mm-dd, optional time). */
function toSortableTime(value: string): number | null {
  const dmy = value.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T].*)?$/,
  );
  if (dmy) {
    const t = Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return Number.isNaN(t) ? null : t;
  }
  const ymd = value.match(
    /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T].*)?$/,
  );
  if (ymd) {
    const t = Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

function compareCellValues(a: unknown, b: unknown): number {
  const sa = a == null || a === "" ? "" : String(a).trim();
  const sb = b == null || b === "" ? "" : String(b).trim();
  if (sa === "" && sb === "") return 0;
  if (sa === "") return 1;
  if (sb === "") return -1;

  const ta = toSortableTime(sa);
  const tb = toSortableTime(sb);
  if (ta != null && tb != null) return ta - tb;

  const na = Number(sa.replace(/,/g, ""));
  const nb = Number(sb.replace(/,/g, ""));
  const aNum = sa !== "" && !Number.isNaN(na) && /^-?\d+(\.\d+)?$/.test(sa);
  const bNum = sb !== "" && !Number.isNaN(nb) && /^-?\d+(\.\d+)?$/.test(sb);
  if (aNum && bNum) return na - nb;

  return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: "base" });
}

export function sortRowsByColumn(
  rows: Record<string, unknown>[],
  column: string,
  dir: SortDir,
): Record<string, unknown>[] {
  if (!column) return rows;
  const sorted = [...rows];
  sorted.sort((left, right) => {
    const cmp = compareCellValues(
      getRowValue(left, column),
      getRowValue(right, column),
    );
    return dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

function mergeRowSpan(
  rows: Record<string, unknown>[],
  rowIdx: number,
  mergeColumn: string,
): number {
  const value = rows[rowIdx]?.[mergeColumn];
  if (isBlankCell(value)) {
    return 0;
  }
  let span = 1;
  for (let i = rowIdx + 1; i < rows.length; i += 1) {
    if (!isBlankCell(rows[i]?.[mergeColumn])) break;
    span += 1;
  }
  return span;
}

interface TableSelectionProps {
  selectedIds: Set<string>;
  onToggleRow: (rowId: string) => void;
  onToggleAll: (rowIds: string[], checked: boolean) => void;
  getRowId: (row: Record<string, unknown>, globalIndex: number) => string;
  disabled?: boolean;
}

interface PaginatedDataTableProps {
  tableData: TableData;
  downloadFilename?: string;
  showDownload?: boolean;
  enableColumnFilter?: boolean;
  /** Bump this value to open the filter panel (e.g. from a parent Filter button). */
  openFilterSignal?: number;
  selection?: TableSelectionProps;
}

const ragRowClass: Record<string, string> = {
  danger: "rag-row-danger",
  warning: "rag-row-warning",
  success: "rag-row-success",
  neutral: "",
};

export default function PaginatedDataTable({
  tableData,
  downloadFilename = "query-results.xls",
  showDownload = true,
  enableColumnFilter = true,
  openFilterSignal = 0,
  selection,
}: PaginatedDataTableProps) {
  const { rows, table_meta } = tableData;
  const { columns, page_size, row_status_key, merge_column } = table_meta;
  const [page, setPage] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterColumn, setFilterColumn] = useState("");
  const [filterText, setFilterText] = useState("");
  const [filterMode, setFilterMode] = useState<"contains" | "exact">("contains");
  const [sortColumn, setSortColumn] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const mergeEnabled = Boolean(merge_column && columns.includes(merge_column));

  const displayColumns = useMemo(
    () => columns.filter((col) => col !== "_hybrid_row_id"),
    [columns],
  );

  useEffect(() => {
    if (!enableColumnFilter || !displayColumns.length) return;
    if (!filterColumn || !displayColumns.includes(filterColumn)) {
      setFilterColumn(pickDefaultFilterColumn(displayColumns, rows));
    }
  }, [enableColumnFilter, displayColumns, filterColumn, rows]);

  useEffect(() => {
    if (!enableColumnFilter || !openFilterSignal) return;
    setFilterOpen(true);
  }, [enableColumnFilter, openFilterSignal]);

  const chipValues = useMemo(() => {
    if (!filterColumn) return [];
    return uniqueColumnValues(rows, filterColumn);
  }, [rows, filterColumn]);

  const useChips = canUseChips(chipValues);

  const filteredRows = useMemo(
    () =>
      enableColumnFilter
        ? filterRowsByColumn(rows, filterColumn, filterText, filterMode)
        : rows,
    [enableColumnFilter, rows, filterColumn, filterText, filterMode],
  );

  const visibleRows = useMemo(
    () =>
      sortColumn
        ? sortRowsByColumn(filteredRows, sortColumn, sortDir)
        : filteredRows,
    [filteredRows, sortColumn, sortDir],
  );

  const visibleTotal = visibleRows.length;
  const usePagination = visibleTotal > page_size;
  const totalPages = Math.max(1, Math.ceil(visibleTotal / page_size));
  const safePage = Math.min(page, totalPages - 1);

  useEffect(() => {
    setPage(0);
  }, [filterColumn, filterText, filterMode, sortColumn, sortDir]);

  const onHeaderClick = (col: string) => {
    if (sortColumn === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(col);
    setSortDir("asc");
  };

  const clearFilter = () => {
    setFilterText("");
    setFilterMode("contains");
  };

  const selectChip = (value: string) => {
    if (filterText === value && filterMode === "exact") {
      clearFilter();
      return;
    }
    setFilterText(value);
    setFilterMode("exact");
  };

  const pageRows = useMemo(() => {
    if (!usePagination) return visibleRows;
    const start = safePage * page_size;
    return visibleRows.slice(start, start + page_size);
  }, [visibleRows, safePage, page_size, usePagination]);

  const rangeStart = visibleTotal === 0 ? 0 : safePage * page_size + 1;
  const rangeEnd = usePagination
    ? Math.min((safePage + 1) * page_size, visibleTotal)
    : visibleTotal;

  const pageRowIds = useMemo(
    () =>
      pageRows.map((row, rowIdx) => {
        const globalIndex = usePagination ? safePage * page_size + rowIdx : rowIdx;
        return selection?.getRowId(row, globalIndex) ?? String(globalIndex);
      }),
    [pageRows, safePage, page_size, usePagination, selection],
  );

  const pageAllSelected =
    Boolean(selection) &&
    pageRowIds.length > 0 &&
    pageRowIds.every((id) => selection!.selectedIds.has(id));

  const pageSomeSelected =
    Boolean(selection) &&
    pageRowIds.some((id) => selection!.selectedIds.has(id));

  const hasActiveFilter = Boolean(filterText.trim());
  const showFilterPanel = enableColumnFilter && (filterOpen || hasActiveFilter);

  if (!displayColumns.length || !rows.length) {
    return null;
  }

  return (
    <div className="paginated-table-wrap mt-3 w-full">
      <div className="table-meta-bar">
        {hasActiveFilter ? (
          <span className="table-meta-count">
            {`Showing ${visibleTotal} of ${rows.length}`}
          </span>
        ) : null}
        <div className="table-meta-actions">
          {enableColumnFilter ? (
            <button
              type="button"
              className={`table-meta-btn table-meta-btn-filter${showFilterPanel ? " is-active" : ""}`}
              aria-expanded={showFilterPanel}
              onClick={() => setFilterOpen((open) => !open)}
            >
              <FiFilter className="table-meta-btn-icon" aria-hidden="true" />
              Filter
            </button>
          ) : null}
          {showDownload ? (
            <button
              type="button"
              className="table-meta-btn table-meta-btn-download"
              title="Download Excel (.xls)"
              onClick={() =>
                downloadTableXls(rows, displayColumns, downloadFilename)
              }
            >
              <FiDownload className="table-meta-btn-icon" aria-hidden="true" />
              Download file
            </button>
          ) : null}
        </div>
      </div>

      {showFilterPanel ? (
        <div className="table-filter-panel">
          <label className="table-filter-field">
            <span className="table-filter-field-label">Column</span>
            <select
              className="table-filter-select"
              aria-label="Filter column"
              value={filterColumn}
              onChange={(e) => {
                setFilterColumn(e.target.value);
                clearFilter();
              }}
            >
              {displayColumns.map((col) => (
                <option key={col} value={col}>
                  {formatColumnHeader(col)}
                </option>
              ))}
            </select>
          </label>

          {useChips ? (
            <div className="table-filter-chips" role="listbox" aria-label="Filter values">
              <button
                type="button"
                className={`table-filter-chip${!hasActiveFilter ? " is-active" : ""}`}
                onClick={clearFilter}
              >
                All
              </button>
              {chipValues.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`table-filter-chip${
                    filterMode === "exact" && filterText === value
                      ? " is-active"
                      : ""
                  }`}
                  onClick={() => selectChip(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="search"
              className="table-filter-input"
              placeholder={`Search ${formatColumnHeader(filterColumn)}…`}
              value={filterText}
              onChange={(e) => {
                setFilterText(e.target.value);
                setFilterMode("contains");
              }}
            />
          )}

          {hasActiveFilter ? (
            <button type="button" className="table-meta-btn" onClick={clearFilter}>
              Reset
            </button>
          ) : null}
        </div>
      ) : null}

      {usePagination ? (
        <div className="paginated-table-toolbar">
          <span className="paginated-table-range text-sm text-slate-600">
            Showing {rangeStart}–{rangeEnd} of {visibleTotal}
          </span>
          <div className="paginated-table-actions">
            <button
              type="button"
              className="paginated-table-btn"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <span className="paginated-table-page text-sm text-slate-600">
              Page {safePage + 1} of {totalPages}
            </span>
            <button
              type="button"
              className="paginated-table-btn"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {visibleTotal === 0 ? (
        <p className="table-filter-empty">No rows match this filter.</p>
      ) : (
        <div
          className={`markdown-table-container table-rows-animate${
            mergeEnabled ? " markdown-table-merge" : ""
          }`}
        >
          <table>
            <thead>
              <tr>
                {selection ? (
                  <th className="hybrid-select-col">
                    <input
                      type="checkbox"
                      aria-label="Select all on page"
                      checked={pageAllSelected}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate =
                            !pageAllSelected && pageSomeSelected;
                        }
                      }}
                      disabled={selection.disabled}
                      onChange={(e) =>
                        selection.onToggleAll(pageRowIds, e.target.checked)
                      }
                    />
                  </th>
                ) : null}
                {displayColumns.map((col) => {
                  const isActive = sortColumn === col;
                  const ariaSort = !isActive
                    ? "none"
                    : sortDir === "asc"
                      ? "ascending"
                      : "descending";
                  return (
                    <th
                      key={col}
                      aria-sort={ariaSort}
                      className={`table-sort-th${isActive ? " is-active" : ""}`}
                      title="Click to sort"
                      onClick={() => onHeaderClick(col)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onHeaderClick(col);
                        }
                      }}
                      tabIndex={0}
                      role="columnheader"
                    >
                      <span className="table-sort-th-label">
                        {formatColumnHeader(col)}
                      </span>
                      <span
                        className={`table-sort-caret${
                          isActive
                            ? sortDir === "asc"
                              ? " is-asc"
                              : " is-desc"
                            : ""
                        }`}
                        aria-hidden="true"
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, rowIdx) => {
                const status = row_status_key
                  ? String(row[row_status_key] ?? "").toLowerCase()
                  : "";
                const rowClass = row_status_key ? ragRowClass[status] || "" : "";
                const rowId = pageRowIds[rowIdx];
                const isSelected = selection?.selectedIds.has(rowId) ?? false;
                return (
                  <tr key={`${safePage}-${rowIdx}`} className={rowClass}>
                    {selection ? (
                      <td className="hybrid-select-col">
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          checked={isSelected}
                          disabled={selection.disabled}
                          onChange={() => selection.onToggleRow(rowId)}
                        />
                      </td>
                    ) : null}
                    {displayColumns.map((col) => {
                      if (mergeEnabled && col === merge_column) {
                        const span = mergeRowSpan(pageRows, rowIdx, merge_column);
                        if (span === 0) {
                          return null;
                        }
                        return (
                          <td
                            key={col}
                            rowSpan={span}
                            className="merge-group-cell"
                          >
                            <StatusCell text={cellText(row[col], true)} />
                          </td>
                        );
                      }
                      return (
                        <td key={col}>
                          <StatusCell text={cellText(row[col], mergeEnabled)} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
