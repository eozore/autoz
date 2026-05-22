import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** Icon or illustration to display */
  icon?: ReactNode;
  /** Main title text */
  title: string;
  /** Descriptive text explaining the empty state */
  description?: string;
  /** Action button label for the guided prompt */
  actionLabel?: string;
  /** Callback when the action button is clicked */
  onAction?: () => void;
  /** Optional CSS class for the container */
  className?: string;
}

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: 'var(--ds-space-12) var(--ds-space-6)',
  gap: 'var(--ds-space-4)',
};

const iconStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '4rem',
  height: '4rem',
  borderRadius: 'var(--ds-radius-full)',
  backgroundColor: 'var(--ds-color-bg-muted)',
  color: 'var(--ds-color-text-muted)',
  fontSize: 'var(--ds-font-size-2xl)',
  marginBottom: 'var(--ds-space-2)',
};

const titleStyles: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--ds-font-size-lg)',
  fontWeight: 'var(--ds-font-weight-semibold)',
  color: 'var(--ds-color-text-primary)',
  lineHeight: 'var(--ds-line-height-tight)',
};

const descriptionStyles: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--ds-font-size-base)',
  color: 'var(--ds-color-text-secondary)',
  lineHeight: 'var(--ds-line-height-normal)',
  maxWidth: '24rem',
};

const actionButtonStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 'var(--ds-touch-target-min)',
  minHeight: 'var(--ds-touch-target-min)',
  padding: 'var(--ds-space-3) var(--ds-space-6)',
  backgroundColor: 'var(--ds-color-primary)',
  color: 'var(--ds-color-text-inverse)',
  border: 'none',
  borderRadius: 'var(--ds-radius-md)',
  fontSize: 'var(--ds-font-size-base)',
  fontWeight: 'var(--ds-font-weight-medium)',
  cursor: 'pointer',
  transition: 'background-color var(--ds-transition-fast), box-shadow var(--ds-transition-fast)',
  marginTop: 'var(--ds-space-2)',
};

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div style={containerStyles} className={className} role="status">
      {icon && <div style={iconStyles}>{icon}</div>}
      <h3 style={titleStyles}>{title}</h3>
      {description && <p style={descriptionStyles}>{description}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={actionButtonStyles}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--ds-color-primary-hover)';
            e.currentTarget.style.boxShadow = 'var(--ds-shadow-md)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--ds-color-primary)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
