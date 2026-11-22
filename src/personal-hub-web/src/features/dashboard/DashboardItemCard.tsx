import { useHub } from "../../HubContext";
import type { CSSProperties } from "react";
import type { Item } from "../../types";
import type { DashboardActions } from "./useDashboardActions";
import { ActionMenu, MenuButton } from "../../components/ActionMenu";
import { DragHandle, readDrag } from "../../components/DragHandle";
import { Icon } from "../../components/Icon";
import { Markdown } from "../../components/Markdown";
import { safeUrl } from "../../api";
import { t } from "../../i18n";
export function DashboardItemCard({
  item,
  index,
  actions,
  favorite = false,
}: {
  item: Item;
  index: number;
  actions: DashboardActions;
  favorite?: boolean;
}) {
  const { data } = useHub();
  const menu = actions.itemActions(item);
  const content = (
    <>
      <Icon name={item.iconKey} />
      <span className="item-copy">
        <strong>{item.title}</strong>
        {["detailed-link", "service-card"].includes(item.itemType) &&
          item.description && <span>{item.description}</span>}
      </span>
    </>
  );
  return (
    <ActionMenu label={item.title} actions={menu}>
      <article
        className={"dashboard-item " + item.itemType}
        style={{ "--entity-accent": item.accentColor } as CSSProperties}
        tabIndex={item.itemType === "note" ? 0 : undefined}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const drag = readDrag(e);
          if (drag?.kind === "item") {
            e.preventDefault();
            e.stopPropagation();
            const source = data.items.find((x) => x.id === drag.id);
            if (source)
              void actions
                .itemMove(source, item.sectionId, index)
                .catch(() => {});
          }
        }}
      >
        {item.itemType === "note" ? (
          <div className="note-content">
            <h3>{item.title}</h3>
            <Markdown text={item.description} />
          </div>
        ) : item.itemType === "spacer" ? (
          <div className="spacer" aria-label={t("spacer")} />
        ) : safeUrl(item.url) ? (
          <a
            className="item-main"
            href={item.url!}
            target={item.openInNewTab ? "_blank" : undefined}
            rel={item.openInNewTab ? "noopener noreferrer" : undefined}
          >
            {content}
          </a>
        ) : (
          <div className="item-main">{content}</div>
        )}
        <div className="item-controls">
          {!favorite && (
            <DragHandle
              data={{
                kind: "item",
                id: item.id,
                container: item.sectionId,
                version: item.version,
              }}
            />
          )}
          <MenuButton label={item.title} actions={menu} />
        </div>
      </article>
    </ActionMenu>
  );
}
