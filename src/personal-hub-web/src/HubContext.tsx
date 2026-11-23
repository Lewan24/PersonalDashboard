import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, dateInZone } from "./api";
import type { Bootstrap, HubTask } from "./types";
import { t } from "./i18n";
import { accentInk, textOnAccent } from "./appearance";

type Mutation = {
  path: string;
  method?: string;
  body?: unknown;
  optimistic?: (data: Bootstrap) => Bootstrap;
  retryable?: boolean;
};
interface HubContextValue {
  data: Bootstrap;
  mutate: <T = unknown>(input: Mutation) => Promise<T>;
  task: Partial<HubTask> | null;
  setTask: (task: Partial<HubTask> | null) => void;
  status: string;
  error: string;
  retry: () => void;
}
const HubContext = createContext<HubContextValue | null>(null);
export function useHub() {
  const context = useContext(HubContext);
  if (!context) throw new Error("Hub context missing");
  return context;
}
export function HubProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => api<Bootstrap>("/bootstrap"),
  });
  const [task, setTask] = useState<Partial<HubTask> | null>(null);
  const [status, setStatus] = useState("saved");
  const [error, setError] = useState("");
  const failed = useRef<Mutation | null>(null);
  const queue = useRef(Promise.resolve());
  const mutate = <T,>(input: Mutation): Promise<T> => {
    const execute = async () => {
      setStatus("saving");
      setError("");
      await client.cancelQueries({ queryKey: ["bootstrap"] });
      const previous = client.getQueryData<Bootstrap>(["bootstrap"]);
      if (input.optimistic && previous)
        client.setQueryData(["bootstrap"], input.optimistic(previous));
      try {
        const result = await api<T>(
          input.path,
          input.method ?? "POST",
          input.body,
        );
        await client.invalidateQueries();
        failed.current = null;
        setStatus("saved");
        return result;
      } catch (e) {
        if (previous) client.setQueryData(["bootstrap"], previous);
        await client.invalidateQueries();
        const message =
          e instanceof ApiError && e.status === 409
            ? t("conflict")
            : e instanceof Error
              ? e.message
              : t("saveError");
        setError(message);
        setStatus("saveError");
        failed.current =
          input.retryable === false ||
          (e instanceof ApiError && e.status === 409)
            ? null
            : input;
        throw e;
      }
    };
    const result = queue.current.then(execute);
    queue.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  const zone = query.data?.settings.timezone;
  useEffect(() => {
    if (!zone) return;
    let day = dateInZone(zone);
    const check = () => {
      const next = dateInZone(zone);
      if (next !== day) {
        day = next;
        void client.invalidateQueries();
      }
    };
    const timer = setInterval(check, 1000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [zone, client]);
  useEffect(() => {
    const s = query.data?.settings;
    if (!s) return;
    const media = matchMedia("(prefers-color-scheme: light)");
    const update = () => {
      const theme =
        s.theme === "system" ? (media.matches ? "light" : "dark") : s.theme;
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.setProperty(
        "--accent-ink",
        accentInk(s.accent, theme === "light"),
      );
      document.documentElement.style.setProperty(
        "--accent-contrast",
        textOnAccent(s.accent),
      );
    };
    update();
    media.addEventListener("change", update);
    document.documentElement.style.setProperty("--accent", s.accent);
    document.documentElement.style.setProperty("--radius", s.radius + "px");
    document.documentElement.style.setProperty("--width", s.width + "px");
    document.documentElement.style.setProperty("--columns", String(s.columns));
    document.documentElement.style.setProperty(
      "--icon-size",
      s.iconSize + "px",
    );
    document.documentElement.dataset.density = s.density;
    return () => media.removeEventListener("change", update);
  }, [query.data?.settings]);
  if (query.isPending)
    return (
      <main aria-busy="true" className="loading">
        <p>{t("loading")}</p>
        <div className="skeleton" />
      </main>
    );
  if (!query.data)
    return (
      <main>
        <p role="alert">{t("loadError")}</p>
        <button onClick={() => void query.refetch()}>{t("retry")}</button>
      </main>
    );
  return (
    <HubContext.Provider
      value={{
        data: query.data,
        mutate,
        task,
        setTask,
        status,
        error,
        retry: () => {
          if (failed.current) void mutate(failed.current).catch(() => {});
          else void query.refetch();
        },
      }}
    >
      {children}
    </HubContext.Provider>
  );
}
