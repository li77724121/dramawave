import { composePrompt } from "../lib/prompt";
import type { Project, Shot } from "../lib/types";
import { Badge, Button, TextArea } from "./ui";

interface Props {
  project: Project;
  generatingAll: boolean;
  patchShot: (id: string, patch: Partial<Shot>) => void;
  onGenerate: (id: string) => void;
  onGenerateAll: () => void;
  onSuggest: (id: string) => void;
  onSuggestAll: () => void;
  onUpload: (id: string, file: File) => void;
  onDelete: (id: string) => void;
  onOpenPreview: () => void;
}

const ASPECT_CLASS: Record<Project["aspect"], string> = {
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
  "1:1": "aspect-square",
};

function statusBadge(shot: Shot) {
  if (shot.status === "generating") return <Badge tone="busy">生成中…</Badge>;
  if (shot.status === "ready") return <Badge tone="ok">已出图</Badge>;
  if (shot.status === "error") return <Badge tone="warn">失败</Badge>;
  return <Badge>待生成</Badge>;
}

export function BoardPanel({
  project,
  generatingAll,
  patchShot,
  onGenerate,
  onGenerateAll,
  onSuggest,
  onSuggestAll,
  onUpload,
  onDelete,
  onOpenPreview,
}: Props) {
  const ready = project.shots.filter((shot) => shot.image).length;
  const busy = project.shots.some((shot) => shot.status === "generating");

  return (
    <div className="space-y-4">
      <section className="panel flex flex-wrap items-center gap-2 p-3.5">
        <div className="mr-auto">
          <h2 className="text-[13px] font-semibold text-white/85">分镜板</h2>
          <p className="mt-0.5 text-[11px] text-white/40">
            {project.shots.length} 个镜头 · 已出图 {ready} 个 · 免费端点有频率限制，失败可直接重试或上传本地图
          </p>
        </div>
        <Button onClick={onSuggestAll}>补齐空提示词</Button>
        <Button onClick={onOpenPreview} disabled={!ready}>
          预览成片
        </Button>
        <Button
          variant="primary"
          onClick={onGenerateAll}
          disabled={generatingAll || busy || project.shots.length === 0}
        >
          {generatingAll ? "排队生成中…" : "生成全部"}
        </Button>
      </section>

      {project.shots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/12 px-4 py-10 text-center">
          <p className="text-sm text-white/70">还没有分镜</p>
          <p className="mt-1 text-[11.5px] text-white/35">回到「剧本」页，粘贴内容后点「拆分为分镜」。</p>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {project.shots.map((shot) => {
          const suggested = composePrompt(project, shot);
          return (
            <section key={shot.id} className="panel flex flex-col overflow-hidden">
              <div className={`relative w-full ${ASPECT_CLASS[project.aspect]} bg-ink-900`}>
                {shot.image ? (
                  <img src={shot.image} alt={`镜头 ${shot.index + 1}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[radial-gradient(circle_at_50%_30%,rgba(99,102,241,0.18),transparent_60%)] text-white/30">
                    <span className="text-2xl">{String(shot.index + 1).padStart(2, "0")}</span>
                    <span className="text-[10.5px]">尚无画面</span>
                  </div>
                )}
                <div className="absolute left-2 top-2 flex gap-1.5">
                  <span className="rounded-md bg-ink-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                    #{String(shot.index + 1).padStart(2, "0")}
                  </span>
                  {statusBadge(shot)}
                </div>
                {shot.status === "generating" ? (
                  <div className="absolute inset-0 grid place-items-center bg-ink-950/55">
                    <span className="pulse-soft text-[11px] text-white/70">正在生成…</span>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="line-clamp-2 text-[11.5px] leading-relaxed text-white/55">
                  {shot.scene ? <span className="text-amber-300/80">{shot.scene} · </span> : null}
                  {shot.action || shot.dialogue.map((d) => d.text).join(" ")}
                </p>

                <label className="block">
                  <span className="label">提示词</span>
                  <TextArea
                    rows={3}
                    value={shot.prompt}
                    placeholder={suggested}
                    onChange={(event) => patchShot(shot.id, { prompt: event.target.value })}
                    className="font-mono text-[10.5px]"
                  />
                </label>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-[10.5px] text-white/40">
                    时长
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={shot.duration}
                      onChange={(event) =>
                        patchShot(shot.id, { duration: Math.max(1, Math.min(20, Number(event.target.value) || 1)) })
                      }
                      className="w-14 rounded-md border border-white/10 bg-ink-900 px-1.5 py-1 text-[11px] text-white/80"
                    />
                    秒
                  </label>
                  <span className="ml-auto text-[10px] text-white/25">seed {shot.seed}</span>
                </div>

                {shot.error ? (
                  <p className="rounded-md border border-rose-400/20 bg-rose-500/10 px-2 py-1.5 text-[10.5px] leading-relaxed text-rose-200">
                    {shot.error}
                  </p>
                ) : null}

                <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                  <Button
                    variant="primary"
                    onClick={() => onGenerate(shot.id)}
                    disabled={shot.status === "generating"}
                  >
                    {shot.image ? "重生成" : "生成"}
                  </Button>
                  <label className="btn-ghost cursor-pointer">
                    上传
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) onUpload(shot.id, file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <Button onClick={() => onSuggest(shot.id)}>用建议词</Button>
                  <Button variant="plain" className="ml-auto text-rose-300/60 hover:text-rose-200" onClick={() => onDelete(shot.id)}>
                    删除
                  </Button>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
