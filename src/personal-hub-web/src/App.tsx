import { lazy, Suspense, useEffect, useState } from "react";
import {
  Route,
  Routes,
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Settings2 } from "lucide-react";
import { useHub } from "./HubContext";
import { t } from "./i18n";
import Dashboard from "./pages/Dashboard";
import { DashboardSearch } from "./components/DashboardSearch";
import { TaskEditor } from "./components/TaskEditor";
const Settings = lazy(() => import("./pages/Settings"));
export default function App() {
  const { data, task, setTask, status, error, retry } = useHub();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [focusSearch, setFocusSearch] = useState(0);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(
      () => setNow(new Date()),
      data.settings.clockSeconds ? 1000 : 10000,
    );
    return () => clearInterval(id);
  }, [data.settings.clockSeconds]);
  useEffect(() => {
    if (focusSearch && location.pathname === "/") {
      document.getElementById("dashboard-search")?.focus();
      setFocusSearch(0);
    }
  }, [focusSearch, location.pathname]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.closest(
        "input,textarea,select,[contenteditable=true]",
      );
      const dialog = document.querySelector("[role=dialog]");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!dialog) {
          if (location.pathname !== "/") navigate("/");
          setFocusSearch((previous) => previous + 1);
        }
        return;
      }
      if (
        e.key === "Escape" &&
        !dialog &&
        location.pathname === "/" &&
        search
      ) {
        setSearch("");
        return;
      }
      if (typing || dialog || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        if (location.pathname !== "/") navigate("/");
        setFocusSearch((previous) => previous + 1);
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setTask({});
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [location.pathname, navigate, search, setTask]);
  const options: Intl.DateTimeFormatOptions = {
    timeZone: data.settings.timezone,
    hour: "2-digit",
    minute: "2-digit",
    ...(data.settings.clockSeconds ? { second: "2-digit" } : {}),
    hour12: data.settings.clockFormat === "12",
  };
  return (
    <>
      <a className="skip-link" href="#main">
        {t("skipToContent")}
      </a>
      <header className="app-header">
        <Link className="brand" to="/">
          {t("app")}
          <span className="brand-dot" />
        </Link>
        {location.pathname === "/" ? (
          <DashboardSearch
            value={search}
            onChange={setSearch}
            externalSearch={data.settings.externalSearch}
          />
        ) : (
          <Link
            className="button search-trigger"
            to="/"
            onClick={() => setFocusSearch((previous) => previous + 1)}
          >
            {t("search")} <kbd>Ctrl K</kbd>
          </Link>
        )}
        {data.settings.clockVisible && (
          <div className="clock">
            <time dateTime={now.toISOString()}>
              {new Intl.DateTimeFormat("pl", options).format(now)}
            </time>
            <span>
              {new Intl.DateTimeFormat("pl", {
                timeZone: data.settings.timezone,
                dateStyle:
                  data.settings.dateFormat === "short" ? "short" : "long",
              }).format(now)}
            </span>
          </div>
        )}
        <span role="status" className={"save-status " + (error ? "error" : "")}>
          {t(status)}
        </span>
        <Link
          className="icon-button settings-link"
          to="/settings"
          aria-label={t("settings")}
          title={t("settings")}
        >
          <Settings2 size={18} />
        </Link>
      </header>
      {error && (
        <div className="app-toolbar">
          <span role="alert">{error}</span>
          <button onClick={retry}>{t("retry")}</button>
        </div>
      )}
      <main id="main">
        <Suspense fallback={<p role="status">{t("loading")}</p>}>
          <Routes>
            <Route path="/" element={<Dashboard search={search} />} />
            <Route
              path="/tasks"
              element={
                <Navigate
                  to={{
                    pathname: "/",
                    search: location.search,
                    hash: "#tasks",
                  }}
                  replace
                />
              }
            />
            <Route path="/settings" element={<Settings />} />
            <Route
              path="*"
              element={
                <>
                  <h1>{t("notFound")}</h1>
                  <Link to="/">{t("home")}</Link>
                </>
              }
            />
          </Routes>
        </Suspense>
      </main>
      {task && (
        <TaskEditor
          key={task.id ?? "new"}
          task={task}
          onClose={() => setTask(null)}
        />
      )}
    </>
  );
}
