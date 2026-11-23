import { useState } from "react";
import { Dialog } from "../../components/Dialog";
import { useHub } from "../../HubContext";
import { t } from "../../i18n";

type DatabaseAction = { kind: "clear" } | { kind: "restore"; file: File };

export function DatabaseTransfer({ onReplaced }: { onReplaced: () => void }) {
  const { mutate } = useHub();
  const [action, setAction] = useState<DatabaseAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [backup, setBackup] = useState<{
    fileName: string;
    kind: DatabaseAction["kind"];
  } | null>(null);

  function choose(file: File) {
    setError("");
    if (!file.size || file.size > 512 * 1024 * 1024) {
      setError(t("databaseFileSize"));
      return;
    }
    setAction({ kind: "restore", file });
  }

  async function confirm() {
    if (!action || busy) return;
    setBusy(true);
    setError("");
    try {
      const { fileName } = await mutate<{ fileName: string }>({
        ...(action.kind === "clear"
          ? { path: "/system/clear", body: { confirmed: true } }
          : {
              path: "/backup/restore?confirmed=true",
              body: action.file.slice(
                0,
                action.file.size,
                "application/vnd.sqlite3",
              ),
            }),
        retryable: false,
      });
      setBackup({ fileName, kind: action.kind });
      onReplaced();
      setAction(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : t("saveError"));
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (!busy) {
      setAction(null);
      setError("");
    }
  }

  return (
    <>
      <a className="button" href="/api/v1/backup/sqlite">
        {t("backupDownload")}
      </a>
      <label className="file-label">
        {t("backupRestore")}
        <input
          type="file"
          accept=".db,.sqlite,.sqlite3"
          disabled={busy}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) choose(file);
          }}
        />
      </label>
      <button
        type="button"
        className="danger"
        disabled={busy}
        onClick={() => {
          setError("");
          setAction({ kind: "clear" });
        }}
      >
        {t("databaseClear")}
      </button>
      {!action && error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {backup && (
        <div className="database-backup-result">
          <p role="status">
            {t(
              backup.kind === "clear" ? "databaseCleared" : "databaseRestored",
            )}
          </p>
          <a
            href={
              "/api/v1/backup/download/" + encodeURIComponent(backup.fileName)
            }
          >
            {t("backupBeforeChange")}
          </a>
        </div>
      )}
      {action && (
        <Dialog
          title={t(action.kind === "clear" ? "databaseClear" : "backupRestore")}
          role="alertdialog"
          onClose={close}
        >
          {action.kind === "restore" && (
            <p>
              <strong>{action.file.name}</strong>
            </p>
          )}
          <p>
            {t(
              action.kind === "clear"
                ? "databaseClearHelp"
                : "databaseRestoreHelp",
            )}
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="data-actions">
            <button
              type="button"
              data-dialog-input
              disabled={busy}
              onClick={close}
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={() => void confirm()}
            >
              {t(
                busy
                  ? "saving"
                  : action.kind === "clear"
                    ? "databaseClear"
                    : "databaseRestoreConfirm",
              )}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
