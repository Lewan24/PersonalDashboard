import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { t } from "../i18n";
import type { IconInfo } from "../types";
import { automaticIcon, builtInIcons, Icon } from "./Icon";

export function IconField({
  value,
  onChange,
  enabled,
  allowAutomatic = false,
}: {
  value: string;
  onChange: (value: string) => void;
  enabled: boolean;
  allowAutomatic?: boolean;
}) {
  const help = useId();
  const icons = useQuery({
    queryKey: ["icons"],
    queryFn: () => api<IconInfo[]>("/icons"),
    enabled,
  });
  const uploaded =
    icons.data?.map((icon) => ({
      key: "icon:" + icon.id,
      name: icon.fileName,
    })) ?? [];
  const known =
    (allowAutomatic && value === automaticIcon) ||
    Object.hasOwn(builtInIcons, value) ||
    uploaded.some((icon) => icon.key === value);

  return (
    <label>
      <span id={help + "-label"}>{t("icon")}</span>
      <span className="icon-field">
        <Icon name={value} />
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-labelledby={help + "-label"}
          aria-describedby={help}
        >
          {allowAutomatic && (
            <option value={automaticIcon}>{t("faviconAuto")}</option>
          )}
          {!known && <option value={value}>{t("currentIcon")}</option>}
          <optgroup label={t("builtInIcons")}>
            {Object.keys(builtInIcons).map((key) => (
              <option key={key} value={key}>
                {t(key.slice(7) + "Icon")}
              </option>
            ))}
          </optgroup>
          {uploaded.length > 0 && (
            <optgroup label={t("icons")}>
              {uploaded.map((icon) => (
                <option key={icon.key} value={icon.key}>
                  {icon.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </span>
      <small id={help}>
        {icons.isError ? t("iconsLoadError") : t("iconHelp")}
      </small>
    </label>
  );
}
