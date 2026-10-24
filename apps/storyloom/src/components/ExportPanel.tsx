import type { Project } from "../lib/types";
import { downloadProjectJson, downloadZip, toCsv, toSrt, downloadBlob } from "../lib/exporters";
import { log } from "../lib/logger";
import { Button } from "./ui";

interface Props {
  project: Project;
  notify: (message: string, tone?: "ok" | "error") => void;
}

export function ExportPanel({ project, notify }: Props) {
  const ready = project.shots.filter((shot) => shot.image).length;
  const total = project.shots.reduce((sum, shot) => sum + shot.duration, 0);

  const exportCsv = () => {
    const blob = new Blob([toCsv(project)], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `${project.title || "project"}-shotlist.csv`);
    log.info("export", "导出分镜表 CSV", `${project.shots.length} 行`);
    notify("分镜表已导出");
  };

  const exportSrt = () => {
    const blob = new Blob([toSrt(project)], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `${project.title || "project"}.srt`);
    log.info("export", "导出字幕 SRT", `${project.shots.length} 条`);
    notify("字幕已导出");
  };

  const exportZip = async () => {
    try {
      const startedAt = performance.now();
      await downloadZip(project);
      log.info("export", "导出素材包 ZIP", `${ready} 张图 · ${Math.round(performance.now() - startedAt)}ms`);
      notify("素材包已导出");
    } catch (error) {
      log.error("export", "导出素材包失败", error);
      notify(error instanceof Error ? error.message : "导出失败", "error");
    }
  };

  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <h2 className="text-[13px] font-semibold text-white/85">交付</h2>
        <p className="mt-1 text-[11.5px] leading-relaxed text-white/45">
          当前项目 {project.shots.length} 个镜头，已出图 {ready} 个，总时长 {total} 秒。
          导出物可直接交给剪辑，也可以作为下一轮生成的素材。
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button
            variant="primary"
            onClick={() => {
              downloadProjectJson(project);
              log.info("export", "导出项目 JSON（发布到剧浪）", project.title);
              notify("已导出项目 JSON，去剧浪创作者中心导入即可合成视频");
            }}
          >
            发布到剧浪（导出项目 JSON）
          </Button>
          <a
            className="btn-ghost justify-center"
            href="http://127.0.0.1:5220"
            target="_blank"
            rel="noreferrer"
          >
            打开剧浪平台 ↗
          </a>
          <Button variant="primary" onClick={() => void exportZip()} disabled={ready === 0}>
            下载素材包 ZIP（图片 + 表格 + 字幕 + 提示词）
          </Button>
          <Button onClick={() => downloadProjectJson(project)}>项目 JSON（可再导入）</Button>
          <Button onClick={exportCsv}>分镜表 CSV</Button>
          <Button onClick={exportSrt}>字幕 SRT</Button>
        </div>

        {ready === 0 ? (
          <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">
            还没有任何镜头图片，素材包暂时不可用。先在分镜板生成或上传至少一张。
          </p>
        ) : null}
      </section>

      <section className="panel p-4">
        <h3 className="text-[12px] font-semibold text-white/80">导出内容说明</h3>
        <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-white/45">
          <li>· <span className="text-white/70">shots/</span>：按镜头序号命名的图片，尺寸取决于所选画幅。</li>
          <li>· <span className="text-white/70">shotlist.csv</span>：序号、场景、画面、对白、时长、提示词。</li>
          <li>· <span className="text-white/70">subtitles.srt</span>：按镜头时长累加生成，可直接拖进剪辑软件。</li>
          <li>· <span className="text-white/70">prompts.txt</span>：逐镜提示词，方便在别的模型里复现。</li>
        </ul>
      </section>
    </div>
  );
}
