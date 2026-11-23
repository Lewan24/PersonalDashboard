import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useHub } from "../HubContext";
import { t } from "../i18n";
import { safeUrl } from "../api";
import { Dialog } from "./Dialog";
import { TagOptions } from "./Tags";
import { IconField } from "./IconField";
const itemTypes = [
  "compact-link",
  "detailed-link",
  "service-card",
  "note",
  "spacer",
];
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
  const itemTypeHelp = useId();
  const [advancedOpen, setAdvancedOpen] = useState(appearance);
  const [error, setError] = useState("");
  const {
    control,
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
  const select = (
    key: string,
    options: { id: string; name: string }[],
    label = key,
  ) => (
    <label key={key}>
      {t(label)}
      <select {...register(key)}>
        {options.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
    </label>
  );
  const icon = (
    <Controller
      name="iconKey"
      control={control}
      render={({ field }) => (
        <IconField
          value={String(field.value ?? "lucide:link")}
          onChange={field.onChange}
          enabled={isItem || advancedOpen}
          allowAutomatic={isItem}
        />
      )}
    />
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
    if (isItem && !String(body.title ?? "").trim()) {
      if (itemType === "spacer") body.title = t("spacer");
      else if (safeUrl(String(body.url)))
        body.title = new URL(String(body.url)).hostname;
    }
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
            {text("title", 120, itemType === "note")}
          </>
        ) : (
          text("name", 80)
        )}
        {(kind === "sections" || (isItem && itemType !== "spacer")) && (
          <label>
            {t("description")}
            <textarea
              maxLength={itemType === "note" ? 5000 : 500}
              rows={4}
              {...register("description")}
            />
          </label>
        )}
        {isItem && (
          <>
            {icon}
            {!["note", "spacer"].includes(String(itemType)) && check("showUrl")}
            <fieldset>
              <legend>{t("tags")}</legend>
              <TagOptions tags={data.tags} input={register("tagIds")} />
            </fieldset>
          </>
        )}
        <details
          open={advancedOpen}
          onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
        >
          <summary>{t("advanced")}</summary>
          {isItem && (
            <>
              <label>
                <span id={itemTypeHelp + "-label"}>{t("itemType")}</span>
                <select
                  aria-labelledby={itemTypeHelp + "-label"}
                  aria-describedby={itemTypeHelp}
                  {...register("itemType")}
                >
                  {itemTypes.map((type) => (
                    <option key={type} value={type}>
                      {t(type)}
                    </option>
                  ))}
                </select>
                <small id={itemTypeHelp} aria-live="polite">
                  {t(itemType + "Help")}
                </small>
              </label>
              {select(
                "sectionId",
                data.sections.map((s) => ({
                  id: s.id,
                  name: `${data.tabs.find((t) => t.id === s.tabId)?.name} / ${s.name}`,
                })),
                "section",
              )}
              {check("isFavorite")}
              {check("openInNewTab")}
            </>
          )}
          {!isItem && kind !== "task-columns" && icon}
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
