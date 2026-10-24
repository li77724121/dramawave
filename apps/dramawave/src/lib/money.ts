/** 1 币 = 0.10 元 = 10 分 */
export const COIN_FEN = 10;
export const PLATFORM_RATE = 0.01;

export function coinsToFen(coins: number): number {
  return Math.round(coins * COIN_FEN);
}

export function fenToYuan(fen: number): string {
  return (fen / 100).toFixed(2);
}

export function fenToCoins(fen: number): string {
  const coins = fen / COIN_FEN;
  return Number.isInteger(coins) ? String(coins) : coins.toFixed(1);
}

export interface Split {
  grossFen: number;
  feeFen: number;
  creatorFen: number;
}

/** 每集独立结算：平台 1%，其余归创作者。 */
export function splitRevenue(coins: number): Split {
  const grossFen = coinsToFen(coins);
  const feeFen = Math.round(grossFen * PLATFORM_RATE);
  return { grossFen, feeFen, creatorFen: grossFen - feeFen };
}

export function formatCoins(coins: number): string {
  return `${coins.toLocaleString("zh-CN")} 币`;
}
