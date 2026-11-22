import { useState } from "react";
import { Dialog } from "./Dialog";
import { t } from "../i18n";
export function ConfirmDelete({
  label,
  onConfirm,
  onClose,
}: {
  label: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : t("saveError"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={t("delete") + " · " + label}
      onClose={onClose}
      role="alertdialog"
    >
      <p>{t("confirmDelete")}</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <footer>
        <button data-dialog-input type="button" onClick={onClose}>
          {t("cancel")}
        </button>
        <button
          type="button"
          className="danger"
          disabled={busy}
          onClick={() => void remove()}
        >
          {t("delete")}
        </button>
      </footer>
    </Dialog>
  );
}
