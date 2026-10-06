import type { ChatMessage, KpiCard, Recommendation, TableData, Visualization } from "../components/types";

export interface RecentTurn {
  q: string;
  ts: number;
  answer: string;
  table_data?: TableData | null;
  kpi_cards?: KpiCard[] | null;
  findings?: string[] | null;
  visualization?: Visualization | null;
  ai_level?: string | null;
  catalog_id?: string | null;
  recommendations?: Recommendation[] | null;
  layout?: string[] | null;
}

const MAX_TURNS = 5;
const MAX_ROWS = 50;
const EXIT_WORDS = new Set(["exit", "quit", "cancel", "stop", "done", "restart"]);

const welcomeMessage = (): ChatMessage => ({
  type: "bot",
  answer:
    "Hello! I'm SchoolsOS AI, your school assistant.\nHow can I help you today?",
  activeTab: "answer",
});

export function isWelcomeMessage(message: ChatMessage | undefined): boolean {
  return (
    message?.type === "bot" &&
    typeof message.answer === "string" &&
    message.answer.startsWith("Hello! I'm SchoolsOS AI")
  );
}

export function recentTurnsStorageKey(loginId: string): string {
  const branch = localStorage.getItem("branch_token") || "dpsindp";
  const owner = (loginId || "unknown").trim() || "unknown";
  return `recent_turns:${branch}:${owner}`;
}

function isExitQuestion(question: string): boolean {
  const normalized = question
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[.!?,;:'"]+|[.!?,;:'"]+$/g, "")
    .toLowerCase();
  return EXIT_WORDS.has(normalized);
}

function capTable(table: TableData | null | undefined, rowLimit: number): TableData | null {
  if (!table?.rows?.length) return null;
  const rows = table.rows.slice(0, rowLimit);
  return {
    rows,
    table_meta: {
      ...table.table_meta,
      total: rows.length,
    },
  };
}

export function snapshotFromAnswer(
  question: string,
  data: {
    answer?: string;
    table_data?: TableData | null;
    kpi_cards?: KpiCard[] | null;
    findings?: string[] | null;
    visualization?: Visualization | null;
    ai_level?: string | null;
    catalog_id?: string | null;
    recommendations?: Recommendation[] | null;
    layout?: string[] | null;
  },
): RecentTurn | null {
  const q = question.trim();
  if (!q || isExitQuestion(q)) return null;
  const answer = (data.answer || "").trim();
  const table_data = capTable(data.table_data, MAX_ROWS);
  const visualization = data.visualization?.show_chart ? data.visualization : null;
  const findings = data.findings?.slice(0, 20) ?? null;
  const kpi_cards = data.kpi_cards ?? null;
  if (!answer && !table_data && !kpi_cards?.length && !findings?.length && !visualization) {
    return null;
  }
  return {
    q,
    ts: Date.now(),
    answer,
    table_data,
    kpi_cards,
    findings,
    visualization,
    ai_level: data.ai_level,
    catalog_id: data.catalog_id,
    recommendations: data.recommendations,
    layout: data.layout,
  };
}

function parseTurns(raw: string | null): RecentTurn[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.q === "string" && typeof item.ts === "number")
      .slice(0, MAX_TURNS);
  } catch {
    return [];
  }
}

/** Newest first. */
export function readRecentTurns(loginId: string): RecentTurn[] {
  try {
    return parseTurns(localStorage.getItem(recentTurnsStorageKey(loginId)));
  } catch {
    return [];
  }
}

function writeRaw(loginId: string, turns: RecentTurn[]): void {
  const key = recentTurnsStorageKey(loginId);
  const payload = JSON.stringify(turns.slice(0, MAX_TURNS));
  try {
    localStorage.setItem(key, payload);
  } catch {
    const textOnly = turns.slice(0, MAX_TURNS).map((turn) => ({
      ...turn,
      table_data: null,
      visualization: null,
      recommendations: null,
    }));
    try {
      localStorage.setItem(key, JSON.stringify(textOnly));
    } catch {
      // Cache is optional. Redis still has the turns when it is configured.
    }
  }
}

export function writeRecentTurns(loginId: string, turns: RecentTurn[]): void {
  writeRaw(loginId, turns.slice(0, MAX_TURNS));
}

export function rememberTurn(loginId: string, turn: RecentTurn): void {
  const existing = readRecentTurns(loginId);
  const norm = turn.q.trim().toLowerCase();
  const withoutDup =
    existing[0] && existing[0].q.trim().toLowerCase() === norm
      ? existing.slice(1)
      : existing;
  writeRaw(loginId, [turn, ...withoutDup]);
}

export function turnsToMessages(turns: RecentTurn[]): ChatMessage[] {
  const ordered = [...turns].sort((a, b) => a.ts - b.ts);
  const messages: ChatMessage[] = [];
  for (const turn of ordered) {
    messages.push({
      type: "user",
      text: turn.q,
      fromHistory: true,
      askedAt: turn.ts,
    });
    messages.push({
      type: "bot",
      fromHistory: true,
      askedAt: turn.ts,
      answer: turn.answer,
      activeTab: "answer",
      table_data: turn.table_data ?? undefined,
      kpi_cards: turn.kpi_cards ?? undefined,
      findings: turn.findings ?? undefined,
      visualization: turn.visualization ?? undefined,
      ai_level: turn.ai_level ?? undefined,
      catalog_id: turn.catalog_id ?? undefined,
      recommendations: turn.recommendations ?? undefined,
      layout: turn.layout ?? undefined,
    });
  }
  return messages;
}

export function initialChatHistory(loginId: string): ChatMessage[] {
  const historical = turnsToMessages(readRecentTurns(loginId));
  if (historical.length === 0) return [welcomeMessage()];
  return historical;
}

export function mergeHistory(prev: ChatMessage[], turns: RecentTurn[]): ChatMessage[] {
  const live = prev.filter((message) => !message.fromHistory && !isWelcomeMessage(message));
  const lastLiveUser = [...live].reverse().find((message) => message.type === "user");
  const lastLiveText = (lastLiveUser?.text || "").trim().toLowerCase();
  const historicalTurns =
    lastLiveText && turns[0] && turns[0].q.trim().toLowerCase() === lastLiveText
      ? turns.slice(1)
      : turns;
  const historical = turnsToMessages(historicalTurns);
  if (historical.length === 0) {
    return live.length > 0 ? live : [welcomeMessage()];
  }
  return [...historical, ...live];
}
