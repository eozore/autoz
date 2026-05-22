import { Card } from '../../design-system/components';

export interface ProfileCompletenessProps {
  /** Completeness percentage (0–100) */
  percentage: number;
  /** Whether data is still loading */
  loading?: boolean;
}

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--ds-space-3)',
};

const ringContainerStyles: React.CSSProperties = {
  position: 'relative',
  width: '120px',
  height: '120px',
};

const percentageTextStyles: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  fontSize: 'var(--ds-font-size-xl)',
  fontWeight: 'var(--ds-font-weight-bold)',
  color: 'var(--ds-color-text-primary)',
  lineHeight: 'var(--ds-line-height-tight)',
};

const labelStyles: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--ds-font-size-sm)',
  fontWeight: 'var(--ds-font-weight-medium)',
  color: 'var(--ds-color-text-secondary)',
  textAlign: 'center',
};

const loadingStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '160px',
  color: 'var(--ds-color-text-muted)',
  fontSize: 'var(--ds-font-size-sm)',
};

/**
 * ProfileCompleteness displays a circular progress ring showing
 * the profile completeness percentage with the label "Perfil Completo".
 */
export function ProfileCompleteness({ percentage, loading = false }: ProfileCompletenessProps) {
  if (loading) {
    return (
      <Card>
        <div style={loadingStyles}>Carregando...</div>
      </Card>
    );
  }

  const clamped = Math.max(0, Math.min(100, percentage));
  const radius = 48;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  // Determine ring color based on percentage
  const ringColor =
    clamped >= 100
      ? 'var(--ds-color-success)'
      : clamped >= 50
        ? 'var(--ds-color-primary)'
        : 'var(--ds-color-warning)';

  return (
    <Card>
      <div style={containerStyles}>
        <div style={ringContainerStyles} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-label={`Perfil ${clamped}% completo`}>
          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            style={{ transform: 'rotate(-90deg)' }}
          >
            {/* Background track */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="var(--ds-color-bg-muted)"
              strokeWidth={strokeWidth}
            />
            {/* Progress arc */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset var(--ds-transition-base)' }}
            />
          </svg>
          <span style={percentageTextStyles}>{Math.round(clamped)}%</span>
        </div>
        <p style={labelStyles}>Perfil Completo</p>
      </div>
    </Card>
  );
}
