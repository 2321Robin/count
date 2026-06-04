import type { AcquisitionRecord } from "../domain/types";
import { formatRecordDate } from "../domain/dateTime";

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
              <span>{formatRecordDate(record.date)}</span>
              {record.isOffTarget ? (
                <span>记录抓“{record.targetCreatureName}”{record.targetRoundEncounters}只时歪出</span>
              ) : (
                <span>本轮 {record.roundEncounters}</span>
              )}
              {!record.isOffTarget && record.roundBreakdown.length > 1 && <span>明细 {record.roundBreakdown.map((item) => `${item.creatureName} ${item.encounters}`).join(" / ")}</span>}
              <span>历史 {record.totalEncountersAtRecord}</span>
              {record.notes && <em>{record.notes}</em>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
