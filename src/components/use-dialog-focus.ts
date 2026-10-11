"use client";

import { useEffect, useRef } from "react";

export function useDialogFocus(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex="0"]') ?? []).filter((element) => element.getClientRects().length > 0);
    (panel?.querySelector<HTMLElement>("input") ?? focusable()[0] ?? panel)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first) { event.preventDefault(); panel?.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);
  return panelRef;
}
