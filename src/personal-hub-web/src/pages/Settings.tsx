import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { useHub } from "../HubContext";
import { api } from "../api";
import type { Settings as SettingsType } from "../types";
import { t } from "../i18n";
import { Dialog } from "../components/Dialog";
interface Preview {
  previewToken: string;
  counts: Record<string, number>;
}
interface IconInfo {
  id: string;
  fileName: string;
  sizeBytes: number;
}
export default function Settings() {
  const { data, mutate } = useHub();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SettingsType>({ defaultValues: data.settings });
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [tagName, setTagName] = useState("");
  const icons = useQuery({
    queryKey: ["icons"],
    queryFn: () => api<IconInfo[]>("/icons"),
  });
  const backups = useQuery({
    queryKey: ["backups"],
    queryFn: () =>
      api<{ fileName: string; sizeBytes: number }[]>("/backup/list"),
  });
  const system = useQuery({
    queryKey: ["system"],
    queryFn: () =>
      api<{ appVersion: string; schemaVersion: string; databaseBytes: number }>(
        "/system/status",
      ),
  });
  async function run(input: Parameters<typeof mutate>[0]) {
    setMessage("");
    try {
      await mutate(input);
      setMessage(t("saved"));
      return true;
    } catch (e) {
      setMessage(String(e));
      return false;
    }
  }
  const select = (
    key: "theme" | "density" | "dateFormat" | "clockFormat",
    values: string[],
  ) => (
    <label key={key}>
      {t(key)}
      <select {...register(key)}>
        {values.map((x) => (
          <option key={x} value={x}>
            {t(key === "clockFormat" ? "clock" + x : x)}
          </option>
        ))}
      </select>
    </label>
  );
  const number = (
    key: "columns" | "radius" | "width" | "iconSize",
    min: number,
    max: number,
  ) => (
    <label key={key}>
      {t(key)}
      <input
        type="number"
        min={min}
        max={max}
        required
        {...register(key, { valueAsNumber: true })}
      />
    </label>
  );
  const check = (
    key: "clockVisible" | "clockSeconds" | "showOverdueInToday" | "quickAccess",
  ) => (
    <label className="check" key={key}>
      <input type="checkbox" {...register(key)} />
      {t(key)}
    </label>
  );
  async function importFile(file: File) {
    if (file.size > 25 * 1024 * 1024) {
      setMessage("25 MB");
      return;
    }
    try {
      const json: unknown = JSON.parse(await file.text());
      const result = await api<Preview>("/import/preview", "POST", json);
      setPreview(result);
    } catch (e) {
      setMessage(String(e));
    }
  }
  return (
    <>
      <div className="page-title">
        <h1>{t("settings")}</h1>
      </div>
      <div className="settings-grid">
        <section>
          <h2>{t("appearance")}</h2>
          <form
            onSubmit={handleSubmit(async (values) => {
              await run({ path: "/settings", method: "PUT", body: values });
            })}
          >
            <div className="form-row">
              {select("theme", ["dark", "light", "system"])}
              <label>
                {t("accentColor")}
                <input type="color" {...register("accent")} />
              </label>
            </div>
            <label>
              {t("timezone")}
              <input required {...register("timezone")} />
            </label>
            <div className="form-row">
              {select("density", ["compact", "comfortable"])}
            </div>
            <div className="form-row">
              {number("radius", 0, 24)}
              {number("width", 640, 1920)}
              {number("iconSize", 16, 64)}
            </div>
            {check("clockVisible")}
            {check("clockSeconds")}
            {select("clockFormat", ["24", "12"])}
            {select("dateFormat", ["long", "short"])}
            {check("showOverdueInToday")}
            {check("quickAccess")}
            <label>
              {t("language")}
              <select {...register("language")}>
                <option value="pl">Polski</option>
              </select>
            </label>
            <label>
              {t("externalSearch")}
              <input
                type="text"
                maxLength={2048}
                {...register("externalSearch")}
              />
            </label>
            <button className="primary" disabled={isSubmitting}>
              {t("save")}
            </button>
          </form>
        </section>
        <div>
          <section>
            <h2>{t("data")}</h2>
            <div className="data-actions">
              <a className="button" href="/api/v1/export/json">
                {t("export")}
              </a>
              <label className="file-label">
                {t("import")}
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void importFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <a className="button" href="/api/v1/backup/sqlite">
                {t("backupDownload")}
              </a>
              <button onClick={() => void run({ path: "/backup/create" })}>
                {t("backupCreate")}
              </button>
              <button
                onClick={() => {
                  if (confirm(t("seed") + "?"))
                    void run({ path: "/system/seed" });
                }}
              >
                {t("seed")}
              </button>
            </div>
            <h3>{t("backups")}</h3>
            <ul className="backup-list">
              {backups.data?.map((x) => (
                <li key={x.fileName}>
                  <a
                    href={
                      "/api/v1/backup/download/" +
                      encodeURIComponent(x.fileName)
                    }
                  >
                    {x.fileName}
                  </a>
                  <span>
                    {new Intl.NumberFormat("pl").format(x.sizeBytes)} B
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2>{t("icons")}</h2>
            <p className="muted">{t("iconLimits")}</p>
            <label className="file-label">
              {t("upload")}
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/x-icon"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const body = new FormData();
                    body.set("file", file);
                    void run({ path: "/icons", body });
                  }
                  e.target.value = "";
                }}
              />
            </label>
            <ul className="icon-list">
              {icons.data?.map((x) => (
                <li key={x.id}>
                  <img alt="" src={"/api/v1/icons/" + x.id} />
                  <div>
                    {x.fileName}
                    <code>icon:{x.id}</code>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(t("confirmDelete")))
                        void run({ path: "/icons/" + x.id, method: "DELETE" });
                    }}
                  >
                    {t("delete")}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2>{t("tags")}</h2>
            <form
              className="quick-add"
              onSubmit={(e) => {
                e.preventDefault();
                void run({
                  path: "/tags",
                  body: { name: tagName, color: data.settings.accent },
                }).then((ok) => {
                  if (ok) setTagName("");
                });
              }}
            >
              <label className="grow">
                {t("tagName")}
                <input
                  required
                  maxLength={40}
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                />
              </label>
              <button>{t("add")}</button>
            </form>
            <ul>
              {data.tags.map((x) => (
                <li key={x.id}>
                  {x.name}{" "}
                  <button
                    onClick={() => {
                      if (confirm(t("confirmDelete")))
                        void run({ path: "/tags/" + x.id, method: "DELETE" });
                    }}
                  >
                    {t("delete")}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <section className="admin">
          <h2>{t("admin")}</h2>
          <p className="warning">{t("noAuth")}</p>
          {system.data && (
            <dl>
              <dt>{t("version")}</dt>
              <dd>{system.data.appVersion}</dd>
              <dt>{t("systemStatus")}</dt>
              <dd>{system.data.schemaVersion}</dd>
              <dt>{t("size")}</dt>
              <dd>
                {new Intl.NumberFormat("pl").format(system.data.databaseBytes)}{" "}
                B
              </dd>
            </dl>
          )}
          <button
            onClick={() =>
              void run({ path: "/system/test-write" }).then((ok) => {
                if (ok) setMessage(t("writeSuccess"));
              })
            }
          >
            {t("writeTest")}
          </button>
        </section>
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {preview && (
        <Dialog title={t("importPreview")} onClose={() => setPreview(null)}>
          <dl>
            {Object.entries(preview.counts).map(([key, count]) => (
              <div key={key}>
                <dt>{t(key)}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
          <p>{t("confirmReplace")}</p>
          <button
            className="danger"
            data-dialog-input
            onClick={() => {
              if (confirm(t("confirmReplace")))
                void run({
                  path: "/import/commit",
                  body: { previewToken: preview.previewToken, confirmed: true },
                }).then((ok) => {
                  if (ok) setPreview(null);
                });
            }}
          >
            {t("commit")}
          </button>
        </Dialog>
      )}
    </>
  );
}
