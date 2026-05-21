import type { Creature } from "../domain/types";
import { CreatureCard } from "./CreatureCard";

type Props = {
  creatures: Creature[];
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onEdit: (creature: Creature) => void;
  onRecord: (creature: Creature) => void;
  onRemove: (id: string) => void;
};

export function CreatureGrid({ creatures, onIncrement, onDecrement, onEdit, onRecord, onRemove }: Props) {
  return (
    <section className="grid" aria-label="精灵计数列表">
      {creatures.map((creature) => (
        <CreatureCard
          key={creature.id}
          creature={creature}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
          onEdit={onEdit}
          onRecord={onRecord}
          onRemove={onRemove}
        />
      ))}
    </section>
  );
}
