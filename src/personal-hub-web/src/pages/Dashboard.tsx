import { lazy, Suspense, useState } from "react";
import type { CSSProperties } from "react";
import { Plus } from "lucide-react";
import { useHub } from "../HubContext";
import { makeSearch } from "../search";
import { t } from "../i18n";
import { Icon } from "../components/Icon";
import { ActionMenu, MenuButton } from "../components/ActionMenu";
import { EntityEditor } from "../components/EntityEditor";
import { MoveDialog } from "../components/MoveDialog";
import { ConfirmDelete } from "../components/ConfirmDelete";
import {
  dragSource,
  dropTarget,
  insertionIndex,
  useDragMotion,
} from "../components/drag";
import { DashboardSectionCard } from "../features/dashboard/DashboardSectionCard";
import { DashboardItemCard } from "../features/dashboard/DashboardItemCard";
import { useDashboardActions } from "../features/dashboard/useDashboardActions";
const TaskModule = lazy(() => import("./Tasks"));

export default function Dashboard({ search = "" }: { search?: string }) {
  const { data, mutate } = useHub();
  const dragBoard = useDragMotion<HTMLDivElement>();
  const [selected, setSelected] = useState(
    () => localStorage.getItem("activeTab") ?? "",
  );
  const [searchTab, setSearchTab] = useState<string | null>(null);
  const [previousSearch, setPreviousSearch] = useState(search);
  if (previousSearch !== search) {
    setPreviousSearch(search);
    setSearchTab(null);
  }
  const { active: searching, matches } = makeSearch(search);
  const tabs = data.tabs.filter((tab) => !tab.isHidden);
  const visibleTabIds = new Set(tabs.map((tab) => tab.id));
  const visibleSections = data.sections.filter((section) =>
    visibleTabIds.has(section.tabId),
  );
  const matchingCards = searching
    ? data.items.filter(
        (item) =>
          item.itemType !== "spacer" &&
          matches(
            item.title,
            item.description,
            item.url,
            ...item.tags.map((tag) => tag.name),
          ),
      )
    : [];
  const matchingItems = new Set(matchingCards.map((item) => item.id));
  const sectionsWithMatches = new Set(
    matchingCards.map((item) => item.sectionId),
  );
  const matchingSections = new Set(
    searching
      ? visibleSections
          .filter(
            (section) =>
              sectionsWithMatches.has(section.id) ||
              matches(section.name, section.description),
          )
          .map((section) => section.id)
      : [],
  );
  const tabsWithMatches = new Set(
    visibleSections
      .filter((section) => matchingSections.has(section.id))
      .map((section) => section.tabId),
  );
  const tabMatches = (tab: (typeof tabs)[number]) =>
    tabsWithMatches.has(tab.id) || matches(tab.name);
  const tabsWithMatchingCards = new Set(
    visibleSections
      .filter((section) => sectionsWithMatches.has(section.id))
      .map((section) => section.tabId),
  );
  const normalTab = tabs.find((tab) => tab.id === selected) ?? tabs[0];
  const firstMatchingCardTab = tabs.find((tab) =>
    tabsWithMatchingCards.has(tab.id),
  );
  const active = searching
    ? (tabs.find((tab) => tab.id === searchTab) ??
      (normalTab && tabsWithMatchingCards.has(normalTab.id)
        ? normalTab
        : firstMatchingCardTab) ??
      (normalTab && tabMatches(normalTab)
        ? normalTab
        : (tabs.find(tabMatches) ?? normalTab)))
    : normalTab;
  const sections = visibleSections.filter(
    (section) => section.tabId === active?.id,
  );
  const actions = useDashboardActions(active);
  function select(id: string) {
    if (searching) {
      setSearchTab(id);
      return;
    }
    setSelected(id);
    localStorage.setItem("activeTab", id);
  }
  return (
    <>
      <h1 className="sr-only">{t("app")}</h1>
      <ActionMenu label={t("app")} actions={actions.dashboardActions}>
        <div className="dashboard-content" data-drag-board ref={dragBoard}>
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
                        searchMatch={
                          searching ? matchingItems.has(item.id) : undefined
                        }
                        favorite
                      />
                    ))}
                </div>
              </section>
            )}
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
                    data-search-match={searching ? tabMatches(tab) : undefined}
                    {...dragSource({
                      kind: "tab",
                      id: tab.id,
                      container: "tabs",
                      version: tab.version,
                    })}
                    data-drag-card={"tab:" + tab.id}
                    {...dropTarget(
                      (drag) =>
                        drag.kind === "section"
                          ? "inside"
                          : drag.kind === "tab" && drag.id !== tab.id
                            ? "horizontal"
                            : undefined,
                      (drag, position) => {
                        if (drag.kind === "section") {
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
                        } else {
                          const source = data.tabs.findIndex(
                            (x) => x.id === drag.id,
                          );
                          const target = data.tabs.findIndex(
                            (x) => x.id === tab.id,
                          );
                          if (source >= 0)
                            void actions
                              .tabMove(
                                data.tabs[source],
                                insertionIndex(
                                  target,
                                  source,
                                  position === "after",
                                ),
                              )
                              .catch(() => {});
                        }
                      },
                    )}
                  >
                    <button
                      data-drag-trigger
                      className="tab-label"
                      aria-current={active?.id === tab.id ? "page" : undefined}
                      onClick={() => select(tab.id)}
                    >
                      <Icon name={tab.iconKey} />
                      <span>{tab.name}</span>
                    </button>
                    <div className="tab-tools">
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
          <div className="dashboard-grid">
            {sections.map((section, index) => (
              <DashboardSectionCard
                key={section.id}
                section={section}
                index={index}
                actions={actions}
                searchMatch={
                  searching ? matchingSections.has(section.id) : undefined
                }
                matchingItems={searching ? matchingItems : undefined}
                revealItems={sectionsWithMatches.has(section.id)}
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
        <TaskModule dashboardSearch={search} />
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
