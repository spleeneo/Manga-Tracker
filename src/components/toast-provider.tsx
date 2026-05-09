"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";

type ToastType = "loading" | "success" | "error";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastInput {
  type: ToastType;
  title: string;
  description?: string;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (toast: ToastInput) => string;
  updateToast: (id: string, toast: ToastInput) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function makeToastId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toast: ToastInput) => {
    const id = makeToastId();
    setToasts((current) => [...current, { id, ...toast }]);

    if (toast.type !== "loading") {
      window.setTimeout(() => dismissToast(id), toast.durationMs ?? 4200);
    }

    return id;
  }, [dismissToast]);

  const updateToast = useCallback((id: string, toast: ToastInput) => {
    setToasts((current) => current.map((item) => (
      item.id === id ? { id, ...toast } : item
    )));

    if (toast.type !== "loading") {
      window.setTimeout(() => dismissToast(id), toast.durationMs ?? 4200);
    }
  }, [dismissToast]);

  const value = useMemo(() => ({
    showToast,
    updateToast,
    dismissToast,
  }), [dismissToast, showToast, updateToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-[0_8px_0_hsl(var(--border)),0_18px_48px_hsl(0_0%_0%/0.22)]"
          >
            <div className="mt-0.5 shrink-0 text-primary">
              {toast.type === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {toast.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : null}
              {toast.type === "error" ? <XCircle className="h-4 w-4 text-destructive" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-5">{toast.title}</p>
              {toast.description ? (
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return value;
}
