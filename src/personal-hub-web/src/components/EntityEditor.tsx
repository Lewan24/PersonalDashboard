import { useState } from "react";
import { useForm } from "react-hook-form";
import { useHub } from "../HubContext";
import { t } from "../i18n";
import { safeUrl } from "../api";
import { Dialog } from "./Dialog";
type Kind = "tabs" | "sections" | "items" | "task-columns";
export function EntityEditor({
  kind,
  value,
  onClose,
  appearance = false,
}: {
  kind: Kind;
  value: Record<string, unknown>;
  onClose: () => void;
  appearance?: boolean;
}) {
  const { data, mutate } = useHub();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<Record<string, unknown>>({ defaultValues: value });
  const isItem = kind === "items";
  const itemType = watch("itemType") ?? "compact-link";
  const text = (key: string, max: number, required = true, type = "text") => (
    <label key={key}>
      {t(key)}
      <input
        type={type}
        maxLength={max}
        data-dialog-input={
          (
            appearance
              ? key === (kind === "task-columns" ? "color" : "accentColor")
              : key === (isItem ? "url" : "name")
          )
            ? ""
            : undefined
        }
        required={required}
        {...register(key)}
      />
    </label>
  );
  const check = (key: string) => (
    <label className="check" key={key}>
      <input type="checkbox" {...register(key)} />
      {t(key)}
    </label>
  );
  const number = (key: string, min: number, max: number) => (
    <label key={key}>
      {t(key)}
      <input
        type="number"
        min={min}
        max={max}
        {...register(key, { valueAsNumber: true })}
      />
    </label>
  );
  const select = (key: string, options: { id: string; name: string }[]) => (
    <label key={key}>
      {t(key)}
      <select {...register(key)}>
        {options.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
    </label>
  );
  const submit = handleSubmit(async (values) => {
    setError("");
    if (
      isItem &&
      !["note", "spacer"].includes(String(values.itemType)) &&
      !safeUrl(String(values.url))
    ) {
      setError(t("invalidUrl"));
      return;
    }
    const body = { ...values };
    if (kind === "sections")
      body.widthPercent = Number(body.widthPercent ?? 100);
    delete body.id;
    delete body.version;
    delete body.sortOrder;
    delete body.tags;
    delete body.createdAt;
    delete body.updatedAt;
    if (isItem && !body.title && safeUrl(String(body.url)))
      body.title = new URL(String(body.url)).hostname;
    if (
      kind === "task-columns" &&
      (!body.wipLimit || Number.isNaN(body.wipLimit))
    )
      body.wipLimit = null;
    try {
      await mutate({
        path: "/" + kind + (value.id ? "/" + value.id : ""),
        method: value.id ? "PATCH" : "POST",
        body: {
          ...body,
          ...(value.version ? { expectedVersion: value.version } : {}),
        },
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("saveError"));
    }
  });
  async function remove() {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await mutate({
        path: `/${kind}/${value.id}?cascade=true`,
        method: "DELETE",
      });
      onClose();
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <Dialog
      title={
        appearance
          ? t("customizeAppearance")
          : value.id
            ? t("edit") + " · " + String(value.title ?? value.name ?? "")
            : t(
                isItem
                  ? "addItem"
                  : kind === "tabs"
                    ? "addTab"
                    : kind === "sections"
                      ? "addSection"
                      : "addColumn",
              )
      }
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {isItem ? (
          <>
            {!["note", "spacer"].includes(String(itemType)) &&
              text("url", 2048, true, "url")}
            {text("title", 120, false)}
            {select(
              "sectionId",
              data.sections.map((s) => ({
                id: s.id,
                name: `${data.tabs.find((t) => t.id === s.tabId)?.name} / ${s.name}`,
              })),
            )}
          </>
        ) : (
          text("name", 80)
        )}
        {(kind === "sections" || isItem) && (
          <label>
            {t("description")}
            <textarea
              maxLength={itemType === "note" ? 5000 : 500}
              rows={4}
              {...register("description")}
            />
          </label>
        )}
        <details open={appearance || undefined}>
          <summary>{t("advanced")}</summary>
          {isItem && (
            <>
              {select(
                "itemType",
                [
                  "compact-link",
                  "detailed-link",
                  "service-card",
                  "note",
                  "spacer",
                ].map((id) => ({ id, name: t(id) })),
              )}
              {check("isFavorite")}
              {check("openInNewTab")}
              <fieldset>
                <legend>{t("tags")}</legend>
                {data.tags.map((tag) => (
                  <label className="check" key={tag.id}>
                    <input
                      type="checkbox"
                      value={tag.id}
                      {...register("tagIds")}
                    />
                    {tag.name}
                  </label>
                ))}
              </fieldset>
            </>
          )}
          {kind !== "task-columns" && text("iconKey", 120, false)}
          {text(
            kind === "task-columns" ? "color" : "accentColor",
            7,
            false,
            "color",
          )}
          {kind === "tabs" && check("isHidden")}
          {kind === "sections" && (
            <>
              {select(
                "tabId",
                data.tabs.map((t) => ({ id: t.id, name: t.name })),
              )}
              {check("isCollapsed")}
              {select(
                "widthPercent",
                [100, 75, 66, 50, 33, 25].map((value) => ({
                  id: String(value),
                  name: value + "%",
                })),
              )}
              {select(
                "layoutMode",
                ["grid", "list"].map((id) => ({ id, name: t(id) })),
              )}
              {number("desktopColumns", 1, 6)}
              {number("tabletColumns", 1, 4)}
              {number("mobileColumns", 1, 2)}
            </>
          )}
          {kind === "task-columns" && (
            <>
              {check("isDone")}
              {number("wipLimit", 1, 20000)}
            </>
          )}
        </details>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer>
          <button className="primary" disabled={isSubmitting}>
            {t("save")}
          </button>
          <button type="button" onClick={onClose}>
            {t("cancel")}
          </button>
          {!!value.id && kind !== "task-columns" && (
            <button
              type="button"
              className="danger"
              onClick={() => void remove()}
            >
              {t("delete")}
            </button>
          )}
        </footer>
      </form>
    </Dialog>
  );
}
