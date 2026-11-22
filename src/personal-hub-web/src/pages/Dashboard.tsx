import { lazy, Suspense, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Plus } from "lucide-react";
import { useHub } from "../HubContext";
import { t } from "../i18n";
import { ActionMenu, MenuButton } from "../components/ActionMenu";
import { EntityEditor } from "../components/EntityEditor";
import { MoveDialog } from "../components/MoveDialog";
import { ConfirmDelete } from "../components/ConfirmDelete";
import { DragHandle, readDrag } from "../components/DragHandle";
import { DashboardSectionCard } from "../features/dashboard/DashboardSectionCard";
import { DashboardItemCard } from "../features/dashboard/DashboardItemCard";
import { useDashboardActions } from "../features/dashboard/useDashboardActions";
const TaskModule = lazy(() => import("./Tasks"));

export default function Dashboard() {
  const { data, mutate } = useHub();
  const [selected, setSelected] = useState(
    () => localStorage.getItem("activeTab") ?? "",
  );
  useEffect(() => {
    const sync = () => setSelected(localStorage.getItem("activeTab") ?? "");
    window.addEventListener("personalhub-tab", sync);
    return () => window.removeEventListener("personalhub-tab", sync);
  }, []);
  const tabs = data.tabs.filter((tab) => !tab.isHidden);
  const active = tabs.find((tab) => tab.id === selected) ?? tabs[0];
  const sections = data.sections.filter(
    (section) => section.tabId === active?.id,
  );
  const actions = useDashboardActions(active);
  function select(id: string) {
    setSelected(id);
    localStorage.setItem("activeTab", id);
  }
  return (
    <>
      <h1 className="sr-only">{t("app")}</h1>
      <ActionMenu label={t("app")} actions={actions.dashboardActions}>
        <div className="dashboard-content">
          <div className="dashboard-navigation">
            <nav className="tabs" aria-label={t("tabs")}>
              {tabs.map((tab) => (
                <ActionMenu
                  key={tab.id}
                  label={tab.name}
                  actions={actions.tabActions(tab)}
                >
                  <div
                    style={{ "--tab-accent": tab.accentColor } as CSSProperties}
                    className={
                      "tab-entry " + (active?.id === tab.id ? "is-active" : "")
                    }
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const drag = readDrag(e);
                      if (drag?.kind === "section") {
                        const section = data.sections.find(
                          (x) => x.id === drag.id,
                        );
                        if (section)
                          void actions
                            .sectionMove(
                              section,
                              tab.id,
                              data.sections.filter((x) => x.tabId === tab.id)
                                .length,
                            )
                            .catch(() => {});
                      } else if (drag?.kind === "tab") {
                        const source = data.tabs.find((x) => x.id === drag.id);
                        if (source)
                          void actions
                            .tabMove(
                              source,
                              data.tabs.findIndex((x) => x.id === tab.id),
                            )
                            .catch(() => {});
                      }
                    }}
                  >
                    <button
                      className="tab-label"
                      aria-current={active?.id === tab.id ? "page" : undefined}
                      onClick={() => select(tab.id)}
                    >
                      {tab.name}
                    </button>
                    <div className="tab-tools">
                      <DragHandle
                        data={{
                          kind: "tab",
                          id: tab.id,
                          container: "tabs",
                          version: tab.version,
                        }}
                      />
                      <MenuButton
                        label={tab.name}
                        actions={actions.tabActions(tab)}
                      />
                    </div>
                  </div>
                </ActionMenu>
              ))}
              <button
                className="icon-button add-tab"
                aria-label={t("addTab")}
                title={t("addTab")}
                onClick={actions.addTab}
              >
                <Plus size={17} />
              </button>
            </nav>
            <div className="dashboard-navigation-actions">
              <button
                className="quiet-button"
                disabled={!active}
                onClick={actions.addSection}
              >
                <Plus size={15} />
                {t("addSection")}
              </button>
              <MenuButton label={t("app")} actions={actions.dashboardActions} />
            </div>
          </div>
          {data.settings.quickAccess &&
            data.items.some((item) => item.isFavorite) && (
              <section className="quick-access">
                <h2>{t("quickAccess")}</h2>
                <div>
                  {data.items
                    .filter((item) => item.isFavorite)
                    .map((item, i) => (
                      <DashboardItemCard
                        key={item.id}
                        item={item}
                        index={i}
                        actions={actions}
                        favorite
                      />
                    ))}
                </div>
              </section>
            )}
          <div className="dashboard-grid">
            {sections.map((section, index) => (
              <DashboardSectionCard
                key={section.id}
                section={section}
                index={index}
                actions={actions}
              />
            ))}
          </div>
          {!active && (
            <div className="dashboard-empty">
              <p>{t("emptyTabs")}</p>
              <button onClick={actions.addTab}>
                <Plus size={16} />
                {t("addTab")}
              </button>
            </div>
          )}
          {active && !sections.length && (
            <div className="dashboard-empty">
              <p>{t("emptySections")}</p>
              <button onClick={actions.addSection}>
                <Plus size={16} />
                {t("addSection")}
              </button>
            </div>
          )}
        </div>
      </ActionMenu>
      <Suspense
        fallback={
          <section id="tasks" className="task-module">
            <h2>{t("tasks")}</h2>
            <p role="status">{t("loading")}</p>
          </section>
        }
      >
        <TaskModule />
      </Suspense>
      {actions.editor && (
        <EntityEditor
          kind={actions.editor.kind}
          value={actions.editor.value}
          appearance={actions.editor.appearance}
          onClose={() => actions.setEditor(null)}
        />
      )}
      {actions.move && (
        <MoveDialog
          request={actions.move}
          onClose={() => actions.setMove(null)}
        />
      )}
      {actions.deletion && (
        <ConfirmDelete
          label={actions.deletion.label}
          onClose={() => actions.setDeletion(null)}
          onConfirm={() =>
            mutate({ path: actions.deletion!.path, method: "DELETE" })
          }
        />
      )}
    </>
  );
}
