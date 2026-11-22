import { useState } from "react";
import { Plus } from "lucide-react";
import { useHub } from "../../HubContext";
import { t } from "../../i18n";
export function QuickTaskInput() {
  const { data, mutate } = useHub();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(true);
  const [busy, setBusy] = useState(false);
  const column = data.columns.find((x) => !x.isArchived && !x.isDone);
  async function add() {
    if (!title.trim() || !column) return;
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
      setTitle("");
    } catch {
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
          required
          maxLength={200}
          disabled={!column || busy}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("quickTitle")}
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
        disabled={!column || busy || !title.trim()}
      >
        <Plus size={16} />
      </button>
    </form>
  );
}
