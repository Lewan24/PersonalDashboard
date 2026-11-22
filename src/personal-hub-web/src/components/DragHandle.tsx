import type { DragEvent } from "react";
import { t } from "../i18n";
export interface DragData {
  kind: string;
  id: string;
  container: string;
  version: number;
}
export function DragHandle({ data }: { data: DragData }) {
  return (
    <button
      type="button"
      className="drag-handle"
      aria-label={t("drag")}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "application/personal-hub",
          JSON.stringify(data),
        );
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <svg
        width="16"
        height="20"
        viewBox="0 0 16 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="5" cy="5" r="1.5" />
        <circle cx="11" cy="5" r="1.5" />
        <circle cx="5" cy="10" r="1.5" />
        <circle cx="11" cy="10" r="1.5" />
        <circle cx="5" cy="15" r="1.5" />
        <circle cx="11" cy="15" r="1.5" />
      </svg>
    </button>
  );
}
export function readDrag(e: DragEvent): DragData | null {
  try {
    return JSON.parse(
      e.dataTransfer.getData("application/personal-hub"),
    ) as DragData;
  } catch {
    return null;
  }
}
