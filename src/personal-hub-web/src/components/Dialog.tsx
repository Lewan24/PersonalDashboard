import * as Radix from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { t } from "../i18n";
export function Dialog({
  title,
  onClose,
  children,
  role = "dialog",
  className = "",
}: {
  title: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
  role?: "dialog" | "alertdialog";
}) {
  return (
    <Radix.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Radix.Portal>
        <Radix.Overlay className="dialog-overlay" />
        <Radix.Content
          role={role}
          className={("dialog " + className).trim()}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            requestAnimationFrame(() => {
              const input =
                document.querySelector<HTMLElement>("[data-dialog-input]") ??
                document.querySelector<HTMLElement>(
                  '[role="dialog"] input, [role="dialog"] select',
                );
              input?.focus();
            });
          }}
        >
          <div className="dialog-heading">
            <Radix.Title>{title}</Radix.Title>
            <Radix.Close asChild>
              <button type="button">{t("close")}</button>
            </Radix.Close>
          </div>
          <Radix.Description className="sr-only">{title}</Radix.Description>
          {children}
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  );
}
