import type { Creature } from "../domain/types";
import { CreatureCard } from "./CreatureCard";

type Props = {
  creatures: Creature[];
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onEdit: (creature: Creature) => void;
  onRecord: (creature: Creature) => void;
  onRecordGift: (creature: Creature) => void;
  onRemove: (id: string) => void;
};

export function CreatureGrid({ creatures, onIncrement, onDecrement, onEdit, onRecord, onRecordGift, onRemove }: Props) {
  const sortedCreatures = creatures
    .map((creature, index) => ({ creature, index }))
    .sort((left, right) => right.creature.currentEncounters - left.creature.currentEncounters || left.index - right.index)
    .map(({ creature }) => creature);

  return (
    <section className="grid" aria-label="精灵计数列表">
      {sortedCreatures.map((creature) => (
        <CreatureCard
          key={creature.id}
          creature={creature}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
          onEdit={onEdit}
          onRecord={onRecord}
          onRecordGift={onRecordGift}
          onRemove={onRemove}
        />
      ))}
    </section>
  );
}
