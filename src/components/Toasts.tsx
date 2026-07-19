import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastKind = "error" | "success" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

type ToastFn = (message: string, kind?: ToastKind) => void;

const ToastContext = createContext<ToastFn | null>(null);

const AUTO_DISMISS_MS = 5000;
const MAX_VISIBLE = 3;

/**
 * App-wide notifications for background failures (progress saves, list
 * toggles) that would otherwise fail silently. Foreground forms keep their
 * inline .form-error treatment — toasts are for actions the user isn't
 * watching a response for.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Synchronous mirror of the state so toast()/dismiss() can read the current
  // list without impure setState updaters (StrictMode runs updaters twice).
  const toastsRef = useRef<Toast[]>([]);
  const timers = useRef(new Map<number, number>());
  const nextId = useRef(1);

  const apply = useCallback((next: Toast[]) => {
    toastsRef.current = next;
    setToasts(next);
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      const timer = timers.current.get(id);
      if (timer !== undefined) {
        window.clearTimeout(timer);
        timers.current.delete(id);
      }
      apply(toastsRef.current.filter((t) => t.id !== id));
    },
    [apply],
  );

  const toast = useCallback<ToastFn>(
    (message, kind = "error") => {
      // Background failures repeat (e.g. progress save on every chapter turn
      // while offline) — don't stack identical messages.
      if (toastsRef.current.some((t) => t.message === message)) return;
      const id = nextId.current++;
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
      );
      apply([
        ...toastsRef.current.slice(1 - MAX_VISIBLE),
        { id, kind, message },
      ]);
    },
    [apply, dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) window.clearTimeout(timer);
    };
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span className="toast-message">{t.message}</span>
            <button
              className="toast-close"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used inside <ToastProvider>");
  return toast;
}

/** Like useToast, but a no-op outside a provider (bare test mounts). */
export function useOptionalToast(): ToastFn | null {
  return useContext(ToastContext);
}
