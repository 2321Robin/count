import { useState } from "react";
import type { FormEvent } from "react";
import type { Creature, RecordInput } from "../domain/types";
import { formatDateTimeInput } from "../domain/dateTime";

type Props = {
  creature: Creature;
  targetCreature: Creature | null;
  onSave: (input: RecordInput) => void;
  onCancel: () => void;
};

export function RecordDialog({ creature, targetCreature, onSave, onCancel }: Props) {
  const [date, setDate] = useState(() => formatDateTimeInput());
  const [isOffTarget, setIsOffTarget] = useState(() => Boolean(targetCreature && targetCreature.id !== creature.id));
  const [notes, setNotes] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({ date, location: "", notes: notes.trim(), isOffTarget });
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>记录获得：{creature.name}</h2>
      <p>本轮 {creature.currentEncounters}，历史 {creature.totalEncounters}</p>
      {targetCreature && <p className="muted">正在抓：{targetCreature.name}</p>}
      <label>获得类型
        <select value={isOffTarget ? "offTarget" : "normal"} onChange={(event) => setIsOffTarget(event.target.value === "offTarget")}>
          <option value="offTarget">歪的</option>
          <option value="normal">中了！</option>
        </select>
      </label>
      <label>时间<input type="datetime-local" step="1" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label>备注<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      <div className="row"><button type="submit">保存记录</button><button type="button" onClick={onCancel}>取消</button></div>
    </form>
  );
}
