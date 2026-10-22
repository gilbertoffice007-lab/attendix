import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const controlClass =
  'w-full rounded-xl border bg-white px-3.5 text-sm text-ink-900 shadow-sm transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none disabled:cursor-not-allowed disabled:bg-ink-100 disabled:text-ink-500 dark:border-ink-700 dark:bg-ink-900 dark:text-white dark:placeholder:text-ink-500 dark:disabled:bg-ink-800'

interface FieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  required?: boolean
  htmlFor?: string
  className?: string
  children: ReactNode
}

export function Field({ label, hint, error, required, htmlFor, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="block text-sm font-medium text-ink-700 dark:text-ink-300"
        >
          {label}
          {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs font-medium text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-500 dark:text-ink-400">{hint}</p>
      ) : null}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  leading?: ReactNode
  trailing?: ReactNode
  fieldClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, hint, error, required, leading, trailing, fieldClassName, id, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={inputId}
      className={fieldClassName}
    >
      <div className="relative">
        {leading ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-400">
            {leading}
          </div>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            controlClass,
            'h-10',
            leading && 'pl-10',
            trailing && 'pr-10',
            error &&
              'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500',
            !error && 'border-ink-200',
            className,
          )}
          aria-invalid={Boolean(error)}
          {...props}
        />
        {trailing ? (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">{trailing}</div>
        ) : null}
      </div>
    </Field>
  )
})

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  fieldClassName?: string
  options?: { value: string | number; label: string; disabled?: boolean }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    className,
    label,
    hint,
    error,
    required,
    fieldClassName,
    options,
    placeholder,
    id,
    children,
    ...props
  },
  ref,
) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={selectId}
      className={fieldClassName}
    >
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            controlClass,
            'h-10 appearance-none pr-9',
            error ? 'border-rose-400 dark:border-rose-500' : 'border-ink-200',
            className,
          )}
          aria-invalid={Boolean(error)}
          {...props}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options?.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
          aria-hidden
        />
      </div>
    </Field>
  )
})

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  fieldClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, label, hint, error, required, fieldClassName, id, ...props },
  ref,
) {
  const generatedId = useId()
  const textareaId = id ?? generatedId
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={textareaId}
      className={fieldClassName}
    >
      <textarea
        ref={ref}
        id={textareaId}
        className={cn(
          controlClass,
          'min-h-[92px] resize-y py-2.5',
          error ? 'border-rose-400 dark:border-rose-500' : 'border-ink-200',
          className,
        )}
        aria-invalid={Boolean(error)}
        {...props}
      />
    </Field>
  )
})

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  description?: ReactNode
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, label, description, id, ...props },
  ref,
) {
  const generatedId = useId()
  const checkboxId = id ?? generatedId
  return (
    <label
      htmlFor={checkboxId}
      className={cn(
        'flex cursor-pointer items-start gap-2.5 text-sm text-ink-700 dark:text-ink-300',
        className,
      )}
    >
      <input
        ref={ref}
        id={checkboxId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 text-brand-600 focus:ring-brand-500 dark:border-ink-600 dark:bg-ink-900"
        {...props}
      />
      {label || description ? (
        <span>
          {label ? <span className="font-medium">{label}</span> : null}
          {description ? (
            <span className="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">
              {description}
            </span>
          ) : null}
        </span>
      ) : null}
    </label>
  )
})

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}

export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-ink-800 dark:text-ink-200">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === 'string' ? label : 'Toggle'}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-brand-600' : 'bg-ink-300 dark:bg-ink-700',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  )
}
