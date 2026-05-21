import { useEffect, useState } from "react";
import { CreatureEditor } from "./components/CreatureEditor";
import { CreatureGrid } from "./components/CreatureGrid";
import { DataManager } from "./components/DataManager";
import { HeaderStats } from "./components/HeaderStats";
import { HistoryList } from "./components/HistoryList";
import { RecordDialog } from "./components/RecordDialog";
import { addCreature, calculateStats, decrementEncounter, incrementEncounter, recordAcquisition, removeCreature, updateCreature } from "./domain/counter";
import { createDefaultData } from "./domain/defaultData";
import { exportAppData, parseImportedData } from "./domain/importExport";
import { loadAppData, saveAppData } from "./domain/storage";
import type { AppData, Creature, CreatureInput, RecordInput } from "./domain/types";

export default function App() {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [editing, setEditing] = useState<Creature | null | "new">(null);
  const [recording, setRecording] = useState<Creature | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => saveAppData(data), [data]);

  function apply(next: AppData) {
    setData(next);
    setMessage("");
  }

  function saveCreature(input: CreatureInput) {
    if (editing && editing !== "new") apply(updateCreature(data, editing.id, input));
    else apply(addCreature(data, input));
    setEditing(null);
  }

  function saveRecord(input: RecordInput) {
    if (recording) apply(recordAcquisition(data, recording.id, input));
    setRecording(null);
  }

  function exportData() {
    const blob = new Blob([exportAppData(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "s2-capture-counter-backup.json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("导出成功。");
  }

  async function importData(file: File) {
    const result = parseImportedData(await file.text());
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    apply(result.data);
    setMessage("导入成功。");
  }

  function clearData() {
    if (window.confirm("确定清空所有数据？此操作不可撤销。")) apply({ version: 1, creatures: [], records: [], settings: { sortMode: "default" } });
  }

  function resetData() {
    if (window.confirm("确定重置为默认数据？当前记录会被清空。")) apply(createDefaultData());
  }

  function removeCustomCreature(id: string) {
    if (window.confirm("确定删除这个自定义精灵？相关记录也会被删除。")) apply(removeCreature(data, id));
  }

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Roco World S2</p>
          <h1>S2 捕捉计数器</h1>
          <p>按精灵记录遭遇次数、本轮进度和获得历史。</p>
        </div>
        <button type="button" onClick={() => setEditing("new")}>新增精灵</button>
      </header>
      <HeaderStats stats={calculateStats(data)} />
      {editing && <CreatureEditor creature={editing === "new" ? null : editing} onSave={saveCreature} onCancel={() => setEditing(null)} />}
      {recording && <RecordDialog creature={recording} onSave={saveRecord} onCancel={() => setRecording(null)} />}
      <CreatureGrid
        creatures={data.creatures}
        onIncrement={(id) => apply(incrementEncounter(data, id))}
        onDecrement={(id) => apply(decrementEncounter(data, id))}
        onEdit={setEditing}
        onRecord={setRecording}
        onRemove={removeCustomCreature}
      />
      <DataManager message={message} onExport={exportData} onImport={importData} onClear={clearData} onReset={resetData} />
      <HistoryList records={data.records} />
    </main>
  );
}
