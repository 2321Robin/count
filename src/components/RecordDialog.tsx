import { useState } from "react";
import type { FormEvent } from "react";
import type { Creature, RecordInput } from "../domain/types";

type Props = {
  creature: Creature;
  onSave: (input: RecordInput) => void;
  onCancel: () => void;
};

export function RecordDialog({ creature, onSave, onCancel }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState(creature.location);
  const [notes, setNotes] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({ date, location: location.trim(), notes: notes.trim() });
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>记录获得：{creature.name}</h2>
      <p>本轮 {creature.currentEncounters}，历史 {creature.totalEncounters}</p>
      <label>日期<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label>地点/活动<input value={location} onChange={(event) => setLocation(event.target.value)} /></label>
      <label>备注<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      <div className="row"><button type="submit">保存记录</button><button type="button" onClick={onCancel}>取消</button></div>
    </form>
  );
}
