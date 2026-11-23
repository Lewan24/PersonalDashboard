import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Plus, X } from "lucide-react";
import { useHub } from "../HubContext";
import type { HubTask, Checklist, TaskLink } from "../types";
import { t } from "../i18n";
import { safeUrl } from "../api";
import { taskInputSchema } from "../validation";
import { Dialog } from "./Dialog";
import { TagOptions } from "./Tags";
import { Markdown } from "./Markdown";
import { MenuButton } from "./ActionMenu";
interface TaskForm {
  title: string;
  descriptionMarkdown: string;
  columnId: string;
  priority: string;
  dueDate: string;
  dueTime: string;
  startDate: string;
  relatedDashboardItemId: string;
  tagIds: string[];
  checklist: Checklist[];
  links: TaskLink[];
}
export function TaskEditor({
  task,
  onClose,
}: {
  task: Partial<HubTask>;
  onClose: () => void;
}) {
  const { data, mutate } = useHub();
  const [error, setError] = useState("");
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<TaskForm>({
    defaultValues: {
      title: task.title ?? "",
      descriptionMarkdown: task.descriptionMarkdown ?? "",
      columnId:
        task.columnId ??
        data.columns.find((x) => !x.isDone && !x.isArchived)?.id,
      priority: task.priority ?? "none",
      dueDate: task.dueDate ?? "",
      dueTime: task.dueTime ?? "",
      startDate: task.startDate ?? "",
      relatedDashboardItemId: task.relatedDashboardItemId ?? "",
      tagIds: task.tags?.map((x) => x.id) ?? [],
      checklist: task.checklist ?? [],
      links: task.links ?? [],
    },
  });
  const checklist = useFieldArray({
    control,
    name: "checklist",
    keyName: "rowKey",
  });
  const links = useFieldArray({ control, name: "links", keyName: "rowKey" });

  async function action(action: string) {
    try {
      await mutate({
        path: `/tasks/${task.id}/${action}`,
        body: { expectedVersion: task.version },
      });
      onClose();
    } catch (e) {
      setError(String(e));
    }
  }
  const submit = handleSubmit(async (values) => {
    setError("");
    if (values.links.some((link) => !safeUrl(link.url.trim()))) {
      setError(t("invalidUrl"));
      return;
    }
    const body = {
      ...values,
      dueDate: values.dueDate || null,
      dueTime: values.dueTime || null,
      startDate: values.startDate || null,
      relatedDashboardItemId: values.relatedDashboardItemId || null,
      links: values.links.map((link) => ({ ...link, url: link.url.trim() })),
      ...(task.id ? { expectedVersion: task.version } : {}),
    };
    const validated = taskInputSchema.safeParse(body);
    if (!validated.success) {
      setError(t("invalidForm"));
      return;
    }
    try {
      await mutate({
        path: "/tasks" + (task.id ? "/" + task.id : ""),
        method: task.id ? "PATCH" : "POST",
        body: validated.data,
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
        path: `/tasks/${task.id}?expectedVersion=${task.version}`,
        method: "DELETE",
      });
      onClose();
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <Dialog
      title={task.id ? t("editTask") : t("addTask")}
      onClose={onClose}
      className="task-editor"
    >
      <form onSubmit={submit}>
        <div className="task-editor-body">
          <label className="task-editor-title">
            {t("title")}
            <input
              data-dialog-input
              required
              maxLength={200}
              {...register("title")}
            />
          </label>
          <div className="form-row">
            <label>
              {t("column")}
              <select {...register("columnId")}>
                {data.columns
                  .filter((x) => !x.isArchived || x.id === task.columnId)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {t("priority")}
              <select {...register("priority")}>
                {["none", "low", "medium", "high", "urgent"].map((x) => (
                  <option key={x} value={x}>
                    {t(x)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              {t("dueDate")}
              <input type="date" {...register("dueDate")} />
            </label>
            <label>
              {t("dueTime")}
              <input type="time" {...register("dueTime")} />
            </label>
            <label>
              {t("startDate")}
              <input type="date" {...register("startDate")} />
            </label>
          </div>
          <label>
            {t("description")}
            <textarea
              rows={5}
              maxLength={20000}
              {...register("descriptionMarkdown")}
            />
          </label>
          {watch("descriptionMarkdown").trim() && (
            <details className="task-description-preview">
              <summary>{t("preview")}</summary>
              <Markdown text={watch("descriptionMarkdown")} />
            </details>
          )}
          <fieldset className="task-editor-group">
            <legend>{t("checklist")}</legend>
            <small>{t("checklistHelp")}</small>
            {checklist.fields.map((item, index) => (
              <div className="task-checklist-row" key={item.rowKey}>
                <input
                  aria-label={t("checklistDone", { count: index + 1 })}
                  type="checkbox"
                  {...register(`checklist.${index}.isChecked`)}
                />
                <input
                  type="text"
                  required
                  aria-label={t("checklistEntry", { count: index + 1 })}
                  placeholder={t("checklistPlaceholder")}
                  maxLength={200}
                  {...register(`checklist.${index}.title`)}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t("removeChecklistEntry", { count: index + 1 })}
                  onClick={() => checklist.remove(index)}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="quiet-button"
              disabled={checklist.fields.length >= 100}
              onClick={() =>
                checklist.append(
                  { title: "", isChecked: false },
                  {
                    focusName: `checklist.${checklist.fields.length}.title`,
                  },
                )
              }
            >
              <Plus size={16} />
              {t("addChecklistEntry")}
            </button>
          </fieldset>
          <fieldset className="task-editor-group">
            <legend>{t("tags")}</legend>
            <TagOptions tags={data.tags} input={register("tagIds")} />
          </fieldset>
          <fieldset className="task-editor-group">
            <legend>{t("links")}</legend>
            <small>{t("taskLinksHelp")}</small>
            {links.fields.map((link, index) => (
              <div className="task-link-row" key={link.rowKey}>
                <label>
                  {t("linkName")}
                  <input
                    required
                    maxLength={120}
                    placeholder={t("linkNamePlaceholder")}
                    {...register(`links.${index}.title`)}
                  />
                </label>
                <label>
                  {t("linkAddress")}
                  <input
                    type="url"
                    required
                    maxLength={2048}
                    placeholder="https://"
                    {...register(`links.${index}.url`)}
                  />
                </label>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t("removeTaskLink", { count: index + 1 })}
                  onClick={() => links.remove(index)}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="quiet-button"
              disabled={links.fields.length >= 20}
              onClick={() => links.append({ title: "", url: "" })}
            >
              <Plus size={16} />
              {t("addTaskLink")}
            </button>
          </fieldset>
          <label>
            {t("relatedItem")}
            <select {...register("relatedDashboardItemId")}>
              <option value="">{t("none")}</option>
              {data.items.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="task-editor-footer">
          {task.id && (
            <MenuButton
              label={task.title ?? t("tasks")}
              actions={[
                ...[
                  task.completedAt ? "reopen" : "complete",
                  "duplicate",
                  task.isArchived ? "unarchive" : "archive",
                ].map((name) => ({
                  id: name,
                  label: t(name === "archive" ? "archiveAction" : name),
                  disabled: isSubmitting,
                  onSelect: () => void action(name),
                })),
                {
                  id: "delete",
                  label: t("delete"),
                  danger: true,
                  separator: true,
                  disabled: isSubmitting,
                  onSelect: () => void remove(),
                },
              ]}
            />
          )}
          <button type="button" onClick={onClose}>
            {t("cancel")}
          </button>
          <button className="primary" disabled={isSubmitting}>
            {t("save")}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
