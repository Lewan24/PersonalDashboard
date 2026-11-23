import type { CSSProperties } from "react";
import { Plus } from "lucide-react";
import type { Column, HubTask } from "../../types";
import { ActionMenu, MenuButton } from "../../components/ActionMenu";
import type { MenuAction } from "../../components/ActionMenu";
import { TaskCard } from "../../components/TaskCard";
import { dragSource, dropTarget } from "../../components/drag";
import type { DragData } from "../../components/drag";
import { t } from "../../i18n";
export function TaskColumnCard({
  column,
  tasks,
  actions,
  onAdd,
  onEdit,
  onMoveTask,
  onReorder,
  manualOrder,
  matchTask,
}: {
  column: Column;
  tasks: HubTask[];
  actions: MenuAction[];
  onAdd: () => void;
  onEdit: () => void;
  onMoveTask: (drag: DragData, target?: HubTask, after?: boolean) => void;
  onReorder: (drag: DragData, after: boolean) => void;
  manualOrder: boolean;
  matchTask: (task: HubTask) => boolean | undefined;
}) {
  const wip = tasks.filter((x) => !x.completedAt && !x.isArchived).length;
  return (
    <ActionMenu label={column.name} actions={actions}>
      <section
        className="kanban-column"
        style={{ "--column-accent": column.color } as CSSProperties}
        {...dragSource(
          {
            kind: "column",
            id: column.id,
            container: "columns",
            version: column.version,
          },
          onEdit,
        )}
        data-drag-card={"column:" + column.id}
        {...dropTarget(
          (drag) =>
            drag.kind === "task" &&
            (manualOrder || drag.container !== column.id)
              ? "inside"
              : drag.kind === "column" && drag.id !== column.id
                ? "grid"
                : undefined,
          (drag, position) => {
            if (drag.kind === "task") onMoveTask(drag);
            else onReorder(drag, position === "after");
          },
        )}
      >
        <div className="section-heading">
          <h3>
            <button
              type="button"
              className="text-button entity-heading-button"
              data-drag-trigger
              onClick={onEdit}
            >
              {column.name}
            </button>{" "}
            <span className="count">
              {tasks.length}
              {column.wipLimit ? " / " + column.wipLimit : ""}
            </span>
          </h3>
          <div className="column-tools">
            <button
              className="icon-button"
              aria-label={t("addTask") + " · " + column.name}
              onClick={onAdd}
            >
              <Plus size={15} />
            </button>
            <MenuButton label={column.name} actions={actions} />
          </div>
        </div>
        {column.wipLimit && wip > column.wipLimit && (
          <p className="overdue wip-warning" role="status">
            {t("wipWarning")} ({wip}/{column.wipLimit})
          </p>
        )}
        {tasks.map((task, index) => (
          <div
            key={task.id}
            {...(manualOrder &&
              dropTarget(
                (drag) =>
                  drag.kind === "task"
                    ? drag.id === task.id
                      ? "self"
                      : "vertical"
                    : undefined,
                (drag, position) =>
                  onMoveTask(drag, task, position === "after"),
              ))}
          >
            <TaskCard
              task={task}
              index={index}
              showStatus={false}
              searchMatch={matchTask(task)}
            />
          </div>
        ))}
        {!tasks.length && (
          <button className="empty-add" onClick={onAdd}>
            <Plus size={14} />
            {t("addTask")}
          </button>
        )}
      </section>
    </ActionMenu>
  );
}
