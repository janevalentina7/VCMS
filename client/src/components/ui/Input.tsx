import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BaseFieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  containerClassName?: string;
  icon?: ReactNode;
}

const FieldWrapper = ({
  label,
  error,
  hint,
  required,
  htmlFor,
  children,
  containerClassName,
}: BaseFieldProps & { htmlFor?: string; children: ReactNode }) => (
  <div className={cn('w-full', containerClassName)}>
    {label && (
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        )}
      </label>
    )}
    {children}
    {error ? (
      <p className="field-message" role="alert">
        <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{error}</span>
      </p>
    ) : (
      hint && <p className="field-hint">{hint}</p>
    )}
  </div>
);

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, BaseFieldProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, required, className, containerClassName, icon, id, ...props }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    return (
      <FieldWrapper label={label} error={error} hint={hint} required={required} htmlFor={fieldId} containerClassName={containerClassName}>
        <div className="relative">
          {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">{icon}</span>}
          <input
            ref={ref}
            id={fieldId}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${fieldId}-error` : undefined}
            className={cn('field', icon && 'pl-9', error && 'field-error', className)}
            {...props}
          />
        </div>
      </FieldWrapper>
    );
  },
);
Input.displayName = 'Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, BaseFieldProps {
  showCount?: boolean;
  maxLength?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, required, className, containerClassName, showCount, maxLength, id, value, ...props }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const length = typeof value === 'string' ? value.length : 0;
    return (
      <FieldWrapper label={label} error={error} hint={hint} required={required} htmlFor={fieldId} containerClassName={containerClassName}>
        <textarea
          ref={ref}
          id={fieldId}
          value={value}
          maxLength={maxLength}
          aria-invalid={Boolean(error)}
          className={cn('field min-h-[118px] resize-y', error && 'field-error', className)}
          {...props}
        />
        {showCount && maxLength && (
          <p className={cn('mt-1 text-right text-2xs', length > maxLength ? 'text-danger' : 'text-muted')}>
            {length} / {maxLength} characters
          </p>
        )}
      </FieldWrapper>
    );
  },
);
Textarea.displayName = 'Textarea';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, BaseFieldProps {
  options: { value: string | number; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, required, className, containerClassName, options, placeholder, id, ...props }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    return (
      <FieldWrapper label={label} error={error} hint={hint} required={required} htmlFor={fieldId} containerClassName={containerClassName}>
        <select
          ref={ref}
          id={fieldId}
          aria-invalid={Boolean(error)}
          className={cn('select', error && 'field-error', className)}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      </FieldWrapper>
    );
  },
);
Select.displayName = 'Select';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({ label, description, className, id, ...props }, ref) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input ref={ref} id={fieldId} type="checkbox" className="checkbox mt-0.5" {...props} />
      {(label || description) && (
        <div className="text-sm leading-snug">
          {label && (
            <label htmlFor={fieldId} className="cursor-pointer font-medium text-ink">
              {label}
            </label>
          )}
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
      )}
    </div>
  );
});
Checkbox.displayName = 'Checkbox';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}

export const Switch = ({ checked, onChange, label, description, disabled, id }: SwitchProps) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className="flex items-start justify-between gap-4">
      {(label || description) && (
        <div className="min-w-0">
          {label && (
            <label htmlFor={fieldId} className="block text-sm font-medium text-ink">
              {label}
            </label>
          )}
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
      )}
      <button
        id={fieldId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2',
          checked ? 'bg-primary' : 'bg-line',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
};

export { FieldWrapper };
export default Input;
