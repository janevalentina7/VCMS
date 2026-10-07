import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface Toast {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toast: (toast: Omit<Toast, 'id'>) => number;
  success: (title: string, description?: string) => number;
  error: (title: string, description?: string) => number;
  warning: (title: string, description?: string) => number;
  info: (title: string, description?: string) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICONS: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
};

const STYLES: Record<ToastVariant, string> = {
  success: 'border-success/40 bg-surface text-ink',
  error: 'border-danger/40 bg-surface text-ink',
  warning: 'border-warning/40 bg-surface text-ink',
  info: 'border-info/40 bg-surface text-ink',
  loading: 'border-line bg-surface text-ink',
};

const ICON_STYLES: Record<ToastVariant, string> = {
  success: 'text-success',
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
  loading: 'text-primary animate-spin',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((item) => item.id !== id)), []);

  const toast = useCallback(
    ({ duration = 4800, ...rest }: Omit<Toast, 'id'>) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((current) => [...current.slice(-4), { id, duration, ...rest }]);
      if (rest.variant !== 'loading' && duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast({ title, description, variant: 'success' }),
      error: (title, description) => toast({ title, description, variant: 'error', duration: 6500 }),
      warning: (title, description) => toast({ title, description, variant: 'warning' }),
      info: (title, description) => toast({ title, description, variant: 'info' }),
    }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:items-end"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((item) => {
          const Icon = ICONS[item.variant];
          return (
            <div
              key={item.id}
              role="status"
              aria-live={item.variant === 'error' ? 'assertive' : 'polite'}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm animate-slide-in-right items-start gap-3 rounded-xl border p-3.5 shadow-raised backdrop-blur',
                STYLES[item.variant],
              )}
            >
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', ICON_STYLES[item.variant])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.title}</p>
                {item.description && <p className="mt-0.5 text-xs text-muted">{item.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded-md p-1 text-muted transition-colors hover:bg-elevated hover:text-ink"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
