import { useEffect, useMemo, useRef, useState } from "react";
import { clearLogs, downloadLogs, getLogs, subscribeLogs, type LogEntry, type LogLevel } from "../lib/logger";
import { Button } from "./ui";

type Filter = "all" | "warn" | "error";

const LEVEL_STYLE: Record<LogLevel, string> = {
  info: "text-sky-300/80",
  warn: "text-amber-300/90",
  error: "text-rose-300",
};

const LEVEL_LABEL: Record<LogLevel, string> = {
  info: "信息",
  warn: "警告",
  error: "错误",
};

export function LogPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    setEntries(getLogs());
    const unsubscribe = subscribeLogs(() => setEntries(getLogs()));
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      unsubscribe();
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const counts = useMemo(
    () => ({
      warn: entries.filter((entry) => entry.level === "warn").length,
      error: entries.filter((entry) => entry.level === "error").length,
    }),
    [entries],
  );
  const shown = filter === "all" ? entries : entries.filter((entry) => entry.level === filter);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="运行日志"
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-ink-800 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 px-4 py-3">
          <h3 className="text-[14px] font-semibold text-white">运行日志</h3>
          <span className="chip">{entries.length} 条</span>
          {counts.warn ? <span className="chip border-amber-400/30 bg-amber-500/10 text-amber-200">{counts.warn} 警告</span> : null}
          {counts.error ? <span className="chip border-rose-400/30 bg-rose-500/15 text-rose-200">{counts.error} 错误</span> : null}
          <div className="ml-auto flex items-center gap-1.5">
            <Button className="px-2" onClick={downloadLogs}>下载</Button>
            <Button
              className="px-2"
              onClick={() => {
                clearLogs();
                setEntries([]);
              }}
            >
              清空
            </Button>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭日志"
              className="rounded-lg px-2 py-1 text-white/40 transition hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex gap-1.5 border-b border-white/5 px-4 py-2">
          {([
            ["all", "全部"],
            ["warn", "警告"],
            ["error", "错误"],
          ] as Array<[Filter, string]>).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                filter === key ? "bg-white text-ink-950" : "border border-white/10 text-white/50 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto px-3 py-2">
          {shown.length === 0 ? (
            <p className="py-10 text-center text-[12px] text-white/35">暂无日志</p>
          ) : (
            <ul className="space-y-1.5">
              {shown.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-white/5 bg-white/[0.04] px-2.5 py-2">
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className={`text-[10.5px] font-medium ${LEVEL_STYLE[entry.level]}`}>
                      {LEVEL_LABEL[entry.level]}
                    </span>
                    <span className="text-[10px] text-white/30">
                      {new Date(entry.at).toLocaleString("zh-CN", { hour12: false })}
                    </span>
                    <span className="text-[10px] text-white/40">{entry.scope}</span>
                    <span className="min-w-0 flex-1 break-words text-[12px] leading-relaxed text-white/90">
                      {entry.message}
                    </span>
                  </div>
                  {entry.detail ? (
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-white/60">
                      {entry.detail}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="border-t border-white/5 px-4 py-2 text-[10.5px] text-white/40">
          日志只保存在本机浏览器，最多 200 条。遇到问题时点「下载」导出后发我。
        </p>
      </div>
    </div>
  );
}
