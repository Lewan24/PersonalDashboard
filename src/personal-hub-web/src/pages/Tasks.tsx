import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Plus, SlidersHorizontal } from "lucide-react";
import { useHub } from "../HubContext";
import { api } from "../api";
import type { TaskPage, Column, HubTask } from "../types";
import { makeSearch } from "../search";
import { t } from "../i18n";
import { TaskCard } from "../components/TaskCard";
import { EntityEditor } from "../components/EntityEditor";
import { Dialog } from "../components/Dialog";
import { dropTarget, insertionIndex, useDragMotion } from "../components/drag";
import type { DragData } from "../components/drag";
import { MenuButton } from "../components/ActionMenu";
import type { MenuAction } from "../components/ActionMenu";
import { TaskColumnCard } from "../features/tasks/TaskColumnCard";
import { QuickTaskInput } from "../features/tasks/QuickTaskInput";

export default function Tasks({
  dashboardSearch,
}: {
  dashboardSearch: string;
}) {
  useEffect(() => {
    if (window.location.hash === "#tasks")
      document.getElementById("tasks")?.scrollIntoView();
  }, []);
  const { data, setTask, mutate } = useHub();
  const dragBoard = useDragMotion();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState("");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [sort, setSort] = useState("order");
  const [editor, setEditor] = useState<Record<string, unknown> | null>(null);
  const [deleting, setDeleting] = useState<Column | null>(null);
  const [destination, setDestination] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingBusy, setDeletingBusy] = useState(false);
  const due = params.get("due");
  const view =
    due === "overdue" || due === "today"
      ? "today"
      : due === "archive"
        ? "archive"
        : "all";
  const queryParams = new URLSearchParams({
    q: search,
    priority,
    tag,
    status,
    archived: String(view === "archive"),
    limit: "200",
    sort,
    ...(hideCompleted ? { completed: "false" } : {}),
    ...(!["all", "archive"].includes(view) ? { due: view } : {}),
  });
  const query = useInfiniteQuery({
    queryKey: ["tasks", queryParams.toString()],
    initialPageParam: "0",
    queryFn: ({ pageParam }) =>
      api<TaskPage>("/tasks?" + queryParams + "&cursor=" + pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const tasks = query.data?.pages.flatMap((page) => page.tasks) ?? [];
  const searchPreview = makeSearch(dashboardSearch);
  const matchTask = (task: HubTask) =>
    searchPreview.active
      ? searchPreview.matches(
          task.title,
          task.descriptionMarkdown,
          ...task.tags.map((tag) => tag.name),
        )
      : undefined;
  const columns = data.columns.filter((x) => !x.isArchived);
  const addColumn = () =>
    setEditor({
      name: "",
      color: data.settings.accent,
      isDone: false,
      wipLimit: null,
    });
  async function moveColumn(column: Column, index: number) {
    const ids = data.columns.map((x) => x.id).filter((x) => x !== column.id);
    ids.splice(index, 0, column.id);
    await mutate({ path: "/task-columns/reorder", body: { orderedIds: ids } });
  }
  function columnActions(column: Column, index: number): MenuAction[] {
    return [
      {
        id: "add",
        label: t("addTask"),
        onSelect: () => setTask({ columnId: column.id }),
        opensDialog: true,
      },
      {
        id: "edit",
        label: t("edit"),
        onSelect: () => setEditor({ ...column }),
        opensDialog: true,
      },
      {
        id: "up",
        label: t("moveUp"),
        disabled: index === 0,
        onSelect: () => {
          void moveColumn(column, index - 1).catch(() => {});
        },
      },
      {
        id: "down",
        label: t("moveDown"),
        disabled: index === columns.length - 1,
        onSelect: () => {
          void moveColumn(column, index + 1).catch(() => {});
        },
      },
      {
        id: "delete",
        label: t("delete"),
        danger: true,
        separator: true,
        opensDialog: true,
        onSelect: () => {
          setDeleting(column);
          setDestination(columns.find((x) => x.id !== column.id)?.id ?? "");
          setDeleteError("");
        },
      },
    ];
  }
  function moveTask(
    drag: DragData,
    column: Column,
    target?: HubTask,
    after = false,
  ) {
    void mutate({
      path: `/tasks/${drag.id}/move`,
      body: {
        targetColumnId: column.id,
        ...(target
          ? { targetTaskId: target.id, afterTarget: after }
          : { targetIndex: 2147483647 }),
        expectedVersion: drag.version,
      },
    }).catch(() => {});
  }
  function reorderColumn(drag: DragData, target: Column, after: boolean) {
    const sourceIndex = data.columns.findIndex((x) => x.id === drag.id);
    const targetIndex = data.columns.findIndex((x) => x.id === target.id);
    if (sourceIndex >= 0)
      void moveColumn(
        data.columns[sourceIndex],
        insertionIndex(targetIndex, sourceIndex, after),
      ).catch(() => {});
  }
  async function removeColumn(archive: boolean) {
    if (!deleting || (!archive && !destination)) return;
    setDeletingBusy(true);
    try {
      await mutate({
        path: `/task-columns/${deleting.id}?${archive ? "archiveTasks=true" : "moveTasksTo=" + destination}`,
        method: "DELETE",
      });
      setDeleting(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : t("saveError"));
    } finally {
      setDeletingBusy(false);
    }
  }
  return (
    <section
      id="tasks"
      className="task-module"
      aria-labelledby="tasks-heading"
      data-drag-board
      ref={dragBoard}
    >
      <div className="task-module-heading">
        <h2 id="tasks-heading">{t("tasks")}</h2>
        <QuickTaskInput />
        <div className="task-module-actions">
          <button className="quiet-button" onClick={() => setTask({})}>
            <Plus size={15} />
            {t("addTask")}
          </button>
          <MenuButton
            label={t("tasks")}
            actions={[
              {
                id: "column",
                label: t("addColumn"),
                onSelect: addColumn,
                opensDialog: true,
              },
            ]}
          />
        </div>
      </div>
      <div className="task-navigation">
        <div className="view-tabs">
          {["all", "today", "archive"].map((id) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              aria-pressed={view === id}
              {...(id === "today" &&
                dropTarget(
                  (drag) =>
                    drag.kind === "task" && drag.canSchedule
                      ? "inside"
                      : undefined,
                  (drag) => {
                    void mutate({
                      path: `/tasks/${drag.id}/move`,
                      body: {
                        targetColumnId: "today",
                        expectedVersion: drag.version,
                      },
                    }).catch(() => {});
                  },
                ))}
              onClick={() =>
                setParams(
                  (previous) => {
                    const next = new URLSearchParams(previous);
                    if (id === "all") next.delete("due");
                    else next.set("due", id);
                    return next;
                  },
                  { preventScrollReset: true },
                )
              }
            >
              {t(id)}
              {id === "today" && (
                <span className="count">
                  {data.taskSummary.todayCount + data.taskSummary.overdueCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <details className="task-filters">
        <summary>
          <SlidersHorizontal size={14} />
          {t("filters")}
          {(search || priority || tag || status || hideCompleted) && (
            <span className="filter-dot" />
          )}
        </summary>
        <div className="filters">
          <label>
            <span className="sr-only">{t("search")}</span>
            <input
              type="search"
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">{t("priority")}</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="">{t("filterPriority")}</option>
              {["none", "low", "medium", "high", "urgent"].map((id) => (
                <option key={id} value={id}>
                  {t(id)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">{t("tags")}</span>
            <select value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">{t("filterTag")}</option>
              {data.tags.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">{t("column")}</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t("filterStatus")}</option>
              {columns.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("sort")}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              disabled={view === "today"}
            >
              {["order", "title", "priority", "dueDate"].map((id) => (
                <option key={id} value={id}>
                  {t(id)}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => setHideCompleted(e.target.checked)}
            />
            {t("hideCompleted")}
          </label>
        </div>
      </details>
      {query.isPending ? (
        <p role="status" className="empty">
          {t("loading")}
        </p>
      ) : query.isError ? (
        <p role="alert">
          {t("loadError")}{" "}
          <button onClick={() => void query.refetch()}>{t("retry")}</button>
        </p>
      ) : view === "all" ? (
        <div className="kanban">
          {columns.map((column, index) => (
            <TaskColumnCard
              key={column.id}
              column={column}
              tasks={tasks.filter((x) => x.columnId === column.id)}
              actions={columnActions(column, index)}
              onAdd={() => setTask({ columnId: column.id })}
              onEdit={() => setEditor({ ...column })}
              manualOrder={sort === "order"}
              matchTask={matchTask}
              onMoveTask={(drag, target, after) =>
                moveTask(drag, column, target, after)
              }
              onReorder={(drag, after) => reorderColumn(drag, column, after)}
            />
          ))}
        </div>
      ) : (
        <div className="task-list">
          {tasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              index={index}
              projection
              searchMatch={matchTask(task)}
            />
          ))}
          {!tasks.length && <p className="empty">{t("emptyTasks")}</p>}
        </div>
      )}
      {!columns.length && (
        <button onClick={addColumn}>
          <Plus size={16} />
          {t("addColumn")}
        </button>
      )}
      {query.hasNextPage && (
        <button
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          {t("loadMore")}
        </button>
      )}
      {editor && (
        <EntityEditor
          kind="task-columns"
          value={editor}
          onClose={() => setEditor(null)}
        />
      )}
      {deleting && (
        <Dialog
          title={t("delete") + " · " + deleting.name}
          onClose={() => setDeleting(null)}
          role="alertdialog"
        >
          <p>{t("deleteColumnHelp")}</p>
          <label>
            {t("target")}
            <select
              data-dialog-input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            >
              {columns
                .filter((x) => x.id !== deleting.id)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </label>
          {deleteError && (
            <p role="alert" className="error">
              {deleteError}
            </p>
          )}
          <footer>
            <button
              disabled={!destination || deletingBusy}
              onClick={() => void removeColumn(false)}
            >
              {t("moveAndDeleteColumn")}
            </button>
            <button
              disabled={deletingBusy}
              onClick={() => void removeColumn(true)}
            >
              {t("archiveColumn")}
            </button>
            <button onClick={() => setDeleting(null)}>{t("cancel")}</button>
          </footer>
        </Dialog>
      )}
    </section>
  );
}
