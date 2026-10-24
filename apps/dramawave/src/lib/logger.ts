export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  at: number;
  level: LogLevel;
  scope: string;
  message: string;
  detail?: string;
}

const STORAGE_KEY = "dramawave.logs.v1";
const MAX_ENTRIES = 200;
const MAX_MESSAGE = 500;
const MAX_DETAIL = 2000;

let entries: LogEntry[] = [];
let loaded = false;
let installed = false;
let writing = false;
let rawConsoleError: (...args: unknown[]) => void = console.error.bind(console);
const listeners = new Set<() => void>();

function isEntry(value: unknown): value is LogEntry {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<LogEntry>;
  return (
    typeof item.id === "string" &&
    typeof item.at === "number" &&
    (item.level === "info" || item.level === "warn" || item.level === "error") &&
    typeof item.scope === "string" &&
    typeof item.message === "string"
  );
}

function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) entries = parsed.filter(isEntry).slice(0, MAX_ENTRIES);
  } catch {
    // 日志读取失败不影响应用
  }
}

function stringify(value: unknown): string {
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function record(level: LogLevel, scope: string, message: string, detail?: unknown): void {
  ensureLoaded();
  const entry: LogEntry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    level,
    scope,
    message: stringify(message).slice(0, MAX_MESSAGE),
    detail: detail === undefined ? undefined : stringify(detail).slice(0, MAX_DETAIL),
  };
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // 空间不足时日志只留在内存，不阻塞业务
  }
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // 单个订阅者失败不影响其他订阅者
    }
  });
}

export const log = {
  info(scope: string, message: string, detail?: unknown): void {
    record("info", scope, message, detail);
  },
  warn(scope: string, message: string, detail?: unknown): void {
    record("warn", scope, message, detail);
  },
  error(scope: string, message: string, detail?: unknown): void {
    record("error", scope, message, detail);
  },
};

/** 捕获未处理异常、Promise 拒绝和 console.error，应用启动时调用一次。 */
export function installLogging(): void {
  if (installed) return;
  installed = true;
  rawConsoleError = console.error.bind(console);

  window.addEventListener("error", (event) => {
    record(
      "error",
      "window",
      event.message || "脚本错误",
      `${event.filename || "unknown"}:${event.lineno}:${event.colno}`,
    );
  });
  window.addEventListener("unhandledrejection", (event) => {
    record("error", "promise", "未处理的 Promise 拒绝", event.reason);
  });
  console.error = (...args: unknown[]) => {
    rawConsoleError(...args);
    if (writing) return;
    writing = true;
    try {
      record("error", "console", args.map(stringify).join(" "));
    } finally {
      writing = false;
    }
  };

  record("info", "app", "应用启动", `${location.href} · ${new Date().toLocaleString("zh-CN")}`);
}

export function getLogs(): LogEntry[] {
  ensureLoaded();
  return entries;
}

export function subscribeLogs(listener: () => void): () => void {
  ensureLoaded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearLogs(): void {
  entries = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 清理失败时保留内存中的空列表
  }
  listeners.forEach((listener) => listener());
}

export function logsToText(): string {
  const list = getLogs();
  const lines = [
    "剧浪 DramaWave 运行日志",
    `导出时间：${new Date().toLocaleString("zh-CN")}`,
    `共 ${list.length} 条`,
    "",
  ];
  for (const entry of [...list].reverse()) {
    lines.push(
      `${new Date(entry.at).toLocaleString("zh-CN", { hour12: false })} [${entry.level.toUpperCase()}] ${entry.scope}: ${entry.message}`,
    );
    if (entry.detail) {
      lines.push(
        ...entry.detail.split("\n").map((line) => `    ${line}`),
      );
    }
  }
  return lines.join("\n");
}

export function downloadLogs(): void {
  const blob = new Blob([logsToText()], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dramawave-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}
