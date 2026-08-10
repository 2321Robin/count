import type { FairyTaleBookRecord } from "../domain/types";
import { formatMetaStamp, formatRecordDate } from "../domain/dateTime";
import { FAIRY_TALE_BOOK_CREATURES } from "../domain/seasons";

type Props = { records: FairyTaleBookRecord[] };

const nameById = new Map(FAIRY_TALE_BOOK_CREATURES.map((c) => [c.id, c.name]));

export function FairyTaleBookHistory({ records }: Props) {
  return (
    <div>
      {records.length === 0 ? <p>还没有童话绘本记录。</p> : (
        <ul className="history">
          {records.map((record) => {
            const entriesText = record.entries
              .filter((e) => e.count > 0)
              .map((e) => `${e.creatureName} ×${e.count}`)
              .join(" / ");
            const shinyNames = record.shinyCreatureIds
              .map((id) => nameById.get(id) ?? id)
              .join("、");
            const metaStamp = formatMetaStamp(record.updatedAt, record.updatedBy);
            return (
              <li key={record.id}>
                <span>{formatRecordDate(record.date)}</span>
                <span>{entriesText}</span>
                <span>✨ 异色：{shinyNames}</span>
                {record.notes && <em>{record.notes}</em>}
                {metaStamp && <span className="metaStamp">{metaStamp}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
