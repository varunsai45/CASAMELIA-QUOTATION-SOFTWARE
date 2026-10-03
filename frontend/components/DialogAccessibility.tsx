"use client";
import { useEffect } from "react";
// Dialogs are rendered within the shared shell. Keep keyboard focus within the active dialog.
export default function DialogAccessibility() {
  useEffect(() => {
    let active: HTMLElement | null = null;
    let previous: HTMLElement | null = null;
    const focusable = (dialog: HTMLElement) =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
        ),
      ).filter((x) => x.offsetParent !== null);
    const observe = () => {
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
      const next = dialogs.length ? dialogs[dialogs.length - 1] : null;
      if (next && next !== active) {
        previous = document.activeElement as HTMLElement;
        active = next;
        (
          next.querySelector<HTMLElement>("input") || focusable(next)[0]
        )?.focus();
      }
      if (!next && active) {
        active = null;
        previous?.focus();
        previous = null;
      }
    };
    const keyboard = (e: KeyboardEvent) => {
      if (!active) return;
      const fields = focusable(active);
      if (e.key === "Escape") {
        active
          .querySelector<HTMLButtonElement>('button[aria-label^="Close"]')
          ?.click();
        e.preventDefault();
      }
      if (e.key === "Tab" && fields.length) {
        const first = fields[0],
          last = fields[fields.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            !active.contains(document.activeElement))
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !active.contains(document.activeElement))
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const watcher = new MutationObserver(observe);
    watcher.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", keyboard);
    observe();
    return () => {
      watcher.disconnect();
      document.removeEventListener("keydown", keyboard);
    };
  }, []);
  return null;
}
