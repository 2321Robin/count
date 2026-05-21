type Props = {
  message: string;
  onExport: () => void;
  onImport: (file: File) => void;
  onClear: () => void;
  onReset: () => void;
};

export function DataManager({ message, onExport, onImport, onClear, onReset }: Props) {
  return (
    <section className="panel">
      <h2>数据管理</h2>
      <div className="row">
        <button type="button" onClick={onExport}>导出 JSON</button>
        <label className="fileButton">导入 JSON<input className="visuallyHidden" type="file" accept="application/json" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImport(file);
          event.currentTarget.value = "";
        }} /></label>
        <button type="button" className="danger" onClick={onClear}>清空所有数据</button>
        <button type="button" onClick={onReset}>重置默认数据</button>
      </div>
      {message && <p className="message">{message}</p>}
    </section>
  );
}
