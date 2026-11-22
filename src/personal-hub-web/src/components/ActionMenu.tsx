import { useRef } from "react";
import type { ReactElement } from "react";
import * as Context from "@radix-ui/react-context-menu";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Ellipsis } from "lucide-react";
import { t } from "../i18n";

export interface MenuAction {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
  opensDialog?: boolean;
  separator?: boolean;
}
interface MenuProps {
  label: string;
  actions: MenuAction[];
}

export function ActionMenu({
  label,
  actions,
  children,
}: MenuProps & { children: ReactElement }) {
  const opensDialog = useRef(false);
  return (
    <Context.Root modal={false}>
      <Context.Trigger asChild>{children}</Context.Trigger>
      <Context.Portal>
        <Context.Content
          className="action-menu"
          onCloseAutoFocus={(e) => {
            if (opensDialog.current) e.preventDefault();
            opensDialog.current = false;
          }}
        >
          <Context.Label className="menu-label">{label}</Context.Label>
          {actions.map((action) => (
            <div key={action.id}>
              {action.separator && (
                <Context.Separator className="menu-separator" />
              )}
              <Context.Item
                className={"menu-item" + (action.danger ? " danger" : "")}
                disabled={action.disabled}
                onSelect={() => {
                  opensDialog.current = !!action.opensDialog;
                  action.onSelect();
                }}
              >
                {action.label}
              </Context.Item>
            </div>
          ))}
        </Context.Content>
      </Context.Portal>
    </Context.Root>
  );
}

export function MenuButton({ label, actions }: MenuProps) {
  const opensDialog = useRef(false);
  return (
    <Dropdown.Root modal={false}>
      <Dropdown.Trigger asChild>
        <button
          type="button"
          className="more-button"
          aria-label={t("actionsFor", { name: label })}
          title={t("actionsFor", { name: label })}
        >
          <Ellipsis size={17} aria-hidden="true" />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          className="action-menu"
          align="end"
          sideOffset={5}
          onCloseAutoFocus={(e) => {
            if (opensDialog.current) e.preventDefault();
            opensDialog.current = false;
          }}
        >
          <Dropdown.Label className="menu-label">{label}</Dropdown.Label>
          {actions.map((action) => (
            <div key={action.id}>
              {action.separator && (
                <Dropdown.Separator className="menu-separator" />
              )}
              <Dropdown.Item
                className={"menu-item" + (action.danger ? " danger" : "")}
                disabled={action.disabled}
                onSelect={() => {
                  opensDialog.current = !!action.opensDialog;
                  action.onSelect();
                }}
              >
                {action.label}
              </Dropdown.Item>
            </div>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
