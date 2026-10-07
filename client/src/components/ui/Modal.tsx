import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFocusTrap, useLockBodyScroll } from '@/hooks';
import Button from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeOnOverlay?: boolean;
  icon?: ReactNode;
}

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

export const Modal = ({ open, onClose, title, description, children, footer, size = 'md', closeOnOverlay = true, icon }: ModalProps) => {
  useLockBodyScroll(open);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="presentation">
      <div
        className="absolute inset-0 animate-fade-in bg-slate-950/55 backdrop-blur-[2px]"
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          'relative z-10 w-full animate-fade-in-up rounded-t-2xl border border-line bg-surface shadow-raised sm:animate-scale-in sm:rounded-card',
          SIZES[size],
        )}
      >
        <div className="flex items-start gap-3 border-b border-line p-4 sm:p-5">
          {icon && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold tracking-tight text-ink sm:text-lg">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-muted sm:text-sm">{description}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog" className="-mr-1 -mt-1 rounded-full p-2">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {children && <div className="max-h-[65vh] overflow-y-auto p-4 sm:p-5">{children}</div>}

        {footer && <div className="flex flex-col-reverse gap-2 border-t border-line p-4 sm:flex-row sm:justify-end sm:p-4">{footer}</div>}
      </div>
    </div>
  );
};

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger' | 'success';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation dialog used for destructive / irreversible actions (§14). */
export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    size="sm"
    footer={
      <>
        <Button variant="secondary" onClick={onCancel} disabled={loading} touch>
          {cancelLabel}
        </Button>
        <Button variant={tone} onClick={onConfirm} loading={loading} touch>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="text-sm text-muted">{message}</div>
  </Modal>
);

export default Modal;
