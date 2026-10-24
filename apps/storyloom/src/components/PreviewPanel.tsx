import { useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "../lib/types";
import { Button } from "./ui";

interface Props {
  project: Project;
}

const ASPECT_CLASS: Record<Project["aspect"], string> = {
  "9:16": "aspect-[9/16] max-h-[70vh]",
  "16:9": "aspect-video",
  "1:1": "aspect-square",
};

function format(seconds: number): string {
  const total = Math.max(0, seconds);
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PreviewPanel({ project }: Props) {
  const total = useMemo(
    () => project.shots.reduce((sum, shot) => sum + shot.duration, 0),
    [project.shots],
  );
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);

  useEffect(() => {
    if (!playing) return;
    lastRef.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      setTime((current) => {
        const next = current + dt;
        if (next >= total) {
          setPlaying(false);
          return total;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, total]);

  const { shot, local } = useMemo(() => {
    let cursor = 0;
    for (const item of project.shots) {
      if (time < cursor + item.duration) {
        return { shot: item, local: (time - cursor) / item.duration };
      }
      cursor += item.duration;
    }
    const last = project.shots[project.shots.length - 1];
    return { shot: last, local: 1 };
  }, [project.shots, time]);

  if (!shot) {
    return (
      <div className="rounded-xl border border-dashed border-white/12 px-4 py-12 text-center text-[12px] text-white/40">
        还没有可预览的镜头。
      </div>
    );
  }

  const subtitle = shot.dialogue.map((d) => (d.speaker ? `${d.speaker}：${d.text}` : d.text)).join("\n");

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="panel p-3">
        <div className="relative mx-auto w-full overflow-hidden rounded-lg bg-black">
          <div className={`relative mx-auto w-full ${ASPECT_CLASS[project.aspect]}`}>
            {shot.image ? (
              <img
                src={shot.image}
                alt={`镜头 ${shot.index + 1}`}
                className="h-full w-full object-cover transition-transform duration-100 ease-linear"
                style={{
                  transform: `scale(${1.02 + local * 0.06}) translateY(${(0.5 - local) * 1.5}%)`,
                }}
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-gradient-to-b from-ink-800 to-ink-950 text-white/25">
                <div className="text-center">
                  <p className="text-3xl font-semibold">{String(shot.index + 1).padStart(2, "0")}</p>
                  <p className="mt-1 text-[11px]">这个镜头还没有画面</p>
                </div>
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-5 pt-10">
              {subtitle ? (
                <p className="whitespace-pre-line text-center text-[15px] font-medium leading-relaxed text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  {subtitle}
                </p>
              ) : null}
            </div>
            <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/60">
              镜头 {shot.index + 1} / {project.shots.length}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 px-1">
          <Button variant="primary" onClick={() => setPlaying((value) => !value)}>
            {playing ? "暂停" : time >= total ? "重播" : "播放"}
          </Button>
          <input
            type="range"
            min={0}
            max={Math.max(total, 0.1)}
            step={0.05}
            value={time}
            onChange={(event) => {
              setPlaying(false);
              setTime(Number(event.target.value));
            }}
            className="flex-1 accent-amber-400"
          />
          <span className="w-20 text-right text-[11px] tabular-nums text-white/45">
            {format(time)} / {format(total)}
          </span>
        </div>
      </section>

      <aside className="panel h-fit p-3.5">
        <h3 className="text-[12px] font-semibold text-white/80">镜头列表</h3>
        <div className="scroll-thin mt-2 max-h-[60vh] space-y-1 overflow-y-auto pr-1">
          {project.shots.map((item) => {
            const start = project.shots
              .slice(0, item.index)
              .reduce((sum, prev) => sum + prev.duration, 0);
            const active = item.id === shot.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setTime(start);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                  active ? "bg-amber-400/15 text-amber-100 ring-1 ring-inset ring-amber-400/30" : "text-white/55 hover:bg-white/5"
                }`}
              >
                <span className="text-[10px] tabular-nums text-white/30">{String(item.index + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1 truncate text-[11.5px]">{item.action || item.scene || "（空镜头）"}</span>
                <span className="text-[10px] text-white/25">{item.duration}s</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[10.5px] leading-relaxed text-white/30">
          预览用静帧 + 缓慢推拉模拟运镜，用来检查节奏、字幕和构图；正式成片需在剪辑软件里合成。
        </p>
      </aside>
    </div>
  );
}
