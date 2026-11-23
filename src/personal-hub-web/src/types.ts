export interface Entity {
  id: string;
  version: number;
  sortOrder: number;
}
export interface Tag extends Entity {
  name: string;
  color: string;
}
export interface Tab extends Entity {
  name: string;
  iconKey: string;
  accentColor: string;
  isHidden: boolean;
}
export interface Section extends Entity {
  tabId: string;
  name: string;
  description: string;
  iconKey: string;
  accentColor: string;
  isCollapsed: boolean;
  layoutMode: string;
  desktopColumns: number;
  tabletColumns: number;
  mobileColumns: number;
  widthPercent: number;
}
export interface Item extends Entity {
  sectionId: string;
  itemType: string;
  title: string;
  url: string | null;
  description: string;
  iconKey: string;
  accentColor: string;
  openInNewTab: boolean;
  showUrl?: boolean;
  isFavorite: boolean;
  tags: Tag[];
}
export interface Column extends Entity {
  name: string;
  color: string;
  isDone: boolean;
  wipLimit: number | null;
  isArchived: boolean;
}
export interface Checklist {
  id?: string;
  title: string;
  isChecked: boolean;
}
export interface TaskLink {
  id?: string;
  title: string;
  url: string;
}
export interface HubTask extends Entity {
  columnId: string;
  title: string;
  descriptionMarkdown: string;
  priority: string;
  dueDate: string | null;
  dueTime: string | null;
  startDate: string | null;
  completedAt: string | null;
  isArchived: boolean;
  relatedDashboardItemId: string | null;
  tags: Tag[];
  checklist: Checklist[];
  links: TaskLink[];
}
export interface Settings {
  timezone: string;
  theme: string;
  accent: string;
  density: string;
  radius: number;
  width: number;
  columns: number;
  clockVisible: boolean;
  clockSeconds: boolean;
  clockFormat: string;
  dateFormat: string;
  iconSize: number;
  language: string;
  showOverdueInToday: boolean;
  quickAccess: boolean;
  externalSearch: string;
}
export interface Summary {
  todayCount: number;
  overdueCount: number;
  next7Count: number;
}
export interface Bootstrap {
  tabs: Tab[];
  sections: Section[];
  items: Item[];
  tags: Tag[];
  columns: Column[];
  settings: Settings;
  today: string;
  todayTasks: HubTask[];
  taskSummary: Summary;
}
export interface TaskPage {
  today: string;
  tasks: HubTask[];
  total: number;
  nextCursor: string | null;
}

export interface IconInfo {
  id: string;
  fileName: string;
  sizeBytes: number;
}
