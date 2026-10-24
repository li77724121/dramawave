import { useCallback, useEffect, useRef, useState } from "react";
import { BoardPanel } from "./BoardPanel";
import { CastPanel } from "./CastPanel";
import { ExportPanel } from "./ExportPanel";
import { PreviewPanel } from "./PreviewPanel";
import { ScriptPanel } from "./ScriptPanel";
import { Button } from "./ui";
import { parseScript } from "../lib/parser";
import { composePrompt } from "../lib/prompt";
import { generateImage, fileToDataUrl } from "../lib/generate";
import { loadProjects, saveProjects } from "../lib/storage";
import { SAMPLE_SCRIPT } from "../lib/sample";
import { uid, type Project, type Shot, type TabId } from "../lib/types";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "script", label: "剧本" },
  { id: "cast", label: "角色" },
  { id: "board", label: "分镜" },
  { id: "preview", label: "预览" },
  { id: "export", label: "导出" },
];

const DEFAULT_STYLE =
  "cinematic short drama still, moody practical lighting, 35mm lens, shallow depth of field, film grain, photorealistic";

interface Toast {
  message: string;
  tone: "ok" | "error";
}

export function Studio() {
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [activeId, setActiveId] = useState<string>(() => projects[0]?.id ?? "");
  const [tab, setTab] = useState<TabId>("script");
  const [toast, setToast] = useState<Toast | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

  const project = projects.find((item) => item.id === activeId) ?? projects[0];

  const notify = useCallback((message: string, tone: "ok" | "error" = "ok") => {
    setToast({ message, tone });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    try {
      saveProjects(projects);
      setStorageWarning(null);
    } catch (error) {
      setStorageWarning(error instanceof Error ? error.message : "本地保存失败");
    }
  }, [projects]);

  const updateProject = useCallback(
    (patch: Partial<Project>) => {
      if (!project) return;
      setProjects((prev) =>
        prev.map((item) =>
          item.id === project.id ? { ...item, ...patch, updatedAt: Date.now() } : item,
        ),
      );
    },
    [project],
  );

  const patchShot = useCallback(
    (id: string, patch: Partial<Shot>) => {
      if (!project) return;
      updateProject({
        shots: project.shots.map((shot) => (shot.id === id ? { ...shot, ...patch } : shot)),
      });
    },
    [project, updateProject],
  );

  const handleSplit = useCallback(() => {
    if (!project) return;
    const drafts = parseScript(project.script);
    if (drafts.length === 0) {
      notify("剧本里还没有可拆分的内容", "error");
      return;
    }
    const shots: Shot[] = drafts.map((draft, index) => {
      const previous = project.shots[index];
      return {
        id: previous?.id ?? uid("shot"),
        index,
        scene: draft.scene,
        action: draft.action,
        dialogue: draft.dialogue,
        prompt: previous?.prompt ?? "",
        duration: previous?.duration ?? 4,
        seed: previous?.seed ?? 1000 + index,
        image: previous?.image,
        status: previous?.image ? "ready" : "idle",
        error: previous?.image ? undefined : previous?.error,
      };
    });
    updateProject({ shots });
    setTab("board");
    notify(`已拆分为 ${shots.length} 个镜头`);
  }, [notify, project, updateProject]);

  const generateOne = useCallback(
    async (shot: Shot): Promise<boolean> => {
      if (!project) return false;
      const prompt = shot.prompt.trim() || composePrompt(project, shot);
      patchShot(shot.id, { status: "generating", prompt, error: undefined });
      try {
        const image = await generateImage(prompt, project.aspect, shot.seed);
        patchShot(shot.id, { status: "ready", image, error: undefined });
        return true;
      } catch (error) {
        patchShot(shot.id, {
          status: "error",
          error: error instanceof Error ? error.message : "生成失败",
        });
        return false;
      }
    },
    [patchShot, project],
  );

  const handleGenerateAll = useCallback(async () => {
    if (!project || generatingAll) return;
    setGeneratingAll(true);
    let index = 0;
    for (const shot of project.shots) {
      if (shot.image) continue;
      const ok = await generateOne(shot);
      index += 1;
      if (!ok) {
        notify("生成中断：免费端点有频率限制，可稍后逐张重试或上传图片", "error");
        break;
      }
      if (index < project.shots.length) {
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }
    }
    setGeneratingAll(false);
  }, [generateOne, generatingAll, notify, project]);

  const handleUpload = useCallback(
    async (id: string, file: File) => {
      try {
        const dataUrl = await fileToDataUrl(file);
        patchShot(id, { image: dataUrl, status: "ready", error: undefined });
        notify("已上传镜头图片");
      } catch {
        notify("图片读取失败", "error");
      }
    },
    [notify, patchShot],
  );

  const createProject = useCallback(() => {
    const fresh: Project = {
      id: uid("proj"),
      title: "未命名短剧",
      logline: "",
      style: DEFAULT_STYLE,
      aspect: "9:16",
      script: "",
      characters: [],
      shots: [],
      updatedAt: Date.now(),
    };
    setProjects((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    setTab("script");
  }, []);

  const importProject = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const data = JSON.parse(text) as Project;
        if (!data || typeof data.title !== "string" || !Array.isArray(data.shots)) {
          throw new Error("文件不是有效的 StoryLoom 项目");
        }
        const imported: Project = {
          ...data,
          id: uid("proj"),
          characters: Array.isArray(data.characters) ? data.characters : [],
          updatedAt: Date.now(),
        };
        setProjects((prev) => [imported, ...prev]);
        setActiveId(imported.id);
        notify("项目已导入");
      } catch (error) {
        notify(error instanceof Error ? error.message : "导入失败", "error");
      }
    },
    [notify],
  );

  if (!project) {
    return <div className="p-10 text-white/60">没有项目，刷新页面会创建示例。</div>;
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-3 px-4">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-amber-300 to-amber-500 text-[13px] font-black text-ink-950">
            SL
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold leading-tight text-white">StoryLoom</p>
            <p className="text-[10px] text-white/35">AI 短剧分镜工坊</p>
          </div>
          <div className="ml-2 hidden items-center gap-1.5 md:flex">
            <span className="chip">本地保存</span>
            <span className="chip">{project.shots.length} 镜头</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <select
              aria-label="切换项目"
              value={project.id}
              onChange={(event) => setActiveId(event.target.value)}
              className="field w-32 lg:hidden"
            >
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title || "未命名"}
                </option>
              ))}
            </select>
            {storageWarning ? (
              <span className="hidden text-[10.5px] text-rose-300 sm:inline">{storageWarning}</span>
            ) : null}
            <Button onClick={() => importRef.current?.click()}>导入</Button>
            <Button variant="primary" onClick={createProject}>+ 新项目</Button>
            <input
              ref={importRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importProject(file);
                event.target.value = "";
              }}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1500px] flex-1 gap-4 px-4 py-4">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="panel p-2">
            <p className="px-1.5 pb-1.5 text-[10px] uppercase tracking-wider text-white/30">项目</p>
            <div className="scroll-thin max-h-[65vh] space-y-1 overflow-y-auto">
              {projects.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  className={`w-full rounded-lg px-2 py-1.5 text-left transition ${
                    item.id === project.id ? "bg-white/[0.07] text-white" : "text-white/55 hover:bg-white/5"
                  }`}
                >
                  <span className="block truncate text-[12px]">{item.title || "未命名"}</span>
                  <span className="text-[10px] text-white/30">{item.shots.length} 镜头</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              value={project.title}
              onChange={(event) => updateProject({ title: event.target.value })}
              className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 py-1 text-lg font-semibold text-white outline-none transition hover:border-white/10 focus:border-white/20"
              aria-label="片名"
            />
            <div className="seg flex rounded-lg border border-white/10 bg-ink-900/60 p-0.5">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`rounded-[7px] px-3 py-1.5 text-[12px] transition ${
                    tab === item.id ? "bg-amber-400/20 text-amber-100 ring-1 ring-inset ring-amber-400/30" : "text-white/50 hover:text-white/80"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {tab === "script" ? (
            <ScriptPanel
              project={project}
              patch={updateProject}
              onSplit={handleSplit}
              onLoadSample={() => {
                updateProject({ script: SAMPLE_SCRIPT });
                notify("示例剧本已填入，点「拆分为分镜」继续");
              }}
            />
          ) : null}
          {tab === "cast" ? <CastPanel project={project} patch={updateProject} /> : null}
          {tab === "board" ? (
            <BoardPanel
              project={project}
              generatingAll={generatingAll}
              patchShot={patchShot}
              onGenerate={(id) => {
                const shot = project.shots.find((item) => item.id === id);
                if (shot) void generateOne(shot);
              }}
              onGenerateAll={() => void handleGenerateAll()}
              onSuggest={(id) => {
                const shot = project.shots.find((item) => item.id === id);
                if (shot) patchShot(id, { prompt: composePrompt(project, shot) });
              }}
              onSuggestAll={() => {
                updateProject({
                  shots: project.shots.map((shot) =>
                    shot.prompt.trim() ? shot : { ...shot, prompt: composePrompt(project, shot) },
                  ),
                });
                notify("已补齐空提示词");
              }}
              onUpload={(id, file) => void handleUpload(id, file)}
              onDelete={(id) => {
                const shots = project.shots
                  .filter((shot) => shot.id !== id)
                  .map((shot, index) => ({ ...shot, index }));
                updateProject({ shots });
              }}
              onOpenPreview={() => setTab("preview")}
            />
          ) : null}
          {tab === "preview" ? <PreviewPanel project={project} /> : null}
          {tab === "export" ? <ExportPanel project={project} notify={notify} /> : null}
        </main>
      </div>

      {toast ? (
        <div
          className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border px-4 py-2 text-[12px] shadow-2xl ${
            toast.tone === "error"
              ? "border-rose-400/30 bg-rose-500/15 text-rose-100"
              : "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
