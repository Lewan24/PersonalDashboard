import type { CSSProperties } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { contrast } from "../appearance";
import { t } from "../i18n";
import type { Tag } from "../types";

function tagStyle(tag: Tag) {
  return {
    "--tag-color": tag.color,
    "--tag-text": contrast(tag.color, "#ffffff") >= 4.5 ? "#fff" : "#000",
  } as CSSProperties;
}

export function TagBadge({ tag }: { tag: Tag }) {
  return (
    <span className="tag" style={tagStyle(tag)}>
      {tag.name}
    </span>
  );
}

export function TagOptions({
  tags,
  input,
}: {
  tags: Tag[];
  input: UseFormRegisterReturn;
}) {
  return tags.length === 0 ? (
    <small>{t("noTags")}</small>
  ) : (
    <div className="tag-options">
      {tags.map((tag) => (
        <label className="tag-option" key={tag.id} style={tagStyle(tag)}>
          <input type="checkbox" value={tag.id} {...input} />
          <span>{tag.name}</span>
        </label>
      ))}
    </div>
  );
}
