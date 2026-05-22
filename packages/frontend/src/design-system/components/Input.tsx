import { useState, type InputHTMLAttributes } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Label text displayed above the input */
  label?: string;
  /** Error message for inline validation */
  error?: string;
  /** Helper text displayed below the input */
  helperText?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the input takes full width */
  fullWidth?: boolean;
}

const sizeMap = {
  sm: {
    padding: 'var(--ds-space-2) var(--ds-space-3)',
    fontSize: 'var(--ds-font-size-sm)',
  },
  md: {
    padding: 'var(--ds-space-3) var(--ds-space-4)',
    fontSize: 'var(--ds-font-size-base)',
  },
  lg: {
    padding: 'var(--ds-space-4) var(--ds-space-5)',
    fontSize: 'var(--ds-font-size-lg)',
  },
} as const;

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--ds-space-1)',
};

const labelStyles: React.CSSProperties = {
  fontSize: 'var(--ds-font-size-sm)',
  fontWeight: 'var(--ds-font-weight-medium)',
  color: 'var(--ds-color-text-primary)',
  lineHeight: 'var(--ds-line-height-normal)',
};

const helperStyles: React.CSSProperties = {
  fontSize: 'var(--ds-font-size-xs)',
  color: 'var(--ds-color-text-muted)',
  lineHeight: 'var(--ds-line-height-normal)',
  margin: 0,
};

const errorStyles: React.CSSProperties = {
  fontSize: 'var(--ds-font-size-xs)',
  color: 'var(--ds-color-danger)',
  lineHeight: 'var(--ds-line-height-normal)',
  margin: 0,
};

export function Input({
  label,
  error,
  helperText,
  size = 'md',
  fullWidth = true,
  style,
  id,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  const inputStyles: React.CSSProperties = {
    fontFamily: 'var(--ds-font-family)',
    ...sizeMap[size],
    minHeight: 'var(--ds-touch-target-min)',
    width: fullWidth ? '100%' : undefined,
    backgroundColor: 'var(--ds-color-bg-card)',
    color: 'var(--ds-color-text-primary)',
    border: `1px solid ${error ? 'var(--ds-color-danger)' : focused ? 'var(--ds-color-border-focus)' : 'var(--ds-color-border-base)'}`,
    borderRadius: 'var(--ds-radius-md)',
    outline: 'none',
    boxShadow: focused
      ? error
        ? '0 0 0 3px var(--ds-color-danger-bg)'
        : '0 0 0 3px var(--ds-color-primary-glow)'
      : 'none',
    transition: 'border-color var(--ds-transition-fast), box-shadow var(--ds-transition-fast)',
    boxSizing: 'border-box',
    ...style,
  };

  return (
    <div style={containerStyles}>
      {label && (
        <label htmlFor={inputId} style={labelStyles}>
          {label}
          {props.required && <span style={{ color: 'var(--ds-color-danger)', marginLeft: '2px' }}>*</span>}
        </label>
      )}
      <input
        {...props}
        id={inputId}
        style={inputStyles}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
      />
      {error && (
        <p id={`${inputId}-error`} style={errorStyles} role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${inputId}-helper`} style={helperStyles}>
          {helperText}
        </p>
      )}
    </div>
  );
}
