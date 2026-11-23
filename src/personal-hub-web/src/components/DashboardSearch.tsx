import { Search, X, ExternalLink } from "lucide-react";
import { useRef } from "react";
import { safeUrl } from "../api";
import { t } from "../i18n";

export function DashboardSearch({
  value,
  onChange,
  externalSearch,
}: {
  value: string;
  onChange: (value: string) => void;
  externalSearch: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const externalUrl =
    externalSearch && value.trim()
      ? externalSearch.replace("{q}", encodeURIComponent(value.trim()))
      : "";
  return (
    <div className="dashboard-search" role="search">
      <Search size={16} aria-hidden="true" />
      <input
        ref={input}
        id="dashboard-search"
        type="search"
        aria-label={t("search")}
        placeholder={t("search")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <>
          <button
            type="button"
            className="icon-button"
            aria-label={t("clearSearch")}
            onClick={() => {
              onChange("");
              input.current?.focus();
            }}
          >
            <X size={15} />
          </button>
          {safeUrl(externalUrl) && (
            <a
              className="icon-button button"
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={t("externalSearchAction")}
              aria-label={t("externalSearchAction")}
            >
              <ExternalLink size={15} />
            </a>
          )}
        </>
      ) : (
        <kbd>Ctrl K</kbd>
      )}
    </div>
  );
}
