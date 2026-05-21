import type { AcquisitionRecord } from "../domain/types";

type Props = { records: AcquisitionRecord[] };

export function HistoryList({ records }: Props) {
  return (
    <section className="panel">
      <h2>获得历史</h2>
      {records.length === 0 ? <p>还没有记录。</p> : (
        <ul className="history">
          {records.map((record) => (
            <li key={record.id}>
              <strong>{record.creatureName}</strong>
              <span>第 {record.acquisitionNumber} 只</span>
              <span>{record.date}</span>
              <span>本轮 {record.roundEncounters}</span>
              <span>历史 {record.totalEncountersAtRecord}</span>
              {record.notes && <em>{record.notes}</em>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
