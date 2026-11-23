import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHub } from "../../HubContext";
import type { Item, Section, Tab } from "../../types";
import type { MenuAction } from "../../components/ActionMenu";
import type { MoveRequest } from "../../components/MoveDialog";
import { automaticIcon } from "../../components/Icon";
import { t } from "../../i18n";

export interface DashboardEditor {
  kind: "tabs" | "sections" | "items";
  value: Record<string, unknown>;
  appearance?: boolean;
}
export function useDashboardActions(activeTab?: Tab) {
  const { data, mutate } = useHub();
  const navigate = useNavigate();
  const [editor, setEditor] = useState<DashboardEditor | null>(null);
  const [move, setMove] = useState<MoveRequest | null>(null);
  const [deletion, setDeletion] = useState<{
    label: string;
    path: string;
  } | null>(null);
  const run = (input: Parameters<typeof mutate>[0]) => {
    void mutate(input).catch(() => {});
  };
  const itemMove = (item: Item, target: string, index: number) =>
    mutate({
      path: "/items/move",
      body: {
        itemId: item.id,
        targetSectionId: target,
        targetIndex: index,
        expectedVersion: item.version,
      },
    });
  const sectionMove = (section: Section, target: string, index: number) =>
    mutate({
      path: "/sections/move",
      body: {
        sectionId: section.id,
        targetTabId: target,
        targetIndex: index,
        expectedVersion: section.version,
      },
    });
  const tabMove = (tab: Tab, index: number) => {
    const ids = data.tabs.map((x) => x.id).filter((id) => id !== tab.id);
    ids.splice(index, 0, tab.id);
    return mutate({ path: "/tabs/reorder", body: { orderedIds: ids } });
  };
  function addTab() {
    setEditor({
      kind: "tabs",
      value: {
        name: "",
        iconKey: "lucide:folder",
        accentColor: data.settings.accent,
        isHidden: false,
      },
    });
  }
  function addSection() {
    if (activeTab)
      setEditor({
        kind: "sections",
        value: {
          tabId: activeTab.id,
          name: "",
          description: "",
          iconKey: "lucide:folder",
          accentColor: data.settings.accent,
          layoutMode: "grid",
          desktopColumns: 4,
          tabletColumns: 2,
          mobileColumns: 1,
          widthPercent: 100,
          isCollapsed: false,
        },
      });
  }
  function addItem(section: Section) {
    setEditor({
      kind: "items",
      value: {
        sectionId: section.id,
        title: "",
        url: "",
        description: "",
        itemType: "compact-link",
        iconKey: automaticIcon,
        accentColor: data.settings.accent,
        openInNewTab: true,
        showUrl: false,
        isFavorite: false,
        tagIds: [],
      },
    });
  }
  function itemActions(item: Item): MenuAction[] {
    const index = data.items
      .filter((x) => x.sectionId === item.sectionId)
      .findIndex((x) => x.id === item.id);
    const open = (appearance = false) =>
      setEditor({
        kind: "items",
        value: { ...item, tagIds: item.tags.map((x) => x.id) },
        appearance,
      });
    return [
      {
        id: "edit",
        label: t("edit"),
        onSelect: () => open(),
        opensDialog: true,
      },
      {
        id: "appearance",
        label: t("customizeAppearance"),
        onSelect: () => open(true),
        opensDialog: true,
      },
      {
        id: "favorite",
        label: t(item.isFavorite ? "removeFavorite" : "addFavorite"),
        onSelect: () =>
          run({
            path: "/items/" + item.id,
            method: "PATCH",
            body: {
              isFavorite: !item.isFavorite,
              expectedVersion: item.version,
            },
          }),
      },
      {
        id: "move",
        label: t("move") + "…",
        separator: true,
        opensDialog: true,
        onSelect: () =>
          setMove({
            label: item.title,
            current: item.sectionId,
            index,
            targets: data.sections.map((s) => ({
              id: s.id,
              name: `${data.tabs.find((tab) => tab.id === s.tabId)?.name} / ${s.name}`,
            })),
            onMove: (target, i) => itemMove(item, target, i),
          }),
      },
      {
        id: "up",
        label: t("moveUp"),
        disabled: index === 0,
        onSelect: () => {
          void itemMove(item, item.sectionId, index - 1).catch(() => {});
        },
      },
      {
        id: "down",
        label: t("moveDown"),
        disabled:
          index ===
          data.items.filter((x) => x.sectionId === item.sectionId).length - 1,
        onSelect: () => {
          void itemMove(item, item.sectionId, index + 1).catch(() => {});
        },
      },
      {
        id: "duplicate",
        label: t("duplicate"),
        onSelect: () => run({ path: `/items/${item.id}/duplicate` }),
      },
      {
        id: "delete",
        label: t("delete"),
        danger: true,
        separator: true,
        opensDialog: true,
        onSelect: () =>
          setDeletion({ label: item.title, path: "/items/" + item.id }),
      },
    ];
  }
  function sectionActions(section: Section): MenuAction[] {
    const index = data.sections
      .filter((x) => x.tabId === section.tabId)
      .findIndex((x) => x.id === section.id);
    return [
      {
        id: "add",
        label: t("addItem"),
        onSelect: () => addItem(section),
        opensDialog: true,
      },
      {
        id: "edit",
        label: t("edit"),
        onSelect: () => setEditor({ kind: "sections", value: { ...section } }),
        opensDialog: true,
      },
      {
        id: "appearance",
        label: t("customizeAppearance"),
        onSelect: () =>
          setEditor({
            kind: "sections",
            value: { ...section },
            appearance: true,
          }),
        opensDialog: true,
      },
      {
        id: "collapse",
        label: t(section.isCollapsed ? "expand" : "collapse"),
        onSelect: () =>
          run({
            path: "/sections/" + section.id,
            method: "PATCH",
            body: {
              isCollapsed: !section.isCollapsed,
              expectedVersion: section.version,
            },
          }),
      },
      {
        id: "move",
        label: t("move") + "…",
        separator: true,
        opensDialog: true,
        onSelect: () =>
          setMove({
            label: section.name,
            current: section.tabId,
            index,
            targets: data.tabs.map((x) => ({ id: x.id, name: x.name })),
            onMove: (target, i) => sectionMove(section, target, i),
          }),
      },
      {
        id: "up",
        label: t("moveUp"),
        disabled: index === 0,
        onSelect: () => {
          void sectionMove(section, section.tabId, index - 1).catch(() => {});
        },
      },
      {
        id: "down",
        label: t("moveDown"),
        disabled:
          index ===
          data.sections.filter((x) => x.tabId === section.tabId).length - 1,
        onSelect: () => {
          void sectionMove(section, section.tabId, index + 1).catch(() => {});
        },
      },
      {
        id: "delete",
        label: t("delete"),
        danger: true,
        separator: true,
        opensDialog: true,
        onSelect: () =>
          setDeletion({
            label: section.name,
            path: `/sections/${section.id}?cascade=true`,
          }),
      },
    ];
  }
  function tabActions(tab: Tab): MenuAction[] {
    const index = data.tabs.findIndex((x) => x.id === tab.id);
    return [
      {
        id: "edit",
        label: t("edit"),
        onSelect: () => setEditor({ kind: "tabs", value: { ...tab } }),
        opensDialog: true,
      },
      {
        id: "appearance",
        label: t("customizeAppearance"),
        onSelect: () =>
          setEditor({ kind: "tabs", value: { ...tab }, appearance: true }),
        opensDialog: true,
      },
      {
        id: "up",
        label: t("moveUp"),
        disabled: index === 0,
        onSelect: () => {
          void tabMove(tab, index - 1).catch(() => {});
        },
      },
      {
        id: "down",
        label: t("moveDown"),
        disabled: index === data.tabs.length - 1,
        onSelect: () => {
          void tabMove(tab, index + 1).catch(() => {});
        },
      },
      {
        id: "delete",
        label: t("delete"),
        danger: true,
        separator: true,
        opensDialog: true,
        onSelect: () =>
          setDeletion({
            label: tab.name,
            path: `/tabs/${tab.id}?cascade=true`,
          }),
      },
    ];
  }
  const dashboardActions: MenuAction[] = [
    {
      id: "section",
      label: t("addSection"),
      disabled: !activeTab,
      onSelect: addSection,
      opensDialog: true,
    },
    { id: "tab", label: t("addTab"), onSelect: addTab, opensDialog: true },
    {
      id: "appearance",
      label: t("customizeAppearance"),
      onSelect: () => navigate("/settings"),
    },
    ...data.tabs
      .filter((x) => x.isHidden)
      .map((tab) => ({
        id: tab.id,
        label: t("showTab", { name: tab.name }),
        onSelect: () =>
          run({
            path: "/tabs/" + tab.id,
            method: "PATCH",
            body: { isHidden: false, expectedVersion: tab.version },
          }),
      })),
  ];
  return {
    editor,
    setEditor,
    move,
    setMove,
    deletion,
    setDeletion,
    itemActions,
    sectionActions,
    tabActions,
    dashboardActions,
    addTab,
    addSection,
    addItem,
    itemMove,
    sectionMove,
    tabMove,
  };
}
export type DashboardActions = ReturnType<typeof useDashboardActions>;
