import { ASPECT_LABEL, type Aspect, type Project } from "../lib/types";
import { Button, Select, TextArea, TextInput } from "./ui";

interface Props {
  project: Project;
  patch: (patch: Partial<Project>) => void;
  onSplit: () => void;
  onLoadSample: () => void;
}

export function ScriptPanel({ project, patch, onSplit, onLoadSample }: Props) {
  const chars = project.script.length;
  const estimated = project.script
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0).length;

  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            label="片名"
            value={project.title}
            onChange={(event) => patch({ title: event.target.value })}
            placeholder="例如：第三夜"
          />
          <Select
            label="画幅"
            value={project.aspect}
            onChange={(event) => patch({ aspect: event.target.value as Aspect })}
          >
            {(Object.keys(ASPECT_LABEL) as Aspect[]).map((aspect) => (
              <option key={aspect} value={aspect}>
                {ASPECT_LABEL[aspect]}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-3">
          <TextArea
            label="一句话梗概"
            rows={2}
            value={project.logline}
            onChange={(event) => patch({ logline: event.target.value })}
            placeholder="谁，在什么处境下，做了什么，代价是什么。"
          />
        </div>
        <div className="mt-3">
          <TextArea
            label="视觉风格（会拼进每条提示词）"
            rows={2}
            value={project.style}
            onChange={(event) => patch({ style: event.target.value })}
            placeholder="dark bedroom at night, cold blue phone light, 35mm, film grain…"
          />
        </div>
      </section>

      <section className="panel p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[13px] font-semibold text-white/85">剧本</h2>
            <p className="mt-0.5 text-[11px] text-white/40">
              场景行（内景/外景/第 N 场）另起一段，空行分镜，「角色：台词」会自动识别。
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button onClick={onLoadSample}>载入示例</Button>
            <Button variant="primary" onClick={onSplit}>
              拆分为分镜
            </Button>
          </div>
        </div>
        <TextArea
          rows={16}
          value={project.script}
          onChange={(event) => patch({ script: event.target.value })}
          placeholder={"内景 卧室 夜\n\n手机在床头亮起。\n\n他拿起手机。\n\n陈默：这是谁拍的？"}
          className="font-mono text-[12px]"
        />
        <div className="mt-2 flex items-center justify-between text-[10.5px] text-white/35">
          <span>
            {chars} 字 · {estimated} 个非空行 · 当前 {project.shots.length} 个分镜
          </span>
          <span>拆分后会覆盖分镜列表，图片按序号尽量保留</span>
        </div>
      </section>
    </div>
  );
}
