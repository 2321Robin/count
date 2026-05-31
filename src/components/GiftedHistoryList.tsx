import { formatRecordDate } from "../domain/dateTime";
import type { GiftedCaptureRecord } from "../domain/types";

type Props = { records: GiftedCaptureRecord[] };

export function GiftedHistoryList({ records }: Props) {
  return (
    <section className="panel">
      <h2>别人赠送记录</h2>
      {records.length === 0 ? <p>还没有赠送记录。</p> : (
        <ul className="history">
          {records.map((record) => (
            <li key={record.id}>
              <strong>{record.creatureName}</strong>
              <span>{formatRecordDate(record.receivedAt)}</span>
              {record.giftedBy && <span>来源 {record.giftedBy}</span>}
              {record.notes && <em>{record.notes}</em>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
