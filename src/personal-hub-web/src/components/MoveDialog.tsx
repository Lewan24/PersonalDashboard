import { useState } from "react";
import { Dialog } from "./Dialog";
interface Destination {
  id: string;
  name: string;
}
import { t } from "../i18n";
export interface MoveRequest {
  label: string;
  current: string;
  index: number;
  targets: Destination[];
  onMove: (target: string, index: number) => Promise<unknown>;
}
export function MoveDialog({
  request,
  onClose,
}: {
  request: MoveRequest;
  onClose: () => void;
}) {
  const [target, setTarget] = useState(request.current);
  const [index, setIndex] = useState(request.index + 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await request.onMove(target, index - 1);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : t("saveError"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={t("move") + " · " + request.label} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label>
          {t("target")}
          <select
            data-dialog-input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            {request.targets.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        {target !== "today" && (
          <label>
            {t("position")}
            <input
              type="number"
              min={1}
              max={20000}
              required
              value={index}
              onChange={(e) => setIndex(Number(e.target.value))}
            />
          </label>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer>
          <button className="primary" disabled={busy}>
            {t("move")}
          </button>
          <button type="button" onClick={onClose}>
            {t("cancel")}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
