import { useState } from "react";
import type { FormEvent } from "react";
import type { FairyTaleBookRecordInput } from "../domain/types";
import { FAIRY_TALE_BOOK_CREATURES } from "../domain/seasons";
import { formatDateTimeInput } from "../domain/dateTime";

type Props = {
  onSave: (input: FairyTaleBookRecordInput) => void;
  onCancel: () => void;
};

export function FairyTaleBookDialog({ onSave, onCancel }: Props) {
  const [date, setDate] = useState(() => formatDateTimeInput());
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(FAIRY_TALE_BOOK_CREATURES.map((c) => [c.id, 0]))
  );
  const [shinyIds, setShinyIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");

  function adjustCount(creatureId: string, delta: number) {
    setCounts((prev) => ({
      ...prev,
      [creatureId]: Math.max(0, (prev[creatureId] ?? 0) + delta),
    }));
  }

  function toggleShiny(creatureId: string) {
    setShinyIds((prev) => {
      const next = new Set(prev);
      if (next.has(creatureId)) next.delete(creatureId);
      else next.add(creatureId);
      return next;
    });
  }

  const totalCount = Object.values(counts).reduce((sum, c) => sum + c, 0);
  const totalCountIsValid = totalCount === 10;
  const shinyWithZeroCount = [...shinyIds].some((id) => (counts[id] ?? 0) === 0);
  const canSubmit = totalCountIsValid && shinyIds.size > 0 && !shinyWithZeroCount;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const entries = FAIRY_TALE_BOOK_CREATURES
      .filter((c) => (counts[c.id] ?? 0) > 0)
      .map((c) => ({ creatureId: c.id, count: counts[c.id] }));
    onSave({ date, entries, shinyCreatureIds: [...shinyIds], notes: notes.trim() });
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>记录童话绘本</h2>
      <p className="muted">点击 + / - 记录每只精灵出现的次数（总数必须为 10），勾选异色的精灵。</p>
      <label>时间
        <input type="datetime-local" step="1" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <p className={totalCount === 0 ? "muted" : totalCountIsValid ? "" : "muted"}>
        已记录 {totalCount}/10 只
        {totalCount > 0 && !totalCountIsValid && <span>（还需要 {10 - totalCount} 只）</span>}
      </p>
      {totalCountIsValid && <p className="muted">✓ 总数已满</p>}
      <div className="fairyTaleBookGrid">
        {FAIRY_TALE_BOOK_CREATURES.map((creature) => {
          const count = counts[creature.id] ?? 0;
          const isShiny = shinyIds.has(creature.id);
          const hasZeroCountShiny = isShiny && count === 0;
          return (
            <div key={creature.id} className={`fairyTaleBookItem ${count > 0 ? "hasCount" : ""} ${isShiny ? "isShiny" : ""} ${hasZeroCountShiny ? "invalidShiny" : ""}`}>
              <span className="fairyTaleBookName">{creature.name}</span>
              <span className="fairyTaleBookControls">
                <button type="button" onClick={() => adjustCount(creature.id, -1)} disabled={count === 0}>−</button>
                <span className="fairyTaleBookCount">{count}</span>
                <button type="button" onClick={() => adjustCount(creature.id, 1)} disabled={totalCount >= 10 && count === 0}>+</button>
              </span>
              <label className="fairyTaleBookShiny">
                <input type="checkbox" checked={isShiny} onChange={() => toggleShiny(creature.id)} />
                <span>异色</span>
              </label>
            </div>
          );
        })}
      </div>
      {shinyIds.size === 0 && <p className="muted">请至少选择一只异色精灵。</p>}
      {shinyWithZeroCount && <p className="muted">标记为异色的精灵数量不能为 0。</p>}
      <label>备注
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <div className="row">
        <button type="submit" disabled={!canSubmit}>保存记录</button>
        <button type="button" onClick={onCancel}>取消</button>
      </div>
    </form>
  );
}
