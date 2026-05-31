import type { Creature } from "../domain/types";

type Props = {
  creature: Creature;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onEdit: (creature: Creature) => void;
  onRecord: (creature: Creature) => void;
  onRecordGift: (creature: Creature) => void;
  onRemove: (id: string) => void;
};

export function CreatureCard({ creature, onIncrement, onDecrement, onEdit, onRecord, onRecordGift, onRemove }: Props) {
  const percent = creature.targetCount > 0 ? Math.min(100, Math.round((creature.currentEncounters / creature.targetCount) * 100)) : 0;

  return (
    <article className="card counterRow" role="listitem" aria-label={creature.name}>
      <div className="creatureNamePane">
        <h2>{creature.name}</h2>
      </div>
      <div className="counterPane">
        <div className="numbers">
          <strong>本轮 {creature.currentEncounters}</strong>
          <span>历史 {creature.totalEncounters}</span>
          <span>目标 {creature.targetCount}</span>
        </div>
        <div className="progress" aria-label={`${creature.name} 进度 ${percent}%`}>
          <div style={{ width: `${percent}%` }} />
        </div>
        <div className="actions">
          <button type="button" className="primary" onClick={() => onIncrement(creature.id)}>+1</button>
          <button type="button" onClick={() => onDecrement(creature.id)}>-1</button>
          <button type="button" onClick={() => onRecord(creature)}>记录获得</button>
          <button type="button" onClick={() => onRecordGift(creature)}>记录赠送</button>
          <button type="button" className="ghost" onClick={() => onEdit(creature)}>编辑</button>
          {!creature.isDefault && <button type="button" className="danger" onClick={() => onRemove(creature.id)}>删除</button>}
        </div>
      </div>
    </article>
  );
}
