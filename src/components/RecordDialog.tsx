import { useState } from "react";
import type { FormEvent } from "react";
import type { Creature, RecordInput } from "../domain/types";
import { formatDateTimeInput } from "../domain/dateTime";

type Props = {
  creature: Creature;
  onSave: (input: RecordInput) => void;
  onCancel: () => void;
};

export function RecordDialog({ creature, onSave, onCancel }: Props) {
  const [date, setDate] = useState(() => formatDateTimeInput());
  const [notes, setNotes] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({ date, location: "", notes: notes.trim() });
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>记录获得：{creature.name}</h2>
      <p>本轮 {creature.currentEncounters}，历史 {creature.totalEncounters}</p>
      <label>时间<input type="datetime-local" step="1" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label>备注<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      <div className="row"><button type="submit">保存记录</button><button type="button" onClick={onCancel}>取消</button></div>
    </form>
  );
}
