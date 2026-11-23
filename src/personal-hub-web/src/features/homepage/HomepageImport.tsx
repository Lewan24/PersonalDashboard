import { useState } from "react";
import { Dialog } from "../../components/Dialog";
import { useHub } from "../../HubContext";
import { t } from "../../i18n";
import type { parseHomepage } from "./parseHomepage";

interface ImportResult {
  tabs: number;
  sections: number;
  items: number;
  duplicates: number;
}

export function HomepageImport() {
  const { mutate } = useHub();
  const [prepared, setPrepared] = useState<ReturnType<
    typeof parseHomepage
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult>();
  const [reading, setReading] = useState(false);

  async function read(files: File[]) {
    setReading(true);
    setError("");
    setResult(undefined);
    try {
      const { readHomepageFiles } = await import("./parseHomepage");
      setPrepared(await readHomepageFiles(files));
    } catch (error) {
      setError(error instanceof Error ? error.message : t("invalidForm"));
    } finally {
      setReading(false);
    }
  }

  async function save() {
    if (!prepared || busy) return;
    setBusy(true);
    setError("");
    try {
      setResult(
        await mutate<ImportResult>({
          path: "/import/homepage",
          body: prepared.document,
        }),
      );
      setPrepared(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : t("saveError"));
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (!busy) {
      setPrepared(null);
      setError("");
    }
  }

  const sections = prepared?.document.tabs.flatMap((tab) => tab.sections) ?? [];
  return (
    <>
      <h3>{t("homepageImport")}</h3>
      <p className="muted">{t("homepageFilesHelp")}</p>
      <label className="file-label">
        {t("homepageFiles")}
        <input
          type="file"
          multiple
          accept=".yaml,.yml"
          disabled={reading || busy}
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            if (files.length) void read(files);
          }}
        />
      </label>
      {reading && <p role="status">{t("loading")}</p>}
      {error && !prepared && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {result && <p role="status">{t("homepageResult", { ...result })}</p>}
      {prepared && (
        <Dialog title={t("homepagePreview")} onClose={close}>
          <dl>
            <dt>{t("tabs")}</dt>
            <dd>{prepared.document.tabs.map((tab) => tab.name).join(", ")}</dd>
            <dt>{t("sections")}</dt>
            <dd>{sections.length}</dd>
            <dt>{t("items")}</dt>
            <dd>
              {sections.reduce(
                (count, section) => count + section.links.length,
                0,
              )}
            </dd>
          </dl>
          {prepared.skipped > 0 && (
            <p>{t("homepageSkipped", { count: prepared.skipped })}</p>
          )}
          <p>{t("homepageAddHelp")}</p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="data-actions">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void save()}
            >
              {t(busy ? "saving" : "homepageAdd")}
            </button>
            <button
              type="button"
              data-dialog-input
              disabled={busy}
              onClick={close}
            >
              {t("cancel")}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
