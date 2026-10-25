import { useMemo, useState } from "react";
import { fenToYuan, splitRevenue } from "../lib/money";
import { fileToCover } from "../lib/image";
import { parseStoryloomProject, renderStoryloomVideo, type StoryloomProject } from "../lib/storyloom";
import { log } from "../lib/logger";
import { demoAsset, isLocalDevHost } from "../lib/assets";
import type { AppData, Episode, Series } from "../lib/types";
import type { AppActions } from "../App";
import { Button, Empty, Modal, TextArea, TextInput } from "./ui";

interface Props {
  data: AppData;
  actions: AppActions;
}

export function Creator({ data, actions }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(data.creatorName);
  const [form, setForm] = useState({ title: "", synopsis: "", tags: "", cover: "" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [parsed, setParsed] = useState<StoryloomProject | null>(null);
  const [importPrice, setImportPrice] = useState(20);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  // 本机用 5210；GitHub Pages 下剧浪在 /dramawave/，同级 storyloom/ 即分镜工坊。
  const storyloomUrl = isLocalDevHost()
    ? `${window.location.protocol}//${window.location.hostname}:5210/`
    : new URL("storyloom/", window.location.href).href;

  const mySeries = useMemo(
    () => data.series.filter((series) => series.creator === data.creatorName),
    [data.series, data.creatorName],
  );
  const myIds = useMemo(() => new Set(mySeries.map((series) => series.id)), [mySeries]);
  const myEpisodes = useMemo(
    () => data.episodes.filter((episode) => myIds.has(episode.seriesId)),
    [data.episodes, myIds],
  );
  const unlocks = useMemo(
    () => data.ledger.filter((entry) => entry.type === "unlock" && entry.seriesId && myIds.has(entry.seriesId)),
    [data.ledger, myIds],
  );
  const payouts = useMemo(() => data.ledger.filter((entry) => entry.type === "payout"), [data.ledger]);

  const gross = unlocks.reduce((sum, entry) => sum + entry.grossFen, 0);
  const fee = unlocks.reduce((sum, entry) => sum + entry.feeFen, 0);
  const net = unlocks.reduce((sum, entry) => sum + entry.creatorFen, 0);
  const paidOut = payouts.reduce((sum, entry) => sum - entry.creatorFen, 0);
  const available = Math.max(0, net - paidOut);
  const views = myEpisodes.reduce((sum, episode) => sum + (data.views[episode.id] ?? 0), 0);

  const createSeries = () => {
    if (!form.title.trim()) {
      actions.notify("先给剧集起个名字", "error");
      return;
    }
    const id = actions.createSeries({
      title: form.title,
      synopsis: form.synopsis,
      tags: form.tags.split(/[,，\s]+/).filter(Boolean),
      cover: form.cover || demoAsset("cover1.jpg"),
    });
    setCreateOpen(false);
    setForm({ title: "", synopsis: "", tags: "", cover: "" });
    setExpanded(id);
    actions.notify("剧集已创建，接着上传第一集");
  };

  return (
    <div className="space-y-5">
      <section className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <TextInput
              label="创作者 / 工作室"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={() => nameDraft.trim() && actions.setCreatorName(nameDraft.trim())}
              placeholder="你的工作室"
            />
          </div>
          <Button variant="primary" onClick={() => setImportOpen(true)}>从 StoryLoom 导入</Button>
          <Button onClick={() => setCreateOpen(true)}>+ 新建剧集</Button>
          <Button disabled={available <= 0} onClick={() => actions.withdraw(available)}>
            申请提现 ¥{fenToYuan(available)}
          </Button>
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-white/35">
          平台按每集解锁收入的 1% 抽成，其余 99% 计入创作者余额。提现为演示操作，不会真实打款。
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "总播放", value: views.toLocaleString("zh-CN") },
          { label: "解锁次数", value: String(unlocks.length) },
          { label: "总收入", value: `¥${fenToYuan(gross)}` },
          { label: "平台抽成 1%", value: `¥${fenToYuan(fee)}` },
          { label: "可提现", value: `¥${fenToYuan(available)}` },
        ].map((item) => (
          <div key={item.label} className="card p-3.5">
            <p className="text-[10.5px] uppercase tracking-wider text-white/35">{item.label}</p>
            <p className="mt-1 text-lg font-semibold text-white">{item.value}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-[13px] font-semibold text-white/80">我的剧集</h2>
        {mySeries.length === 0 ? (
          <Empty title="还没有剧集" hint="点「新建剧集」，填好封面和简介后上传第一集。" />
        ) : (
          <div className="space-y-2">
            {mySeries.map((series) => (
              <SeriesRow
                key={series.id}
                series={series}
                data={data}
                expanded={expanded === series.id}
                onToggle={() => setExpanded(expanded === series.id ? null : series.id)}
                actions={actions}
              />
            ))}
          </div>
        )}
      </section>


      <Modal
        open={importOpen}
        title="从 StoryLoom 导入"
        onClose={() => {
          if (rendering) return;
          setImportOpen(false);
          setParsed(null);
          setProgress(0);
        }}
      >
        <div className="space-y-3 text-[12px] text-white/65">
          {!parsed ? (
            <>
              <p>选择 StoryLoom 导出的项目 JSON（含已生成的分镜图），剧浪会在浏览器里合成竖屏视频并发布。</p>
              <input
                type="file"
                accept="application/json,.json"
                className="field"
                onChange={(event) => {
                  const input = event.currentTarget;
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void file
                    .text()
                    .then((text) => {
                      const project = parseStoryloomProject(text);
                      setParsed(project);
                      setProgress(0);
                      log.info(
                        "import",
                        "解析 StoryLoom 项目成功",
                        `《${project.title}》· ${project.shots.length} 镜 · ${project.shots.reduce((sum, shot) => sum + shot.duration, 0)} 秒`,
                      );
                    })
                    .catch((error) => {
                      log.error("import", "解析 StoryLoom 项目失败", error);
                      actions.notify(error instanceof Error ? error.message : "导入失败", "error");
                    })
                    // 清空 input，方便修正后重新选同一个文件
                    .finally(() => {
                      input.value = "";
                    });
                }}
              />
              <p className="text-[10.5px] text-white/30">
                还没有项目？去{" "}
                <a
                  href={storyloomUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-rose-300 underline decoration-rose-300/40 underline-offset-2 hover:text-rose-200"
                >
                  StoryLoom
                </a>{" "}
                完成分镜后，在「导出」页点「发布到剧浪」。
              </p>
            </>
          ) : (
            <>
              <div className="flex gap-3">
                <img src={parsed.shots[0]?.image} alt="" className="h-24 w-14 rounded object-cover" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-white">{parsed.title}</p>
                  <p className="mt-1 line-clamp-3 text-[11px] text-white/45">{parsed.logline || "无简介"}</p>
                  <p className="mt-1 text-[10.5px] text-white/30">
                    {parsed.shots.length} 个分镜 · {parsed.shots.reduce((sum, shot) => sum + shot.duration, 0)} 秒
                  </p>
                </div>
              </div>

              <label className="block">
                <span className="label">首集价格（币）</span>
                <input
                  type="number"
                  min={0}
                  max={9999}
                  value={importPrice}
                  onChange={(event) => setImportPrice(Math.min(9999, Math.max(0, Number(event.target.value) || 0)))}
                  className="field"
                />
              </label>

              {rendering ? (
                <div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[10.5px] text-white/40">
                    正在合成视频 {Math.round(progress * 100)}%（实时录制，约等于成片时长）
                  </p>
                </div>
              ) : null}

              <div className="flex gap-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  disabled={rendering}
                  onClick={() => {
                    void (async () => {
                      setRendering(true);
                      setProgress(0);
                      const startedAt = performance.now();
                      log.info("render", "开始合成视频", `《${parsed.title}》· ${parsed.shots.length} 镜`);
                      try {
                        const blob = await renderStoryloomVideo(parsed, setProgress);
                        log.info(
                          "render",
                          "视频合成完成",
                          `${(blob.size / 1024).toFixed(0)}KB · 耗时 ${Math.round(performance.now() - startedAt)}ms`,
                        );
                        const id = await actions.publishImported({
                          title: parsed.title,
                          synopsis: parsed.logline,
                          cover: parsed.shots[0]?.image ?? demoAsset("cover1.jpg"),
                          blob,
                          priceCoins: importPrice,
                        });
                        actions.notify("已合成并发布到剧浪");
                        setImportOpen(false);
                        setParsed(null);
                        setExpanded(id);
                      } catch (error) {
                        log.error("render", "合成或发布失败", error);
                        actions.notify(error instanceof Error ? error.message : "合成失败", "error");
                      } finally {
                        setRendering(false);
                      }
                    })();
                  }}
                >
                  {rendering ? "合成中…" : "合成并发布"}
                </Button>
                <Button disabled={rendering} onClick={() => setParsed(null)}>重选文件</Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal open={createOpen} title="新建剧集" onClose={() => setCreateOpen(false)}>
        <div className="space-y-3">
          <TextInput label="剧名" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <TextArea label="简介" rows={3} value={form.synopsis} onChange={(event) => setForm({ ...form, synopsis: event.target.value })} />
          <TextInput
            label="标签（逗号分隔）"
            value={form.tags}
            onChange={(event) => setForm({ ...form, tags: event.target.value })}
            placeholder="悬疑, 都市"
          />
          <label className="block">
            <span className="label">封面（9:16 图片，可选）</span>
            <input
              type="file"
              accept="image/*"
              className="field"
              onChange={(event) => {
                const input = event.currentTarget;
                const file = event.target.files?.[0];
                if (!file) return;
                void fileToCover(file)
                  .then((cover) => setForm((prev) => ({ ...prev, cover })))
                  .catch(() => {
                    log.error("creator", "封面处理失败", `${file.name} · ${file.type}`);
                    actions.notify("封面处理失败", "error");
                  })
                  .finally(() => {
                    input.value = "";
                  });
              }}
            />
          </label>
          <Button variant="primary" className="w-full" onClick={createSeries}>创建</Button>
        </div>
      </Modal>
    </div>
  );
}

function SeriesRow({
  series,
  data,
  expanded,
  onToggle,
  actions,
}: {
  series: Series;
  data: AppData;
  expanded: boolean;
  onToggle: () => void;
  actions: AppActions;
}) {
  const episodes = data.episodes
    .filter((episode) => episode.seriesId === series.id)
    .sort((a, b) => a.number - b.number);
  const unlocks = data.ledger.filter((entry) => entry.type === "unlock" && entry.seriesId === series.id);
  const net = unlocks.reduce((sum, entry) => sum + entry.creatorFen, 0);

  return (
    <div className="card overflow-hidden">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-left">
        <img src={series.cover} alt="" className="h-16 w-11 rounded object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-white/85">{series.title}</p>
          <p className="text-[10.5px] text-white/35">
            {episodes.length} 集 · {unlocks.length} 次解锁 · 净收入 ¥{fenToYuan(net)}
          </p>
        </div>
        <span className={`text-[10.5px] ${series.published ? "text-emerald-300" : "text-amber-300"}`}>
          {series.published ? "已发布" : "草稿"}
        </span>
        <span className="text-[11px] text-white/30">{expanded ? "收起" : "管理"}</span>
      </button>

      {expanded ? (
        <div className="border-t border-white/5 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Button onClick={() => actions.updateSeries(series.id, { published: !series.published })}>
              {series.published ? "下架" : "发布"}
            </Button>
            <Button
              variant="plain"
              className="text-rose-300/70"
              onClick={() => {
                if (window.confirm(`删除《${series.title}》及全部剧集？`)) actions.deleteSeries(series.id);
              }}
            >
              删除剧集
            </Button>
          </div>

          <div className="space-y-1.5">
            {episodes.map((episode) => (
              <EpisodeRow key={episode.id} episode={episode} data={data} actions={actions} />
            ))}
          </div>

          <EpisodeUpload seriesId={series.id} actions={actions} />
        </div>
      ) : null}
    </div>
  );
}

function EpisodeRow({ episode, data, actions }: { episode: Episode; data: AppData; actions: AppActions }) {
  const unlocks = data.ledger.filter((entry) => entry.type === "unlock" && entry.episodeId === episode.id);
  const net = unlocks.reduce((sum, entry) => sum + entry.creatorFen, 0);
  const split = splitRevenue(episode.priceCoins);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-ink-900/50 px-2.5 py-2">
      <span className="w-6 text-center text-[11px] text-white/30">{episode.number}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] text-white/80">{episode.title}</p>
        <p className="text-[10px] text-white/30">
          {episode.priceCoins === 0 ? "免费" : `${episode.priceCoins} 币 · 平台 ¥${fenToYuan(split.feeFen)}`} ·{" "}
          {data.views[episode.id] ?? 0} 播放 · {unlocks.length} 解锁 · 净 ¥{fenToYuan(net)}
        </p>
      </div>
      <Button onClick={() => actions.updateEpisode(episode.id, { published: !episode.published })}>
        {episode.published ? "下架" : "发布"}
      </Button>
      <Button
        variant="plain"
        className="text-rose-300/60"
        onClick={() => {
          if (window.confirm(`删除第 ${episode.number} 集？`)) actions.deleteEpisode(episode.id);
        }}
      >
        删除
      </Button>
    </div>
  );
}

function EpisodeUpload({ seriesId, actions }: { seriesId: string; actions: AppActions }) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState(20);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!file) {
      actions.notify("先选择一个视频文件", "error");
      return;
    }
    setBusy(true);
    try {
      await actions.addEpisode(seriesId, { title, priceCoins: price, file });
      setTitle("");
      setFile(null);
    } catch (error) {
      log.error("upload", "上传失败", error);
      actions.notify(error instanceof Error ? error.message : "上传失败", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-dashed border-white/12 p-3">
      <p className="mb-2 text-[11px] text-white/45">上传新一集（视频只存在本地浏览器）</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_90px_auto]">
        <TextInput placeholder="本集标题" value={title} onChange={(event) => setTitle(event.target.value)} />
        <TextInput
          type="number"
          min={0}
          max={9999}
          value={price}
          onChange={(event) => setPrice(Math.min(9999, Math.max(0, Number(event.target.value) || 0)))}
          aria-label="价格（币）"
        />
        <label className="btn-ghost cursor-pointer justify-center">
          选择视频
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              // 允许再次选择同一个文件
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="truncate text-[10.5px] text-white/35">{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)}MB` : "未选择文件"}</span>
        <Button variant="primary" className="ml-auto" disabled={busy} onClick={() => void submit()}>
          {busy ? "上传中…" : "上传并发布"}
        </Button>
      </div>
    </div>
  );
}
