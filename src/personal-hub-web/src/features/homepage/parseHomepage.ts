import { parse } from "yaml";
import { t } from "../../i18n";
import { safeUrl } from "../../api";

interface HomepageLink {
  title: string;
  url: string;
  description: string;
  service: boolean;
  favorite: boolean;
  openInNewTab: boolean;
}

interface HomepageSection {
  name: string;
  layoutMode: "list" | "grid";
  desktopColumns: number;
  collapsed: boolean;
  links: HomepageLink[];
}

interface HomepageTab {
  name: string;
  sections: HomepageSection[];
}

type Mapping = Record<string, unknown>;
type SourceFiles = Partial<
  Record<"settings.yaml" | "services.yaml" | "bookmarks.yaml", string>
>;

function mapping(value: unknown): Mapping {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Mapping)
    : {};
}

function pairs(value: unknown) {
  return (Array.isArray(value) ? value : [value]).flatMap((entry) =>
    Object.entries(mapping(entry)),
  );
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseHomepage(files: SourceFiles) {
  function read(file: keyof SourceFiles) {
    const source = files[file];
    if (!source) return undefined;
    try {
      return parse(source, { maxAliasCount: 0 }) as unknown;
    } catch {
      throw new Error(t("homepageInvalidFile", { file }));
    }
  }

  const rawSettings = read("settings.yaml");
  if (
    rawSettings != null &&
    (typeof rawSettings !== "object" || Array.isArray(rawSettings))
  )
    throw new Error(t("homepageInvalidFile", { file: "settings.yaml" }));
  const settings = mapping(rawSettings);
  const layout = new Map<string, { options: Mapping; tab: string }>();
  function readLayout(value: unknown, path: string[] = [], parentTab = "") {
    for (const [name, entry] of pairs(value)) {
      const options = mapping(entry);
      const groupPath = [...path, name];
      const tab = text(options.tab) || parentTab;
      layout.set(JSON.stringify(groupPath), { options, tab });
      readLayout(
        Object.fromEntries(
          Object.entries(options).filter(
            ([, option]) =>
              option !== null &&
              typeof option === "object" &&
              !Array.isArray(option),
          ),
        ),
        groupPath,
        tab,
      );
    }
  }
  readLayout(settings.layout);

  const groups = new Map<string, { path: string[]; links: HomepageLink[] }>();
  let skipped = 0;
  function readGroups(value: unknown[], service: boolean, path: string[] = []) {
    for (const [name, entry] of pairs(value)) {
      // Services may nest groups. Bookmarks wrap each link's attributes in a list.
      if (
        Array.isArray(entry) &&
        (path.length === 0 ||
          (service &&
            !entry.some((part) => Object.hasOwn(mapping(part), "href"))))
      ) {
        readGroups(entry, service, [...path, name]);
        continue;
      }
      const attrs = Array.isArray(entry)
        ? (Object.assign({}, ...entry.map(mapping)) as Mapping)
        : mapping(entry);
      const url = text(attrs.href);
      if (
        !path.length ||
        !/^https?:\/\//i.test(url) ||
        url.length > 2048 ||
        !safeUrl(url)
      ) {
        skipped++;
        continue;
      }
      const key = JSON.stringify(path);
      const group = groups.get(key) ?? { path, links: [] };
      groups.set(key, group);
      group.links.push({
        title: name.trim(),
        url,
        description: text(attrs.description),
        service,
        favorite: /szybki dostęp|quick (access|links)/iu.test(path[0]),
        openInNewTab: !["_self", "_parent", "_top"].includes(
          text(attrs.target) || text(settings.target),
        ),
      });
    }
  }

  for (const file of ["services.yaml", "bookmarks.yaml"] as const) {
    const value = read(file);
    if (value == null) continue;
    if (!Array.isArray(value))
      throw new Error(t("homepageInvalidFile", { file }));
    readGroups(value, file === "services.yaml");
  }

  const tabs = new Map<string, HomepageTab>();
  const firstNamedTab = [...layout.values()].find(({ tab }) => tab)?.tab;
  for (const key of new Set([...layout.keys(), ...groups.keys()])) {
    const group = groups.get(key);
    if (!group) continue;
    const { options, tab } = layout.get(key) ?? { options: {}, tab: "" };
    const tabName =
      tab ||
      (group.links.some((link) => link.favorite) && firstNamedTab) ||
      "Homepage";
    const target = tabs.get(tabName) ?? { name: tabName, sections: [] };
    tabs.set(tabName, target);
    const columns =
      typeof options.columns === "number" && Number.isInteger(options.columns)
        ? Math.max(1, Math.min(options.columns, 6))
        : 4;
    target.sections.push({
      name: group.path.join(" / "),
      layoutMode: options.style === "column" ? "list" : "grid",
      desktopColumns: columns,
      collapsed:
        (options.initiallyCollapsed ?? settings.groupsInitiallyCollapsed) ===
        true,
      links: group.links,
    });
  }
  if (tabs.size === 0) throw new Error(t("homepageNoLinks"));
  return { document: { tabs: [...tabs.values()] }, skipped };
}

export async function readHomepageFiles(files: File[]) {
  const sources: SourceFiles = {};
  for (const file of files) {
    const name = file.name.toLowerCase().replace(/\.yml$/, ".yaml");
    if (
      name !== "settings.yaml" &&
      name !== "services.yaml" &&
      name !== "bookmarks.yaml"
    )
      continue;
    if (sources[name] !== undefined || file.size > 1024 * 1024)
      throw new Error(t("homepageInvalidFile", { file: file.name }));
    sources[name] = await file.text();
  }
  return parseHomepage(sources);
}
