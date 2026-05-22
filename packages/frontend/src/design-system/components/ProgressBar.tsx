export interface ProgressBarProps {
  /** Current progress value (0–100) */
  value: number;
  /** Optional label displayed above or beside the bar */
  label?: string;
  /** Whether to show the percentage text */
  showPercentage?: boolean;
  /** Visual size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Color variant */
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  /** Optional CSS class for the container */
  className?: string;
}

const sizeMap = {
  sm: '6px',
  md: '10px',
  lg: '16px',
} as const;

const colorMap = {
  primary: 'var(--ds-color-primary)',
  success: 'var(--ds-color-success)',
  warning: 'var(--ds-color-warning)',
  danger: 'var(--ds-color-danger)',
} as const;

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--ds-space-2)',
  width: '100%',
};

const labelRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const labelStyles: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--ds-font-size-sm)',
  fontWeight: 'var(--ds-font-weight-medium)',
  color: 'var(--ds-color-text-secondary)',
  lineHeight: 'var(--ds-line-height-normal)',
};

const percentageStyles: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--ds-font-size-sm)',
  fontWeight: 'var(--ds-font-weight-semibold)',
  color: 'var(--ds-color-text-primary)',
  lineHeight: 'var(--ds-line-height-normal)',
};

export function ProgressBar({
  value,
  label,
  showPercentage = true,
  size = 'md',
  variant = 'primary',
  className,
}: ProgressBarProps) {
  // Clamp value between 0 and 100
  const clampedValue = Math.max(0, Math.min(100, value));

  const trackStyles: React.CSSProperties = {
    width: '100%',
    height: sizeMap[size],
    backgroundColor: 'var(--ds-color-bg-muted)',
    borderRadius: 'var(--ds-radius-full)',
    overflow: 'hidden',
  };

  const fillStyles: React.CSSProperties = {
    height: '100%',
    width: `${clampedValue}%`,
    backgroundColor: colorMap[variant],
    borderRadius: 'var(--ds-radius-full)',
    transition: 'width var(--ds-transition-base)',
  };

  return (
    <div style={containerStyles} className={className}>
      {(label || showPercentage) && (
        <div style={labelRowStyles}>
          {label && <span style={labelStyles}>{label}</span>}
          {showPercentage && (
            <span style={percentageStyles}>{Math.round(clampedValue)}%</span>
          )}
        </div>
      )}
      <div
        style={trackStyles}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || `${Math.round(clampedValue)}% completo`}
      >
        <div style={fillStyles} />
      </div>
    </div>
  );
}
