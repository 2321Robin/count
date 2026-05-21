import { useState } from "react";
import type { FormEvent } from "react";
import type { Creature, CreatureInput } from "../domain/types";

type Props = {
  creature: Creature | null;
  onSave: (input: CreatureInput) => void;
  onCancel: () => void;
};

export function CreatureEditor({ creature, onSave, onCancel }: Props) {
  const [name, setName] = useState(creature?.name ?? "");
  const [targetCount, setTargetCount] = useState(String(creature?.targetCount ?? 80));

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      name: name.trim() || "未命名精灵",
      targetCount: Math.max(1, Number(targetCount) || 1),
      location: "",
      notes: "",
    });
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>{creature ? "编辑精灵" : "新增精灵"}</h2>
      <label>名称<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>目标次数<input type="number" min="1" value={targetCount} onChange={(event) => setTargetCount(event.target.value)} /></label>
      <div className="row"><button type="submit">保存精灵</button><button type="button" onClick={onCancel}>取消</button></div>
    </form>
  );
}
