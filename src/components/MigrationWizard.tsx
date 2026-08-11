import type { MigrationState } from "../domain/serverSync";

type Props = {
  state: MigrationState;
  seasonLabel: string;
  busy: boolean;
  onChoice: (choice: "upload-local" | "discard-local" | "use-cloud" | "use-local") => void;
};

export function MigrationWizard({ state, seasonLabel, busy, onChoice }: Props) {
  return (
    <section className="panel migrationPanel" role="dialog" aria-label="迁移本机数据">
      {state.kind === "upload-local" ? (
        <>
          <h2>把本机数据上传到账号？</h2>
          <p>本机还保存着未登录时的 {seasonLabel} 数据，云端账号数据为空。上传后这台设备继续使用同一份数据。</p>
          <div className="row">
            <button type="button" disabled={busy} onClick={() => onChoice("upload-local")}>上传本机数据</button>
            <button type="button" className="ghost" disabled={busy} onClick={() => onChoice("discard-local")}>弃用本机数据，从空开始</button>
          </div>
        </>
      ) : (
        <>
          <h2>本机和云端都有数据，用哪边？</h2>
          <p>本机最后修改：{new Date(state.localModifiedAt).toLocaleString("zh-CN", { hour12: false })}；云端最后修改：{new Date(state.cloudUpdatedAt).toLocaleString("zh-CN", { hour12: false })}。</p>
          <div className="row">
            <button type="button" disabled={busy} onClick={() => onChoice("use-cloud")}>用云端数据</button>
            <button type="button" disabled={busy} onClick={() => onChoice("use-local")}>用本机数据覆盖云端</button>
          </div>
        </>
      )}
    </section>
  );
}
