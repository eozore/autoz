import { Card, Badge } from '../../design-system/components';

export interface CustomerRatingProps {
  /** Average rating value (1 decimal), or null if no reviews yet */
  value: number | null;
  /** Optional trend direction compared to previous period */
  trend?: 'up' | 'down' | 'neutral';
}

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--ds-space-3)',
};

const headerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--ds-space-2)',
};

const iconStyles: React.CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: 'var(--ds-radius-md)',
  backgroundColor: 'var(--ds-color-warning-bg)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 'var(--ds-font-size-lg)',
};

const labelStyles: React.CSSProperties = {
  fontSize: 'var(--ds-font-size-sm)',
  color: 'var(--ds-color-text-secondary)',
  fontWeight: 'var(--ds-font-weight-medium)',
};

const valueContainerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 'var(--ds-space-2)',
};

const valueStyles: React.CSSProperties = {
  fontSize: 'var(--ds-font-size-2xl)',
  fontWeight: 'var(--ds-font-weight-bold)',
  color: 'var(--ds-color-text-primary)',
  lineHeight: 'var(--ds-line-height-tight)',
};

const starsContainerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  fontSize: 'var(--ds-font-size-base)',
};

const footerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--ds-space-2)',
};

function renderStars(rating: number) {
  const stars: React.ReactNode[] = [];
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(
        <span key={i} style={{ color: '#f59e0b' }} aria-hidden="true">
          ★
        </span>,
      );
    } else if (i === fullStars && hasHalf) {
      stars.push(
        <span key={i} style={{ color: '#f59e0b' }} aria-hidden="true">
          ★
        </span>,
      );
    } else {
      stars.push(
        <span key={i} style={{ color: 'var(--ds-color-border-base)' }} aria-hidden="true">
          ★
        </span>,
      );
    }
  }
  return stars;
}

function getTrendBadge(trend?: 'up' | 'down' | 'neutral') {
  if (!trend || trend === 'neutral') return null;
  const variant = trend === 'up' ? 'success' : 'danger';
  const arrow = trend === 'up' ? '↑' : '↓';
  return (
    <Badge variant={variant} size="sm">
      {arrow}
    </Badge>
  );
}

export function CustomerRating({ value, trend }: CustomerRatingProps) {
  const displayValue = value !== null ? value.toFixed(1) : '—';

  return (
    <Card variant="default" padded>
      <div style={containerStyles}>
        <div style={headerStyles}>
          <div style={iconStyles} aria-hidden="true">
            ⭐
          </div>
          <span style={labelStyles}>Avaliação Média</span>
        </div>
        <div style={valueContainerStyles}>
          <span style={valueStyles}>{displayValue}</span>
          {value !== null && (
            <div style={starsContainerStyles} aria-label={`${displayValue} de 5 estrelas`}>
              {renderStars(value)}
            </div>
          )}
        </div>
        <div style={footerStyles}>
          {getTrendBadge(trend)}
          <span
            style={{
              fontSize: 'var(--ds-font-size-xs)',
              color: 'var(--ds-color-text-muted)',
            }}
          >
            {value !== null ? 'Baseado em avaliações reais' : 'Nenhuma avaliação ainda'}
          </span>
        </div>
      </div>
    </Card>
  );
}
