import type { CSSProperties } from "react";
import { Columns2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { useHub } from "../../HubContext";
import type { Section } from "../../types";
import type { DashboardActions } from "./useDashboardActions";
import { ActionMenu, MenuButton } from "../../components/ActionMenu";
import { dragSource, dropTarget, insertionIndex } from "../../components/drag";
import { Icon } from "../../components/Icon";
import { DashboardItemCard } from "./DashboardItemCard";
import { t } from "../../i18n";
const spans: Record<number, number> = {
  25: 3,
  33: 4,
  50: 6,
  66: 8,
  75: 9,
  100: 12,
};
export function DashboardSectionCard({
  section,
  index,
  actions,
  searchMatch,
  matchingItems,
  revealItems,
}: {
  section: Section;
  index: number;
  actions: DashboardActions;
  searchMatch?: boolean;
  matchingItems?: Set<string>;
  revealItems: boolean;
}) {
  const { data, mutate } = useHub();
  const menu = actions.sectionActions(section);
  const openEditor = () =>
    actions.setEditor({ kind: "sections", value: { ...section } });
  const items = data.items.filter((x) => x.sectionId === section.id);
  const collapsed = section.isCollapsed && !revealItems;
  const width = section.widthPercent ?? 100;
  return (
    <ActionMenu label={section.name} actions={menu}>
      <section
        className="dashboard-section"
        style={
          {
            "--section-span": spans[width] ?? 12,
            "--entity-accent": section.accentColor,
            "--section-tablet-span": width <= 50 ? 6 : 12,
            "--section-desktop": Math.min(
              section.desktopColumns ?? 4,
              width <= 33 ? 1 : width <= 50 ? 2 : 6,
            ),
            "--section-tablet": section.tabletColumns ?? 2,
            "--section-mobile": section.mobileColumns ?? 1,
          } as CSSProperties
        }
        data-search-match={searchMatch}
        {...dragSource(
          {
            kind: "section",
            id: section.id,
            container: section.tabId,
            version: section.version,
          },
          openEditor,
        )}
        data-drag-card={"section:" + section.id}
        {...dropTarget(
          (drag) =>
            drag.kind === "item"
              ? "inside"
              : drag.kind === "section" && drag.id !== section.id
                ? "grid"
                : undefined,
          (drag, position) => {
            if (drag.kind === "item") {
              const item = data.items.find((x) => x.id === drag.id);
              if (item)
                void actions
                  .itemMove(item, section.id, items.length)
                  .catch(() => {});
            } else {
              const source = data.sections.find((x) => x.id === drag.id);
              if (source) {
                const sourceIndex = data.sections
                  .filter((x) => x.tabId === section.tabId)
                  .findIndex((x) => x.id === source.id);
                void actions
                  .sectionMove(
                    source,
                    section.tabId,
                    insertionIndex(index, sourceIndex, position === "after"),
                  )
                  .catch(() => {});
              }
            }
          },
        )}
      >
        <div className="section-heading">
          <Icon name={section.iconKey} />
          <h2>
            <button
              type="button"
              className="text-button entity-heading-button"
              data-drag-trigger
              onClick={openEditor}
            >
              {section.name}
            </button>
          </h2>
          <div className="section-tools">
            <label className="section-width">
              <span className="sr-only">
                {t("sectionWidth")} · {section.name}
              </span>
              <Columns2 size={14} aria-hidden="true" />
              <select
                value={width}
                onChange={(e) =>
                  void mutate({
                    path: "/sections/" + section.id,
                    method: "PATCH",
                    body: {
                      widthPercent: Number(e.target.value),
                      expectedVersion: section.version,
                    },
                  }).catch(() => {})
                }
              >
                {[100, 75, 66, 50, 33, 25].map((value) => (
                  <option key={value} value={value}>
                    {value}%
                  </option>
                ))}
              </select>
            </label>

            <button
              className="icon-button"
              aria-label={
                t(collapsed ? "expand" : "collapse") + " " + section.name
              }
              aria-expanded={!collapsed}
              disabled={revealItems}
              aria-controls={"section-" + section.id}
              onClick={() =>
                void mutate({
                  path: "/sections/" + section.id,
                  method: "PATCH",
                  body: {
                    isCollapsed: !section.isCollapsed,
                    expectedVersion: section.version,
                  },
                }).catch(() => {})
              }
            >
              {collapsed ? (
                <ChevronRight size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
            </button>
            <MenuButton label={section.name} actions={menu} />
          </div>
        </div>
        {!collapsed && (
          <div id={"section-" + section.id}>
            {section.description && (
              <p className="section-description">{section.description}</p>
            )}
            <div
              className={
                "section-items " +
                (section.layoutMode === "list" ? "section-list" : "")
              }
            >
              {items.map((item, i) => (
                <DashboardItemCard
                  key={item.id}
                  item={item}
                  index={i}
                  actions={actions}
                  searchMatch={matchingItems?.has(item.id)}
                />
              ))}
            </div>
            {!items.length && (
              <button
                className="empty-add"
                onClick={() => actions.addItem(section)}
              >
                <Plus size={15} />
                {t("addItem")}
              </button>
            )}
          </div>
        )}
      </section>
    </ActionMenu>
  );
}
