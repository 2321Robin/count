import type { AppData, Creature } from "../domain/types";
import { formatRecordDate } from "../domain/dateTime";

function selectedIdsFromForm(form: HTMLFormElement): string[] {
  const formData = new FormData(form);
  return formData.getAll("roundCreature").filter((value): value is string => typeof value === "string");
}

type Props = {
  data: AppData;
  onSetTargets: (ids: string[]) => void;
  onStartNew: (ids: string[]) => void;
  onReset: () => void;
};

export function CurrentRoundPanel({ data, onSetTargets, onStartNew, onReset }: Props) {
  const activeIds = new Set(data.currentRound?.creatureIds ?? []);
  const activeCreatures = data.creatures.filter((creature) => activeIds.has(creature.id));
  const total = activeCreatures.reduce((sum, creature) => sum + creature.currentEncounters, 0);

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
          <p>选择本轮一起统计的精灵；记录获得时会清空这些精灵的本轮计数。</p>
        </div>
        <strong className="roundTotal">本轮合计 {total}</strong>
      </div>
      {activeCreatures.length === 0 ? (
        <p>还没有选择本轮精灵。点任意精灵 +1 会自动加入当前轮次。</p>
      ) : (
        <div className="chips" aria-label="当前轮次精灵">
          {activeCreatures.map((creature) => <span key={creature.id}>{creature.name} {creature.currentEncounters}</span>)}
        </div>
      )}
      {data.currentRound?.updatedAt && <p className="muted">最近调整：{formatRecordDate(data.currentRound.updatedAt)}</p>}
      <form key={data.currentRound?.creatureIds.join("|") ?? ""} onSubmit={(event) => { event.preventDefault(); changeTargets(event.currentTarget, false); }}>
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
    </section>
  );
}
