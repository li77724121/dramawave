import { createSeed } from "./seed";
import type { AppData } from "./types";

const KEY = "dramawave.v1";

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createSeed();
    const parsed = JSON.parse(raw) as AppData;
    if (!parsed || !Array.isArray(parsed.series) || !Array.isArray(parsed.episodes)) {
      return createSeed();
    }
    const data: AppData = {
      ...createSeed(),
      ...parsed,
      wallet: parsed.wallet ?? { balanceCoins: 600 },
      ledger: parsed.ledger ?? [],
      history: parsed.history ?? [],
      views: parsed.views ?? {},
    };
    // 早期种子数据用了测试片名，按唯一简介精确匹配后修正。
    return {
      ...data,
      series: data.series.map((series) =>
        series.title === "删除我" &&
        series.synopsis.startsWith("他每天醒来，相册里都会多一张自己熟睡的照片")
          ? { ...series, title: "第三夜" }
          : series,
      ),
    };
  } catch {
    return createSeed();
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (error) {
    throw new Error("本地存储空间不足，删掉一些剧集或封面后重试", { cause: error });
  }
}

/* ---------------- 视频二进制：IndexedDB ---------------- */

const DB_NAME = "dramawave-blobs";
const STORE = "blobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    // 常见原因是浏览器配额用满，给用户一个能行动的提示。
    throw new Error("视频写入本地失败，浏览器存储空间可能已满，删掉一些旧剧集再试", { cause: error });
  } finally {
    db.close();
  }
}

export async function getBlob(key: string): Promise<Blob | null> {
  const db = await openDb();
  const value = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(key);
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}

export async function deleteBlob(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
