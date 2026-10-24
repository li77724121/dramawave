export interface Series {
  id: string;
  title: string;
  synopsis: string;
  tags: string[];
  creator: string;
  cover: string;
  published: boolean;
  createdAt: number;
}

export interface Episode {
  id: string;
  seriesId: string;
  number: number;
  title: string;
  /** public URL or idb:<key> */
  videoKey: string;
  /** 0 = free */
  priceCoins: number;
  published: boolean;
  createdAt: number;
}

export type LedgerType = "recharge" | "unlock" | "payout";

export interface LedgerEntry {
  id: string;
  type: LedgerType;
  at: number;
  /** 用户支付总额（分） */
  grossFen: number;
  /** 平台抽成（分），每集按 1% 计 */
  feeFen: number;
  /** 创作者净收入（分） */
  creatorFen: number;
  seriesId?: string;
  episodeId?: string;
  note: string;
}

export interface Wallet {
  balanceCoins: number;
}

export interface HistoryItem {
  episodeId: string;
  at: number;
}

export interface AppData {
  series: Series[];
  episodes: Episode[];
  ledger: LedgerEntry[];
  wallet: Wallet;
  history: HistoryItem[];
  views: Record<string, number>;
  creatorName: string;
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}
