import { useEffect, useRef, useState } from "react";
import { getBlob } from "../lib/storage";
import { log } from "../lib/logger";
import type { Episode, Series } from "../lib/types";
import { Button } from "./ui";

interface Props {
  episode: Episode;
  series: Series | null;
  episodes: Episode[];
  unlocked: Set<string | undefined>;
  onClose: () => void;
  onSelect: (episode: Episode) => void;
  onUnlock: (episode: Episode) => void;
  onOpenLogs: () => void;
  logErrorCount: number;
}

export function Player({ episode, series, episodes, unlocked, onClose, onSelect, onUnlock, onOpenLogs, logErrorCount }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const objectUrl = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(null);
    setEnded(false);
    if (episode.videoKey.startsWith("idb:")) {
      void getBlob(episode.videoKey.slice(4))
        .then((blob) => {
          if (cancelled) return;
          if (!blob) {
            setError("视频文件缺失（可能被浏览器清理）");
            log.error("play", "视频文件缺失", `${episode.id} · ${episode.videoKey}`);
            return;
          }
          const next = URL.createObjectURL(blob);
          objectUrl.current = next;
          setUrl(next);
        })
        .catch((error) => {
          log.error("play", "读取本地视频失败", error);
          setError("无法读取本地视频");
        });
    } else {
      setUrl(episode.videoKey);
    }
    return () => {
      cancelled = true;
      if (objectUrl.current) {
        URL.revokeObjectURL(objectUrl.current);
        objectUrl.current = null;
      }
    };
  }, [episode]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const index = episodes.findIndex((item) => item.id === episode.id);
  const next = index >= 0 ? episodes[index + 1] : undefined;

  const goNext = () => {
    if (!next) {
      setEnded(true);
      return;
    }
    if (next.priceCoins > 0 && !unlocked.has(next.id)) onUnlock(next);
    else onSelect(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={onClose} className="rounded-lg bg-white/10 px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/15">
          ← 返回
        </button>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-white">
            {series?.title} · 第 {episode.number} 集
          </p>
          <p className="truncate text-[10.5px] text-white/40">{episode.title}</p>
        </div>
        <button
          type="button"
          onClick={onOpenLogs}
          className="ml-auto flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/15"
        >
          日志
          {logErrorCount > 0 ? (
            <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold text-white">
              {logErrorCount > 99 ? "99+" : logErrorCount}
            </span>
          ) : null}
        </button>
        <span className="text-[10.5px] text-white/35">
          {episode.priceCoins === 0 ? "免费" : `已解锁 · ${episode.priceCoins} 币`}
        </span>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {error ? (
          <div className="text-center">
            <p className="text-[13px] text-rose-300">{error}</p>
            <Button className="mt-3" onClick={onClose}>返回剧集</Button>
          </div>
        ) : url ? (
          <video
            key={url}
            ref={videoRef}
            src={url}
            className="max-h-full max-w-full"
            controls
            autoPlay
            playsInline
            onEnded={() => setEnded(true)}
            onError={() => {
              log.error("play", "视频解码失败", episode.videoKey);
              setError("视频解码失败，换一集试试");
            }}
          />
        ) : (
          <p className="text-[12px] text-white/40">正在加载视频…</p>
        )}
        {ended ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
            <p className="text-[14px] text-white/80">本集结束</p>
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  setEnded(false);
                  const video = videoRef.current;
                  if (video) {
                    video.currentTime = 0;
                    void video.play();
                  }
                }}
              >
                重播本集
              </Button>
              <Button onClick={onClose}>返回剧集</Button>
            </div>
          </div>
        ) : null}
        <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/50 px-2 py-1 text-[10.5px] text-white/60">
          {index + 1} / {episodes.length}
        </div>
      </div>

      <div className="border-t border-white/10 bg-ink-950/90 px-3 py-3">
        <div className="scroll-thin flex gap-2 overflow-x-auto pb-1">
          {episodes.map((item) => {
            const locked = item.priceCoins > 0 && !unlocked.has(item.id);
            const active = item.id === episode.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-[11.5px] transition ${
                  active
                    ? "border-rose-400/60 bg-rose-500/20 text-white"
                    : "border-white/10 bg-white/[0.04] text-white/60 hover:text-white"
                }`}
              >
                第 {item.number} 集{locked ? " 🔒" : ""}
              </button>
            );
          })}
        </div>
        {next ? (
          <div className="mt-2 flex justify-end">
            <Button variant="primary" onClick={goNext}>
              {next.priceCoins > 0 && !unlocked.has(next.id) ? `解锁第 ${next.number} 集（${next.priceCoins} 币）` : `下一集：${next.title}`}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
