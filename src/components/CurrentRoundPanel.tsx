import { useState } from "react";
import type { AppData, Creature } from "../domain/types";
import { formatRecordDate } from "../domain/dateTime";

function selectedIdsFromForm(form: HTMLFormElement): string[] {
  const formData = new FormData(form);
  return formData.getAll("roundCreature").filter((value): value is string => typeof value === "string");
}

type Props = {
  data: AppData;
  onSetTargets: (ids: string[]) => void;
  onSetTarget: (id: string | null) => void;
  onStartNew: (ids: string[]) => void;
  onReset: () => void;
  onRecordFairyTaleBook?: () => void;
  isS3Season?: boolean;
};

export function CurrentRoundPanel({ data, onSetTargets, onSetTarget, onStartNew, onReset, onRecordFairyTaleBook, isS3Season }: Props) {
  const activeIds = new Set(data.currentRound?.creatureIds ?? []);
  const targetCreatureId = data.currentRound?.targetCreatureId ?? "";
  const targetCreature = targetCreatureId ? data.creatures.find((creature) => creature.id === targetCreatureId) : null;
  const activeCreatures = data.creatures.filter((creature) => activeIds.has(creature.id));
  const total = activeCreatures.reduce((sum, creature) => sum + creature.currentEncounters, 0);
  const [isOpen, setIsOpen] = useState(false);

  function changeTargets(form: HTMLFormElement, isNewRound: boolean) {
    const ids = selectedIdsFromForm(form);
    if (isNewRound) onStartNew(ids);
    else onSetTargets(ids);
  }

  return (
    <section className="panel roundPanel" aria-label="当前轮次">
      <div className="sectionHeader">
        <div>
          <h2>当前轮次</h2>
          {isOpen && <p>选择本轮一起统计的精灵，并标记正在抓的目标；计数为 0 的精灵会自动移出本轮。</p>}
        </div>
        <div className="roundPanelActions">
          <strong className="roundTotal">本轮合计 {total}</strong>
          {targetCreature && <strong className="roundTarget">正在抓 {targetCreature.name}</strong>}
          {isS3Season && onRecordFairyTaleBook && <button type="button" onClick={onRecordFairyTaleBook}>记录童话绘本</button>}
          <button type="button" className="ghost" aria-expanded={isOpen} aria-controls="current-round-details" onClick={() => setIsOpen((value) => !value)}>
            {isOpen ? "收起当前轮次" : "展开当前轮次"}
          </button>
        </div>
      </div>
      {activeCreatures.length > 0 && (
        <div className="chips" aria-label="当前轮次精灵">
          {activeCreatures.map((creature) => <span key={creature.id}>{creature.name} {creature.currentEncounters}</span>)}
        </div>
      )}
      {!isOpen && activeCreatures.length === 0 && <p className="muted">已收起。展开后可以选择本轮精灵。</p>}
      {isOpen && (
        <div id="current-round-details" className="roundDetails">
          {activeCreatures.length === 0 && <p>还没有选择本轮精灵。点任意精灵 +1 会自动加入当前轮次。</p>}
          {data.currentRound?.updatedAt && <p className="muted">最近调整：{formatRecordDate(data.currentRound.updatedAt)}</p>}
          <label>正在抓
            <select value={targetCreatureId} onChange={(event) => onSetTarget(event.target.value || null)}>
              <option value="">未标记</option>
              {data.creatures.map((creature) => <option key={creature.id} value={creature.id}>{creature.name}</option>)}
            </select>
          </label>
          <form key={`${data.currentRound?.creatureIds.join("|") ?? ""}:${targetCreatureId}`} onSubmit={(event) => { event.preventDefault(); changeTargets(event.currentTarget, false); }}>
            <div className="roundChoices">
              {data.creatures.map((creature: Creature) => (
                <label key={creature.id} className="roundChoice">
                  <input className="visuallyHidden" name="roundCreature" type="checkbox" value={creature.id} defaultChecked={activeIds.has(creature.id)} />
                  <span>{creature.name}</span>
                </label>
              ))}
            </div>
            <div className="row">
              <button type="submit">更新本轮精灵</button>
              <button type="button" onClick={(event) => changeTargets(event.currentTarget.form!, true)}>开始新一轮并清零</button>
              <button type="button" onClick={onReset}>清空本轮计数</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
