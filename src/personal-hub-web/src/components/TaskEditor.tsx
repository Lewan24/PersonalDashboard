import { useState } from "react";
import { useForm } from "react-hook-form";
import { useHub } from "../HubContext";
import type { HubTask, Checklist, TaskLink } from "../types";
import { t } from "../i18n";
import { safeUrl } from "../api";
import { taskInputSchema } from "../validation";
import { Dialog } from "./Dialog";
import { Markdown } from "./Markdown";
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
  const [checklist, setChecklist] = useState<Checklist[]>(task.checklist ?? []);
  const [links, setLinks] = useState<TaskLink[]>(task.links ?? []);
  const {
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
    },
  });
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
    if (links.some((x) => !safeUrl(x.url))) {
      setError(t("invalidUrl"));
      return;
    }
    const body = {
      ...values,
      dueDate: values.dueDate || null,
      dueTime: values.dueTime || null,
      startDate: values.startDate || null,
      relatedDashboardItemId: values.relatedDashboardItemId || null,
      checklist,
      links,
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
    <Dialog title={task.id ? t("taskDetails") : t("addTask")} onClose={onClose}>
      <form onSubmit={submit}>
        <label>
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
                .filter((x) => !x.isArchived)
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
        <details>
          <summary>{t("preview")}</summary>
          <Markdown text={watch("descriptionMarkdown")} />
        </details>
        <fieldset>
          <legend>{t("tags")}</legend>
          {data.tags.map((tag) => (
            <label className="check" key={tag.id}>
              <input type="checkbox" value={tag.id} {...register("tagIds")} />
              {tag.name}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>{t("checklist")}</legend>
          {checklist.map((item, i) => (
            <div className="checklist-row" key={item.id ?? i}>
              <input
                aria-label={t("complete") + " " + item.title}
                type="checkbox"
                checked={item.isChecked}
                onChange={(e) =>
                  setChecklist(
                    checklist.map((x, j) =>
                      i === j ? { ...x, isChecked: e.target.checked } : x,
                    ),
                  )
                }
              />
              <input
                required
                aria-label={t("title") + " " + (i + 1)}
                maxLength={200}
                value={item.title}
                onChange={(e) =>
                  setChecklist(
                    checklist.map((x, j) =>
                      i === j ? { ...x, title: e.target.value } : x,
                    ),
                  )
                }
              />
              <button
                type="button"
                onClick={() =>
                  setChecklist(checklist.filter((_, j) => i !== j))
                }
              >
                {t("remove")}
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={checklist.length >= 100}
            onClick={() =>
              setChecklist([...checklist, { title: "", isChecked: false }])
            }
          >
            {t("add")}
          </button>
        </fieldset>
        <fieldset>
          <legend>{t("links")}</legend>
          {links.map((link, i) => (
            <div className="link-row" key={i}>
              <input
                required
                maxLength={120}
                aria-label={t("name") + " " + (i + 1)}
                value={link.title}
                onChange={(e) =>
                  setLinks(
                    links.map((x, j) =>
                      i === j ? { ...x, title: e.target.value } : x,
                    ),
                  )
                }
              />
              <input
                type="url"
                required
                maxLength={2048}
                aria-label={t("url") + " " + (i + 1)}
                value={link.url}
                onChange={(e) =>
                  setLinks(
                    links.map((x, j) =>
                      i === j ? { ...x, url: e.target.value } : x,
                    ),
                  )
                }
              />
              <button
                type="button"
                onClick={() => setLinks(links.filter((_, j) => i !== j))}
              >
                {t("remove")}
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={links.length >= 20}
            onClick={() => setLinks([...links, { title: "", url: "" }])}
          >
            {t("add")}
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
        <footer>
          <button className="primary" disabled={isSubmitting}>
            {t("save")}
          </button>
          <button type="button" onClick={onClose}>
            {t("cancel")}
          </button>
        </footer>
        {task.id && (
          <div className="task-actions">
            {[
              task.completedAt ? "reopen" : "complete",
              "duplicate",
              task.isArchived ? "unarchive" : "archive",
            ].map((a) => (
              <button
                type="button"
                key={a}
                disabled={isSubmitting}
                onClick={() => void action(a)}
              >
                {t(a === "archive" ? "archiveAction" : a)}
              </button>
            ))}
            <button
              type="button"
              className="danger"
              onClick={() => void remove()}
            >
              {t("delete")}
            </button>
          </div>
        )}
      </form>
    </Dialog>
  );
}
