import { useState } from "react";
import type { FormEvent } from "react";
import { formatDateTimeInput } from "../domain/dateTime";
import type { Creature, GiftedRecordInput } from "../domain/types";

type Props = {
  creatures: Creature[];
  initialCreatureId?: string;
  onSave: (input: GiftedRecordInput) => void;
  onCancel: () => void;
};

export function GiftedRecordDialog({ creatures, initialCreatureId, onSave, onCancel }: Props) {
  const [creatureId, setCreatureId] = useState(initialCreatureId ?? creatures[0]?.id ?? "");
  const [date, setDate] = useState(() => formatDateTimeInput());
  const [giftedBy, setGiftedBy] = useState("");
  const [notes, setNotes] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!creatureId) return;
    onSave({ creatureId, date, giftedBy: giftedBy.trim(), notes: notes.trim() });
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>记录别人赠送</h2>
      <label>精灵
        <select value={creatureId} onChange={(event) => setCreatureId(event.target.value)}>
          {creatures.map((creature) => <option key={creature.id} value={creature.id}>{creature.name}</option>)}
        </select>
      </label>
      <label>时间<input type="datetime-local" step="1" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label>来源/赠送人<input value={giftedBy} onChange={(event) => setGiftedBy(event.target.value)} /></label>
      <label>备注<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      <div className="row"><button type="submit">保存赠送记录</button><button type="button" onClick={onCancel}>取消</button></div>
    </form>
  );
}
