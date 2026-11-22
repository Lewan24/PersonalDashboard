import { useState } from "react";
import { useHub } from "../HubContext";
import type { HubTask } from "../types";
import { t } from "../i18n";
import { DragHandle } from "./DragHandle";
import { ActionMenu, MenuButton } from "./ActionMenu";
import type { MenuAction } from "./ActionMenu";
import { MoveDialog } from "./MoveDialog";
import { ConfirmDelete } from "./ConfirmDelete";
import { safeUrl } from "../api";
export function TaskCard({
  task,
  index = 0,
  showStatus = true,
  projection = false,
}: {
  task: HubTask;
  index?: number;
  showStatus?: boolean;
  projection?: boolean;
}) {
  const { data, setTask, mutate } = useHub();
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const column = data.columns.find((x) => x.id === task.columnId);
  const related = data.items.find((x) => x.id === task.relatedDashboardItemId);
  const overdue =
    !task.completedAt &&
    !task.isArchived &&
    !!task.dueDate &&
    task.dueDate < data.today;
  const action = (name: string) =>
    mutate({
      path: `/tasks/${task.id}/${name}`,
      body: { expectedVersion: task.version },
    });
  const move = (target: string, i: number) =>
    mutate({
      path: `/tasks/${task.id}/move`,
      body: {
        targetColumnId: target,
        targetIndex: i,
        expectedVersion: task.version,
      },
    });
  const menu: MenuAction[] = [
    {
      id: "edit",
      label: t("edit"),
      onSelect: () => setTask(task),
      opensDialog: true,
    },
    {
      id: "complete",
      label: t(task.completedAt ? "reopen" : "complete"),
      onSelect: () => {
        void action(task.completedAt ? "reopen" : "complete").catch(() => {});
      },
    },
    {
      id: "move",
      label: t("move") + "…",
      onSelect: () => setMoving(true),
      opensDialog: true,
      separator: true,
    },
    ...(!projection
      ? [
          {
            id: "up",
            label: t("moveUp"),
            disabled: index === 0,
            onSelect: () => {
              void move(task.columnId, index - 1).catch(() => {});
            },
          },
          {
            id: "down",
            label: t("moveDown"),
            onSelect: () => {
              void move(task.columnId, index + 1).catch(() => {});
            },
          },
        ]
      : []),
    {
      id: "duplicate",
      label: t("duplicate"),
      onSelect: () => {
        void action("duplicate").catch(() => {});
      },
    },
    {
      id: "archive",
      label: t(task.isArchived ? "unarchive" : "archiveAction"),
      onSelect: () => {
        void action(task.isArchived ? "unarchive" : "archive").catch(() => {});
      },
    },
    {
      id: "delete",
      label: t("delete"),
      danger: true,
      separator: true,
      opensDialog: true,
      onSelect: () => setDeleting(true),
    },
  ];
  return (
    <>
      <ActionMenu label={task.title} actions={menu}>
        <article
          className={"task-card" + (task.completedAt ? " is-completed" : "")}
        >
          <div className="task-heading">
            <input
              aria-label={
                t(task.completedAt ? "reopen" : "complete") + " " + task.title
              }
              type="checkbox"
              checked={!!task.completedAt}
              onChange={() =>
                void action(task.completedAt ? "reopen" : "complete").catch(
                  () => {},
                )
              }
            />
            <button
              className="text-button task-title"
              onClick={() => setTask(task)}
            >
              {task.title}
            </button>
            <div className="task-card-tools">
              <DragHandle
                data={{
                  kind: "task",
                  id: task.id,
                  container: task.columnId,
                  version: task.version,
                }}
              />
              <MenuButton label={task.title} actions={menu} />
            </div>
          </div>
          <div className="task-meta">
            {showStatus && <span>{column?.name}</span>}
            {task.priority !== "none" && (
              <span className={"priority priority-" + task.priority}>
                {t(task.priority)}
              </span>
            )}
            {task.dueDate && (
              <span className={overdue ? "overdue" : ""}>
                {overdue ? t("overdue") + " · " : ""}
                {task.dueDate}
                {task.dueTime ? " " + task.dueTime.slice(0, 5) : ""}
              </span>
            )}
            {task.checklist.length > 0 && (
              <span>
                {task.checklist.filter((x) => x.isChecked).length}/
                {task.checklist.length}
              </span>
            )}
            {task.tags.map((tag) => (
              <span key={tag.id} className="tag">
                {tag.name}
              </span>
            ))}
            {related && safeUrl(related.url) && (
              <a href={related.url!} target="_blank" rel="noopener noreferrer">
                {t("openService")}
              </a>
            )}
          </div>
        </article>
      </ActionMenu>
      {moving && (
        <MoveDialog
          request={{
            label: task.title,
            current: task.columnId,
            index,
            targets: [
              ...data.columns
                .filter((x) => !x.isArchived)
                .map((x) => ({ id: x.id, name: x.name })),
              ...(!task.completedAt && !task.isArchived
                ? [{ id: "today", name: t("today") }]
                : []),
            ],
            onMove: move,
          }}
          onClose={() => setMoving(false)}
        />
      )}
      {deleting && (
        <ConfirmDelete
          label={task.title}
          onClose={() => setDeleting(false)}
          onConfirm={() =>
            mutate({
              path: `/tasks/${task.id}?expectedVersion=${task.version}`,
              method: "DELETE",
            })
          }
        />
      )}
    </>
  );
}
