import { fenToYuan } from "../lib/money";
import type { AppData } from "../lib/types";
import type { AppActions } from "../App";
import { Button, Empty } from "./ui";

interface Props {
  data: AppData;
  actions: AppActions;
}

const TYPE_LABEL: Record<string, string> = {
  recharge: "充值",
  unlock: "解锁剧集",
  payout: "提现",
};

export function WalletView({ data, actions }: Props) {
  const spent = data.ledger.filter((entry) => entry.type === "unlock").reduce((sum, entry) => sum + entry.grossFen, 0);
  const platformFee = data.ledger.reduce((sum, entry) => sum + entry.feeFen, 0);

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <p className="text-[11px] uppercase tracking-wider text-white/35">我的余额</p>
        <p className="mt-1 text-3xl font-semibold text-white">{data.wallet.balanceCoins} <span className="text-base text-white/40">币</span></p>
        <p className="mt-1 text-[11px] text-white/35">1 币 = ¥0.10 · 演示环境，不涉及真实资金</p>
        <div className="mt-3 flex gap-2">
          <Button variant="primary" onClick={actions.recharge}>充值测试币</Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card p-3.5">
          <p className="text-[10.5px] uppercase tracking-wider text-white/35">累计消费</p>
          <p className="mt-1 text-lg font-semibold">¥{fenToYuan(spent)}</p>
        </div>
        <div className="card p-3.5">
          <p className="text-[10.5px] uppercase tracking-wider text-white/35">平台抽成（1%）</p>
          <p className="mt-1 text-lg font-semibold text-rose-300">¥{fenToYuan(platformFee)}</p>
        </div>
        <div className="card p-3.5">
          <p className="text-[10.5px] uppercase tracking-wider text-white/35">解锁次数</p>
          <p className="mt-1 text-lg font-semibold">
            {data.ledger.filter((entry) => entry.type === "unlock").length}
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[13px] font-semibold text-white/80">账单</h2>
        {data.ledger.length === 0 ? (
          <Empty title="还没有交易" hint="解锁一集付费剧集后，这里会出现分成明细。" />
        ) : (
          <div className="card divide-y divide-white/5">
            {data.ledger.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-16 text-[11px] text-white/40">{TYPE_LABEL[entry.type] ?? entry.type}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] text-white/80">{entry.note}</p>
                  <p className="text-[10px] text-white/30">{new Date(entry.at).toLocaleString("zh-CN")}</p>
                </div>
                <div className="text-right text-[11px]">
                  <p className={entry.grossFen < 0 ? "text-white/60" : "text-white/80"}>
                    ¥{fenToYuan(Math.abs(entry.grossFen))}
                  </p>
                  {entry.type === "unlock" ? (
                    <p className="text-[10px] text-emerald-300/70">创作者 +¥{fenToYuan(entry.creatorFen)}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
