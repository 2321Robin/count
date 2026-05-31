import type { AppStats } from "../domain/types";

type Props = { stats: AppStats };

export function HeaderStats({ stats }: Props) {
  return (
    <section className="stats" aria-label="总体统计">
      <div><span>{stats.creatureCount}</span><small>精灵</small></div>
      <div><span>{stats.currentRoundTotal}</span><small>本轮遭遇</small></div>
      <div><span>{stats.historicalTotal}</span><small>历史遭遇</small></div>
      <div><span>{stats.recordCount}</span><small>获得记录</small></div>
      <div><span>{stats.giftedRecordCount}</span><small>赠送记录</small></div>
    </section>
  );
}
