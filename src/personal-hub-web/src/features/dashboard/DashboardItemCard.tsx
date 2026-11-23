import { useHub } from "../../HubContext";
import type { CSSProperties } from "react";
import type { Item } from "../../types";
import type { DashboardActions } from "./useDashboardActions";
import { ActionMenu, MenuButton } from "../../components/ActionMenu";
import { dragSource, dropTarget, insertionIndex } from "../../components/drag";
import { TagBadge } from "../../components/Tags";
import { Icon } from "../../components/Icon";
import { Markdown } from "../../components/Markdown";
import { safeUrl } from "../../api";
import { t } from "../../i18n";
export function DashboardItemCard({
  item,
  index,
  actions,
  favorite = false,
  searchMatch,
}: {
  item: Item;
  index: number;
  actions: DashboardActions;
  favorite?: boolean;
  searchMatch?: boolean;
}) {
  const { data } = useHub();
  const menu = actions.itemActions(item);
  const openEditor = () =>
    actions.setEditor({
      kind: "items",
      value: { ...item, tagIds: item.tags.map((tag) => tag.id) },
    });
  const tags = item.tags.length > 0 && (
    <span className="item-tags">
      {item.tags.map((tag) => (
        <TagBadge key={tag.id} tag={tag} />
      ))}
    </span>
  );
  const content = (
    <>
      <Icon name={item.iconKey} url={item.url} />
      <span className="item-copy">
        <strong>{item.title}</strong>
        {["detailed-link", "service-card"].includes(item.itemType) &&
          item.description && <span>{item.description}</span>}
        {item.showUrl && safeUrl(item.url) && (
          <span className="item-address">{item.url}</span>
        )}
        {tags}
      </span>
    </>
  );
  return (
    <ActionMenu label={item.title} actions={menu}>
      <article
        className={"dashboard-item " + item.itemType}
        style={{ "--entity-accent": item.accentColor } as CSSProperties}
        tabIndex={item.itemType === "note" ? 0 : undefined}
        data-search-match={searchMatch}
        {...(!favorite &&
          dragSource(
            {
              kind: "item",
              id: item.id,
              container: item.sectionId,
              version: item.version,
            },
            openEditor,
          ))}
        data-drag-card={favorite ? undefined : "item:" + item.id}
        {...(!favorite &&
          dropTarget(
            (drag) =>
              drag.kind === "item"
                ? drag.id === item.id
                  ? "self"
                  : "grid"
                : undefined,
            (drag, position) => {
              const source = data.items.find((x) => x.id === drag.id);
              if (!source) return;
              const sourceIndex = data.items
                .filter((x) => x.sectionId === item.sectionId)
                .findIndex((x) => x.id === source.id);
              void actions
                .itemMove(
                  source,
                  item.sectionId,
                  insertionIndex(index, sourceIndex, position === "after"),
                )
                .catch(() => {});
            },
          ))}
      >
        {item.itemType === "note" ? (
          <div className="note-content">
            <h3>
              <button
                type="button"
                className="text-button entity-heading-button"
                data-drag-trigger
                onClick={openEditor}
              >
                {item.title}
              </button>
            </h3>
            <Markdown text={item.description} />
            {tags}
          </div>
        ) : item.itemType === "spacer" ? (
          <button
            type="button"
            className="spacer spacer-button"
            aria-label={t("spacer")}
            data-drag-trigger
            onClick={openEditor}
          />
        ) : safeUrl(item.url) ? (
          <a
            data-drag-trigger
            className="item-main"
            href={item.url!}
            aria-label={item.title}
            target={item.openInNewTab ? "_blank" : undefined}
            rel={item.openInNewTab ? "noopener noreferrer" : undefined}
          >
            {content}
          </a>
        ) : (
          <button
            type="button"
            className="item-main"
            data-drag-trigger
            onClick={openEditor}
          >
            {content}
          </button>
        )}
        <div className="item-controls">
          <MenuButton label={item.title} actions={menu} />
        </div>
      </article>
    </ActionMenu>
  );
}
