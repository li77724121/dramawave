import { useMemo, useState } from "react";
import type { AppData, Episode } from "../lib/types";
import { Button } from "./ui";

interface Props {
  data: AppData;
  unlocked: Set<string | undefined>;
  onOpenSeries: (id: string) => void;
  onPlay: (episode: Episode) => void;
}

export function Home({ data, unlocked, onOpenSeries, onPlay }: Props) {
  // 只展示真正有已发布剧集的剧，避免空剧集或整季下架后还挂在首页。
  const published = data.series.filter(
    (series) =>
      series.published &&
      data.episodes.some((episode) => episode.seriesId === series.id && episode.published),
  );
  const tags = useMemo(
    () => Array.from(new Set(published.flatMap((series) => series.tags))).slice(0, 8),
    [published],
  );
  const [tag, setTag] = useState<string>("全部");

  const featured = published[0];
  const featuredEpisodes = featured
    ? data.episodes.filter((episode) => episode.seriesId === featured.id && episode.published).sort((a, b) => a.number - b.number)
    : [];
  const featuredFirst = featuredEpisodes[0];

  const visible = tag === "全部" ? published : published.filter((series) => series.tags.includes(tag));

  const continueItems = data.history
    .map((item) => data.episodes.find((episode) => episode.id === item.episodeId))
    .filter(
      (episode): episode is Episode =>
        Boolean(
          episode?.published &&
            data.series.some((series) => series.id === episode.seriesId && series.published),
        ),
    )
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {featured ? (
        <section className="relative overflow-hidden rounded-3xl border border-white/10">
          <img src={featured.cover} alt={featured.title} className="absolute inset-0 h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/80 to-transparent" />
          <div className="relative flex flex-col gap-3 p-6 sm:p-8">
            <span className="chip w-fit border-rose-400/30 bg-rose-500/15 text-rose-200">本周主推</span>
            <h1 className="max-w-lg text-2xl font-semibold leading-tight sm:text-3xl">{featured.title}</h1>
            <p className="max-w-lg text-[12.5px] leading-relaxed text-white/60">{featured.synopsis}</p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/40">
              <span>{featured.creator}</span>
              <span>·</span>
              <span>{featuredEpisodes.length} 集</span>
              <span>·</span>
              <span>{featuredEpisodes[0]?.priceCoins === 0 ? "首集免费" : "付费"}</span>
            </div>
            <div className="mt-1 flex gap-2">
              {featuredFirst ? (
                <Button variant="primary" onClick={() => onPlay(featuredFirst)}>
                  ▶ 立即观看
                </Button>
              ) : null}
              <Button onClick={() => onOpenSeries(featured.id)}>剧集详情</Button>
            </div>
          </div>
        </section>
      ) : null}

      {continueItems.length > 0 ? (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-white/80">继续观看</h2>
            <span className="text-[10.5px] text-white/30">只记录在本机</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {continueItems.map((episode) => {
              const series = data.series.find((item) => item.id === episode.seriesId);
              const locked = episode.priceCoins > 0 && !unlocked.has(episode.id);
              return (
                <button
                  key={episode.id}
                  type="button"
                  onClick={() => onPlay(episode)}
                  className="card flex items-center gap-2 p-2 text-left transition hover:border-white/20"
                >
                  <img src={series?.cover} alt="" className="h-14 w-10 rounded object-cover" />
                  <span className="min-w-0">
                    <span className="block truncate text-[11.5px] text-white/80">{series?.title}</span>
                    <span className="block text-[10px] text-white/35">
                      第 {episode.number} 集 {locked ? "· 待解锁" : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <h2 className="mr-2 text-[13px] font-semibold text-white/80">全部剧集</h2>
          {["全部", ...tags].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTag(item)}
              className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                tag === item ? "bg-white text-ink-950" : "border border-white/10 text-white/50 hover:text-white"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((series) => {
            const eps = data.episodes.filter((episode) => episode.seriesId === series.id && episode.published);
            return (
              <button
                key={series.id}
                type="button"
                onClick={() => onOpenSeries(series.id)}
                className="group text-left"
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10">
                  <img
                    src={series.cover}
                    alt={series.title}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-6">
                    <p className="text-[11px] text-white/70">{eps.length} 集</p>
                  </div>
                  {eps.some((episode) => episode.priceCoins === 0) ? (
                    <span className="absolute left-2 top-2 rounded bg-rose-500 px-1.5 py-0.5 text-[9.5px] font-semibold text-white">
                      首集免费
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 truncate text-[12.5px] font-medium text-white/85">{series.title}</p>
                <p className="truncate text-[10.5px] text-white/35">{series.creator}</p>
              </button>
            );
          })}
        </div>
        {visible.length === 0 ? (
          <p className="py-10 text-center text-[12px] text-white/35">这个标签下还没有剧集。</p>
        ) : null}
      </section>
    </div>
  );
}
