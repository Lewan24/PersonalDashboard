import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useHub } from "../../HubContext";
import { t } from "../../i18n";
export function QuickTaskInput() {
  const { data, mutate } = useHub();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(true);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const column = data.columns.find((x) => !x.isArchived && !x.isDone);
  async function add() {
    if (!title.trim() || !column || busy) return;
    const submittedTitle = title;
    setTitle("");
    setBusy(true);
    try {
      await mutate({
        path: "/tasks",
        body: {
          title: title.trim(),
          columnId: column.id,
          dueDate: due ? data.today : null,
        },
      });
    } catch {
      setTitle((draft) => draft || submittedTitle);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="quick-task-input"
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
    >
      <label className="grow">
        <span className="sr-only">{t("quickTitle")}</span>
        <input
          ref={input}
          required
          maxLength={200}
          disabled={!column}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("quickTitle")}
          onKeyDown={(event) => {
            if (event.key === "Escape") event.currentTarget.blur();
          }}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={due}
          onChange={(e) => setDue(e.target.checked)}
        />
        {t("dueToday")}
      </label>
      <button
        type="submit"
        className="icon-button"
        aria-label={t("add")}
        onClick={() => input.current?.focus()}
        disabled={!column || busy || !title.trim()}
      >
        <Plus size={16} />
      </button>
    </form>
  );
}
