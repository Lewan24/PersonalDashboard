import type { DragEvent, CSSProperties } from "react";
import { Plus } from "lucide-react";
import type { Column, HubTask } from "../../types";
import { ActionMenu, MenuButton } from "../../components/ActionMenu";
import type { MenuAction } from "../../components/ActionMenu";
import { TaskCard } from "../../components/TaskCard";
import { DragHandle } from "../../components/DragHandle";
import { t } from "../../i18n";
export function TaskColumnCard({
  column,
  tasks,
  actions,
  onAdd,
  onDrop,
}: {
  column: Column;
  tasks: HubTask[];
  actions: MenuAction[];
  onAdd: () => void;
  onDrop: (event: DragEvent, index: number) => void;
}) {
  const wip = tasks.filter((x) => !x.completedAt && !x.isArchived).length;
  return (
    <ActionMenu label={column.name} actions={actions}>
      <section
        className="kanban-column"
        style={{ "--column-accent": column.color } as CSSProperties}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => onDrop(e, tasks.length)}
      >
        <div className="section-heading">
          <h3>
            {column.name}{" "}
            <span className="count">
              {tasks.length}
              {column.wipLimit ? " / " + column.wipLimit : ""}
            </span>
          </h3>
          <div className="column-tools">
            <DragHandle
              data={{
                kind: "column",
                id: column.id,
                container: "columns",
                version: column.version,
              }}
            />
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
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, index)}
          >
            <TaskCard task={task} index={index} showStatus={false} />
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
