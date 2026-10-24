import type { AppData, Episode, Series } from "./types";
import { uid } from "./types";

const now = Date.now();

function series(input: Omit<Series, "id" | "createdAt">): Series {
  return { ...input, id: uid("ser"), createdAt: now };
}

function episode(
  seriesId: string,
  number: number,
  title: string,
  video: string,
  priceCoins: number,
): Episode {
  return {
    id: uid("ep"),
    seriesId,
    number,
    title,
    videoKey: video,
    priceCoins,
    published: true,
    createdAt: now,
  };
}

export function createSeed(): AppData {
  const s1 = series({
    title: "第三夜",
    synopsis:
      "他每天醒来，相册里都会多一张自己熟睡的照片。第三夜，照片的拍摄角度来自他手里的手机。",
    tags: ["悬疑", "都市", "反转"],
    creator: "夜航工作室",
    cover: "/demo/cover1.jpg",
    published: true,
  });
  const s2 = series({
    title: "第七夜",
    synopsis: "值夜班的护士发现，病房里的呼叫铃总在凌晨三点响，而那一床从来没有住过人。",
    tags: ["惊悚", "短剧"],
    creator: "灰鲸影像",
    cover: "/demo/cover2.jpg",
    published: true,
  });

  const episodes: Episode[] = [
    episode(s1.id, 1, "相册里的陌生人", "/demo/ep1.mp4", 0),
    episode(s1.id, 2, "床边没有人", "/demo/ep2.mp4", 30),
    episode(s1.id, 3, "照片在看你", "/demo/ep3.mp4", 30),
    episode(s2.id, 1, "三点整的呼叫铃", "/demo/ep4.mp4", 0),
    episode(s2.id, 2, "空床位", "/demo/ep5.mp4", 20),
    episode(s2.id, 3, "第七夜", "/demo/ep6.mp4", 20),
  ];

  return {
    series: [s1, s2],
    episodes,
    ledger: [],
    wallet: { balanceCoins: 600 },
    history: [],
    views: {},
    creatorName: "夜航工作室",
  };
}
