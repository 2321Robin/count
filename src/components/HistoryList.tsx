import { useState } from "react";
import type { AcquisitionRecord, FairyTaleBookRecord } from "../domain/types";
import { formatRecordDate } from "../domain/dateTime";
import { FairyTaleBookHistory } from "./FairyTaleBookHistory";

type Props = {
  records: AcquisitionRecord[];
  fairyTaleBookRecords: FairyTaleBookRecord[];
};

function formatVisibleRoundBreakdown(record: AcquisitionRecord): string | null {
  let text = "";
  let visibleCount = 0;

  for (const item of record.roundBreakdown) {
    if (item.encounters <= 0) continue;
    text += `${visibleCount === 0 ? "" : " / "}${item.creatureName} ${item.encounters}`;
    visibleCount += 1;
  }

  return visibleCount > 1 ? text : null;
}

export function HistoryList({ records, fairyTaleBookRecords }: Props) {
  const [tab, setTab] = useState<"records" | "fairytale">("records");

  return (
    <section className="panel">
      <h2>获得历史</h2>
      <div className="historyTabs">
        <button type="button" className={tab === "records" ? "active" : ""} onClick={() => setTab("records")}>
          获得历史 ({records.length})
        </button>
        <button type="button" className={tab === "fairytale" ? "active" : ""} onClick={() => setTab("fairytale")}>
          童话绘本 ({fairyTaleBookRecords.length})
        </button>
      </div>
      {tab === "records" && (
        records.length === 0 ? <p>还没有记录。</p> : (
          <ul className="history">
            {records.map((record) => {
              const roundBreakdownText = formatVisibleRoundBreakdown(record);
              return (
                <li key={record.id}>
                  <strong>{record.creatureName}</strong>
                  <span>第 {record.acquisitionNumber} 只</span>
                  <span>{formatRecordDate(record.date)}</span>
                  {record.isOffTarget ? (
                    <span>记录抓“{record.targetCreatureName}”{record.targetRoundEncounters}只时歪出</span>
                  ) : (
                    <span>本轮 {record.roundEncounters}</span>
                  )}
                  {!record.isOffTarget && roundBreakdownText && <span>明细 {roundBreakdownText}</span>}
                  <span>历史 {record.totalEncountersAtRecord}</span>
                  {record.notes && <em>{record.notes}</em>}
                </li>
              );
            })}
          </ul>
        )
      )}
      {tab === "fairytale" && <FairyTaleBookHistory records={fairyTaleBookRecords} />}
    </section>
  );
}
