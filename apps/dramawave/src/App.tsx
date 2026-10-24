import { useEffect, useMemo, useRef, useState } from "react";
import { Home } from "./components/Home";
import { SeriesView } from "./components/SeriesView";
import { Player } from "./components/Player";
import { Creator } from "./components/Creator";
import { WalletView } from "./components/Wallet";
import { LogPanel } from "./components/LogPanel";
import { Button, Modal, TextInput } from "./components/ui";
import { loadData, putBlob, saveData, deleteBlob } from "./lib/storage";
import { splitRevenue, formatCoins, fenToYuan } from "./lib/money";
import { dataUrlToCover } from "./lib/image";
import { log } from "./lib/logger";
import { uid, type AppData, type Episode, type Series } from "./lib/types";

export type Route =
  | { name: "home" }
  | { name: "series"; id: string }
  | { name: "wallet" }
  | { name: "creator" }
  | { name: "player"; episodeId: string };

export interface AppActions {
  openSeries: (id: string) => void;
  requestPlay: (episode: Episode) => void;
  recharge: () => void;
  setCreatorName: (name: string) => void;
  createSeries: (input: { title: string; synopsis: string; tags: string[]; cover: string }) => string;
  updateSeries: (id: string, patch: Partial<Series>) => void;
  deleteSeries: (id: string) => void;
  addEpisode: (seriesId: string, input: { title: string; priceCoins: number; file: File }) => Promise<void>;
  publishImported: (input: {
    title: string;
    synopsis: string;
    cover: string;
    blob: Blob;
    priceCoins: number;
  }) => Promise<string>;
  updateEpisode: (id: string, patch: Partial<Episode>) => void;
  deleteEpisode: (id: string) => void;
  withdraw: (fen: number) => void;
  notify: (message: string, tone?: "ok" | "error") => void;
}

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [route, setRoute] = useState<Route>({ name: "home" });
  const [toast, setToast] = useState<{ message: string; tone: "ok" | "error" } | null>(null);
  const [pending, setPending] = useState<Episode | null>(null);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [creatorDraft, setCreatorDraft] = useState("");
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    try {
      saveData(data);
      setStorageWarning(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "本地存储写入失败，可能是空间不足";
      setStorageWarning(message);
      log.error("storage", "本地数据保存失败", error);
    }
  }, [data]);

  const notify = (message: string, tone: "ok" | "error" = "ok") => {
    if (tone === "error") log.warn("ui", message);
    setToast({ message, tone });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };

  const unlocked = useMemo(
    () => new Set(data.ledger.filter((entry) => entry.type === "unlock").map((entry) => entry.episodeId)),
    [data.ledger],
  );

  const seriesById = useMemo(
    () => new Map(data.series.map((item) => [item.id, item])),
    [data.series],
  );

  const episodesOf = (seriesId: string) =>
    data.episodes
      .filter((episode) => episode.seriesId === seriesId && episode.published)
      .sort((a, b) => a.number - b.number);

  const openPlayer = (episode: Episode) => {
    log.info("play", `播放《${seriesById.get(episode.seriesId)?.title ?? "未知剧集"}》第 ${episode.number} 集`, `episode=${episode.id}`);
    setRoute({ name: "player", episodeId: episode.id });
    setData((prev) => ({
      ...prev,
      views: { ...prev.views, [episode.id]: (prev.views[episode.id] ?? 0) + 1 },
      history: [
        { episodeId: episode.id, at: Date.now() },
        ...prev.history.filter((item) => item.episodeId !== episode.id),
      ].slice(0, 12),
    }));
  };

  const requestPlay = (episode: Episode) => {
    if (!episode.published) {
      log.warn("play", "尝试播放未发布剧集", `episode=${episode.id}`);
      notify("这一集还没发布", "error");
      return;
    }
    if (episode.priceCoins === 0 || unlocked.has(episode.id)) {
      openPlayer(episode);
      return;
    }
    setPending(episode);
  };

  const confirmUnlock = () => {
    const episode = pending;
    if (!episode) return;
    if (data.wallet.balanceCoins < episode.priceCoins) {
      log.warn("wallet", "余额不足，转充值", `需要 ${episode.priceCoins} 币，当前 ${data.wallet.balanceCoins} 币`);
      setPending(null);
      setRechargeOpen(true);
      notify("余额不足，先充一点测试币", "error");
      return;
    }
    const split = splitRevenue(episode.priceCoins);
    const series = seriesById.get(episode.seriesId);
    setData((prev) => ({
      ...prev,
      wallet: { balanceCoins: prev.wallet.balanceCoins - episode.priceCoins },
      ledger: [
        {
          id: uid("led"),
          type: "unlock",
          at: Date.now(),
          ...split,
          seriesId: episode.seriesId,
          episodeId: episode.id,
          note: `解锁《${series?.title ?? "剧集"}》第 ${episode.number} 集`,
        },
        ...prev.ledger,
      ],
    }));
    setPending(null);
    openPlayer(episode);
    log.info("wallet", "解锁成功", `《${series?.title ?? "剧集"}》第 ${episode.number} 集 · ${episode.priceCoins} 币 · 平台 ${split.feeFen} 分 / 创作者 ${split.creatorFen} 分`);
    notify(`解锁成功，平台抽成 ¥${fenToYuan(split.feeFen)}`);
  };

  const recharge = () => {
    const coins = 300;
    setData((prev) => ({
      ...prev,
      wallet: { balanceCoins: prev.wallet.balanceCoins + coins },
      ledger: [
        {
          id: uid("led"),
          type: "recharge",
          at: Date.now(),
          grossFen: coins * 10,
          feeFen: 0,
          creatorFen: 0,
          note: "测试充值 300 币（不是真实支付）",
        },
        ...prev.ledger,
      ],
    }));
    setRechargeOpen(false);
    log.info("wallet", "测试充值", `+${coins} 币`);
    notify(`已充值 ${formatCoins(coins)}（测试）`);
  };

  const withdraw = (fen: number) => {
    if (fen <= 0) return;
    setData((prev) => ({
      ...prev,
      ledger: [
        {
          id: uid("led"),
          type: "payout",
          at: Date.now(),
          grossFen: -fen,
          feeFen: 0,
          creatorFen: -fen,
          note: "提现申请（测试环境，未真实打款）",
        },
        ...prev.ledger,
      ],
    }));
    log.info("wallet", "提交提现申请", `¥${fenToYuan(fen)}（测试）`);
    notify(`已提交提现 ¥${fenToYuan(fen)}（测试）`);
  };

  const actions: AppActions = {
    openSeries: (id) => setRoute({ name: "series", id }),
    requestPlay,
    recharge: () => setRechargeOpen(true),
    setCreatorName: (name) => setData((prev) => ({ ...prev, creatorName: name })),
    createSeries: (input) => {
      const series: Series = {
        id: uid("ser"),
        title: input.title.trim() || "未命名剧集",
        synopsis: input.synopsis,
        tags: input.tags,
        creator: data.creatorName || "我的工作室",
        cover: input.cover,
        published: true,
        createdAt: Date.now(),
      };
      setData((prev) => ({ ...prev, series: [series, ...prev.series] }));
      log.info("creator", "创建剧集", `${series.title} · ${series.id}`);
      return series.id;
    },
    updateSeries: (id, patch) => {
      log.info("creator", "更新剧集", `${id} · ${Object.keys(patch).join(",")}`);
      setData((prev) => ({
        ...prev,
        series: prev.series.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      }));
    },
    deleteSeries: (id) => {
      const episodes = data.episodes.filter((episode) => episode.seriesId === id);
      episodes.forEach((episode) => {
        if (episode.videoKey.startsWith("idb:")) void deleteBlob(episode.videoKey.slice(4));
      });
      setData((prev) => ({
        ...prev,
        series: prev.series.filter((item) => item.id !== id),
        episodes: prev.episodes.filter((episode) => episode.seriesId !== id),
      }));
      log.info("creator", "删除剧集", `${id} · 同时删除 ${episodes.length} 集`);
      setRoute({ name: "creator" });
    },
    addEpisode: async (seriesId, input) => {
      if (!input.file.type.startsWith("video/")) {
        log.warn("upload", "拒绝非视频文件", `${input.file.name} · ${input.file.type || "未知类型"}`);
        notify("请选择视频文件", "error");
        return;
      }
      if (input.file.size > 200 * 1024 * 1024) {
        log.warn("upload", "视频超过大小限制", `${input.file.name} · ${(input.file.size / 1024 / 1024).toFixed(1)}MB`);
        notify("视频超过 200MB，请压缩后再传", "error");
        return;
      }
      const id = uid("ep");
      const key = `video:${id}`;
      await putBlob(key, input.file);
      // 用最大集号 +1，避免删除中间集后出现重号
      const number =
        Math.max(
          0,
          ...data.episodes
            .filter((episode) => episode.seriesId === seriesId)
            .map((episode) => episode.number),
        ) + 1;
      const episode: Episode = {
        id,
        seriesId,
        number,
        title: input.title.trim() || `第 ${number} 集`,
        videoKey: `idb:${key}`,
        priceCoins: Math.min(9999, Math.max(0, Math.round(input.priceCoins))),
        published: true,
        createdAt: Date.now(),
      };
      setData((prev) => ({ ...prev, episodes: [...prev.episodes, episode] }));
      log.info("upload", "上传剧集成功", `${episode.title} · 第 ${number} 集 · ${(input.file.size / 1024 / 1024).toFixed(1)}MB`);
      notify("剧集已上传并发布");
    },
    publishImported: async (input) => {
      const seriesId = uid("ser");
      const episodeId = uid("ep");
      const key = `video:${episodeId}`;
      await putBlob(key, input.blob);
      const cover = await dataUrlToCover(input.cover).catch(() => "/demo/cover1.jpg");
      const series: Series = {
        id: seriesId,
        title: input.title,
        synopsis: input.synopsis,
        tags: ["StoryLoom"],
        creator: data.creatorName || "我的工作室",
        cover,
        published: true,
        createdAt: Date.now(),
      };
      const episode: Episode = {
        id: episodeId,
        seriesId,
        number: 1,
        title: "第 1 集",
        videoKey: `idb:${key}`,
        priceCoins: Math.min(9999, Math.max(0, Math.round(input.priceCoins))),
        published: true,
        createdAt: Date.now(),
      };
      setData((prev) => ({
        ...prev,
        series: [series, ...prev.series],
        episodes: [...prev.episodes, episode],
      }));
      log.info(
        "import",
        "StoryLoom 项目已发布",
        `《${series.title}》· ${(input.blob.size / 1024).toFixed(0)}KB · ${input.priceCoins} 币 · series=${seriesId}`,
      );
      return seriesId;
    },
    updateEpisode: (id, patch) => {
      log.info("creator", "更新剧集", `${id} · ${Object.keys(patch).join(",")}`);
      setData((prev) => ({
        ...prev,
        episodes: prev.episodes.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      }));
    },
    deleteEpisode: (id) => {
      const episode = data.episodes.find((item) => item.id === id);
      if (episode?.videoKey.startsWith("idb:")) void deleteBlob(episode.videoKey.slice(4));
      log.info("creator", "删除剧集", `${id} · ${episode?.title ?? "未知"}`);
      setData((prev) => ({ ...prev, episodes: prev.episodes.filter((item) => item.id !== id) }));
    },
    withdraw,
    notify,
  };

  const playerEpisode = route.name === "player" ? data.episodes.find((item) => item.id === route.episodeId) : null;
  const playerSeries = playerEpisode ? seriesById.get(playerEpisode.seriesId) : null;
  const playerList = playerEpisode ? episodesOf(playerEpisode.seriesId) : [];

  const overlays = (
    <>
      <Modal open={Boolean(pending)} title="解锁本集" onClose={() => setPending(null)}>
        {pending ? (
          <div className="space-y-3 text-[12.5px] text-white/70">
            <p>
              《{seriesById.get(pending.seriesId)?.title}》第 {pending.number} 集
            </p>
            <div className="rounded-lg border border-white/10 bg-ink-900/60 p-3">
              <div className="flex justify-between"><span>本集价格</span><span className="text-white">{pending.priceCoins} 币</span></div>
              <div className="mt-1 flex justify-between"><span>当前余额</span><span className="text-white">{data.wallet.balanceCoins} 币</span></div>
              <div className="mt-1 flex justify-between text-[11px] text-white/40">
                <span>平台抽成（1%）</span>
                <span>¥{fenToYuan(splitRevenue(pending.priceCoins).feeFen)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={confirmUnlock}>确认解锁</Button>
              <Button className="flex-1" onClick={() => setPending(null)}>取消</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={rechargeOpen} title="充值测试币" onClose={() => setRechargeOpen(false)}>
        <div className="space-y-3 text-[12.5px] text-white/70">
          <p>这是演示环境，不接真实支付。点击后会直接给账户加 300 币。</p>
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-[11px] text-amber-200">
            正式上线需要接 Stripe / 支付宝等支付服务，并补齐订单、退款、对账与提现审核。
          </div>
          <Button variant="primary" className="w-full" onClick={recharge}>加 300 测试币</Button>
        </div>
      </Modal>

      <Modal open={!data.creatorName} title="设置创作者名称" onClose={() => undefined} dismissible={false}>
        <div className="space-y-3">
          <TextInput label="工作室名称" value={creatorDraft} onChange={(event) => setCreatorDraft(event.target.value)} placeholder="你的工作室" />
          <Button
            variant="primary"
            className="w-full"
            onClick={() => {
              if (creatorDraft.trim()) actions.setCreatorName(creatorDraft.trim());
            }}
          >
            保存
          </Button>
        </div>
      </Modal>

      <LogPanel open={logOpen} onClose={() => setLogOpen(false)} />

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl border px-4 py-2 text-[12px] shadow-2xl md:bottom-5 ${
            toast.tone === "error"
              ? "border-rose-400/30 bg-rose-500/15 text-rose-100"
              : "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </>
  );

  if (route.name === "player" && playerEpisode) {
    return (
      <>
      <Player
        episode={playerEpisode}
        series={playerSeries ?? null}
        episodes={playerList}
        unlocked={unlocked}
        onClose={() => setRoute({ name: "series", id: playerEpisode.seriesId })}
        onSelect={(episode) => requestPlay(episode)}
        onUnlock={(episode) => setPending(episode)}
        onOpenLogs={() => setLogOpen(true)}
      />
      {overlays}
      </>
    );
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <button type="button" className="flex items-center gap-2" onClick={() => setRoute({ name: "home" })}>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-rose-400 to-rose-600 text-[13px] font-black text-white">剧</span>
            <span className="text-left">
              <span className="block text-[13px] font-semibold leading-tight">剧浪</span>
              <span className="block text-[9.5px] text-white/35">DramaWave</span>
            </span>
          </button>
          <nav className="ml-3 hidden items-center gap-1 text-[12px] md:flex">
            {[
              { key: "home", label: "发现" },
              { key: "creator", label: "创作者中心" },
              { key: "wallet", label: "钱包" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setRoute({ name: item.key } as Route)}
                className={`rounded-lg px-3 py-1.5 transition ${
                  route.name === item.key ? "bg-white/[0.07] text-white" : "text-white/55 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {storageWarning ? (
              <span className="hidden max-w-[220px] truncate text-[10.5px] text-rose-300 sm:inline" title={storageWarning}>
                {storageWarning}
              </span>
            ) : null}
            <span className="chip">{data.wallet.balanceCoins} 币</span>
            <Button variant="plain" className="px-2 text-white/55" onClick={() => setLogOpen(true)}>日志</Button>
            <Button variant="primary" onClick={() => setRechargeOpen(true)}>充值</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 pb-24 md:pb-5">
        {storageWarning ? (
          <div role="alert" className="mb-4 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[11px] leading-relaxed text-rose-200 sm:hidden">
            本地存储写入失败：{storageWarning}
          </div>
        ) : null}
        {route.name === "home" ? (
          <Home
            data={data}
            unlocked={unlocked}
            onOpenSeries={actions.openSeries}
            onPlay={requestPlay}
          />
        ) : null}
        {route.name === "series" ? (
          <SeriesView
            data={data}
            seriesId={route.id}
            unlocked={unlocked}
            onBack={() => setRoute({ name: "home" })}
            onPlay={requestPlay}
            onUnlock={(episode) => setPending(episode)}
            onCreator={() => setRoute({ name: "creator" })}
          />
        ) : null}
        {route.name === "creator" ? <Creator data={data} actions={actions} /> : null}
        {route.name === "wallet" ? <WalletView data={data} actions={actions} /> : null}
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-8 pb-24 text-[10.5px] text-white/25 md:pb-8">
        剧浪 DramaWave · 演示环境：视频只存本地浏览器，充值与提现均为模拟，平台按每集收入的 1% 抽成。
      </footer>

      {/* 移动端底部导航：桌面端用顶部导航 */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink-950/95 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-md">
          {[
            { key: "home", label: "发现" },
            { key: "creator", label: "创作者" },
            { key: "wallet", label: "钱包" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              aria-current={route.name === item.key ? "page" : undefined}
              onClick={() => setRoute({ name: item.key } as Route)}
              className={`flex-1 py-3 text-[11px] transition ${
                route.name === item.key ? "text-white" : "text-white/45"
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="flex-1 py-3 text-[11px] text-white/45 transition hover:text-white"
          >
            日志
          </button>
        </div>
      </nav>

      {overlays}
    </div>
  );
}
