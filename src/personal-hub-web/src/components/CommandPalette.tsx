import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, safeUrl } from "../api";
import type { TaskPage } from "../types";
import { useHub } from "../HubContext";
import { t } from "../i18n";
import { Dialog } from "./Dialog";
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const { data, setTask } = useHub();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [index, setIndex] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 200);
    setIndex(0);
    return () => clearTimeout(id);
  }, [search]);
  const query = useQuery({
    queryKey: ["search", debounced],
    queryFn: () =>
      api<TaskPage>("/tasks?limit=20&q=" + encodeURIComponent(debounced)),
    enabled: debounced.trim().length > 0,
  });
  const matches = (name: string) =>
    name.toLocaleLowerCase("pl").includes(search.toLocaleLowerCase("pl"));
  const results = [
    ...data.items
      .filter((x) => matches(x.title) && safeUrl(x.url))
      .map((x) => ({
        id: x.id,
        title: x.title,
        type: t("items"),
        action: () => {
          if (x.openInNewTab)
            window.open(x.url!, "_blank", "noopener,noreferrer");
          else location.assign(x.url!);
        },
      })),
    ...data.tabs
      .filter((x) => matches(x.name))
      .map((x) => ({
        id: x.id,
        title: x.name,
        type: t("tab"),
        action: () => {
          localStorage.setItem("activeTab", x.id);
          navigate("/");
          window.dispatchEvent(new Event("personalhub-tab"));
        },
      })),
    ...data.sections
      .filter((x) => matches(x.name))
      .map((x) => ({
        id: x.id,
        title: x.name,
        type: t("section"),
        action: () => {
          localStorage.setItem("activeTab", x.tabId);
          navigate("/");
          window.dispatchEvent(new Event("personalhub-tab"));
        },
      })),
    ...(query.data?.tasks ?? []).map((x) => ({
      id: x.id,
      title: x.title,
      type: t("tasks"),
      action: () => setTask(x),
    })),
  ].slice(0, 50);
  const activate = (i: number) => {
    results[i]?.action();
    onClose();
  };
  useEffect(() => {
    list.current?.children[index]?.scrollIntoView?.({ block: "nearest" });
  }, [index]);
  return (
    <Dialog title={t("searchResults")} onClose={onClose}>
      <div
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndex((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            activate(index);
          }
        }}
      >
        <label>
          <span className="sr-only">{t("search")}</span>
          <input
            data-dialog-input
            type="search"
            value={search}
            placeholder={t("search")}
            aria-controls="palette-results"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <p className="sr-only" role="status">
          {results[index]?.title ?? t("noResults")}
        </p>
        <div id="palette-results" className="palette-results" ref={list}>
          {results.map((x, i) => (
            <button
              key={x.id}
              className={i === index ? "selected" : ""}
              onFocus={() => setIndex(i)}
              onClick={() => activate(i)}
            >
              <span>{x.title}</span>
              <small>{x.type}</small>
            </button>
          ))}
          {!results.length && <p>{t("noResults")}</p>}
        </div>
        {data.settings.externalSearch && search.trim() && (
          <button
            onClick={() => {
              const url = data.settings.externalSearch.replace(
                "{q}",
                encodeURIComponent(search),
              );
              if (safeUrl(url))
                window.open(url, "_blank", "noopener,noreferrer");
              onClose();
            }}
          >
            {t("externalSearchAction")}
          </button>
        )}
      </div>
    </Dialog>
  );
}
