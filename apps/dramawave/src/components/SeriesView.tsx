import { fenToYuan, splitRevenue } from "../lib/money";
import type { AppData, Episode } from "../lib/types";
import { Button, Empty } from "./ui";

interface Props {
  data: AppData;
  seriesId: string;
  unlocked: Set<string | undefined>;
  onBack: () => void;
  onPlay: (episode: Episode) => void;
  onUnlock: (episode: Episode) => void;
  onCreator: () => void;
}

export function SeriesView({ data, seriesId, unlocked, onBack, onPlay, onUnlock, onCreator }: Props) {
  const series = data.series.find((item) => item.id === seriesId);
  if (!series) {
    return (
      <Empty title="找不到这部剧" hint="它可能已经被创作者删除。" />
    );
  }
  const isMine = series.creator === data.creatorName;
  // 观众只看到已发布剧集；创作者自己仍能看到草稿并管理。
  const episodes = data.episodes
    .filter((episode) => episode.seriesId === series.id && (episode.published || isMine))
    .sort((a, b) => a.number - b.number);
  const totalViews = episodes.reduce((sum, episode) => sum + (data.views[episode.id] ?? 0), 0);

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="text-[12px] text-white/50 hover:text-white">
        ← 返回发现
      </button>

      <section className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
        <div className="aspect-[2/3] overflow-hidden rounded-2xl border border-white/10">
          <img src={series.cover} alt={series.title} className="h-full w-full object-cover" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            {series.tags.map((tag) => (
              <span key={tag} className="chip">{tag}</span>
            ))}
          </div>
          <h1 className="mt-2 text-2xl font-semibold">{series.title}</h1>
          <p className="mt-1 text-[11.5px] text-white/40">
            {series.creator} · {episodes.length} 集 · {totalViews} 次播放
          </p>
          <p className="mt-3 max-w-xl text-[12.5px] leading-relaxed text-white/60">{series.synopsis}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {episodes[0] ? (
              <Button variant="primary" onClick={() => onPlay(episodes[0]!)}>
                ▶ 从第 1 集开始
              </Button>
            ) : null}
            {isMine ? (
              <Button onClick={onCreator}>管理这部剧</Button>
            ) : (
              <span className="chip">创作者分成 99% · 平台 1%</span>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[13px] font-semibold text-white/80">剧集列表</h2>
        <div className="space-y-1.5">
          {episodes.map((episode) => {
            const free = episode.priceCoins === 0;
            const owned = free || unlocked.has(episode.id);
            const views = data.views[episode.id] ?? 0;
            const split = splitRevenue(episode.priceCoins);
            return (
              <div
                key={episode.id}
                className="card flex items-center gap-3 px-3 py-2.5"
              >
                <span className="w-7 text-center text-[12px] tabular-nums text-white/35">{episode.number}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] text-white/85">
                    {episode.title}
                    {!episode.published ? <span className="ml-2 text-[10px] text-amber-300/80">未发布</span> : null}
                  </p>
                  <p className="text-[10.5px] text-white/30">
                    {free ? "免费" : `${episode.priceCoins} 币 · ¥${fenToYuan(split.grossFen)}`} · {views} 次播放
                  </p>
                </div>
                {owned ? (
                  <Button variant="primary" onClick={() => onPlay(episode)}>
                    {free ? "观看" : "继续观看"}
                  </Button>
                ) : (
                  <Button onClick={() => onUnlock(episode)}>解锁 {episode.priceCoins} 币</Button>
                )}
              </div>
            );
          })}
        </div>
        {episodes.length === 0 ? <Empty title="还没有剧集" hint="创作者还没有上传内容。" /> : null}
      </section>
    </div>
  );
}
