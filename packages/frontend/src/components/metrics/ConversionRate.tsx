import { Card, Badge } from '../../design-system/components';

export interface ConversionRateProps {
  /** Conversion rate as a percentage with up to 2 decimal places */
  value: number;
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
  backgroundColor: 'var(--ds-color-primary-glow)',
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

const valueStyles: React.CSSProperties = {
  fontSize: 'var(--ds-font-size-2xl)',
  fontWeight: 'var(--ds-font-weight-bold)',
  color: 'var(--ds-color-text-primary)',
  lineHeight: 'var(--ds-line-height-tight)',
};

const footerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--ds-space-2)',
};

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

export function ConversionRate({ value, trend }: ConversionRateProps) {
  return (
    <Card variant="default" padded>
      <div style={containerStyles}>
        <div style={headerStyles}>
          <div style={iconStyles} aria-hidden="true">
            📅
          </div>
          <span style={labelStyles}>Taxa de Conversão</span>
        </div>
        <div style={valueStyles}>{value.toFixed(2)}%</div>
        <div style={footerStyles}>
          {getTrendBadge(trend)}
          <span
            style={{
              fontSize: 'var(--ds-font-size-xs)',
              color: 'var(--ds-color-text-muted)',
            }}
          >
            Agendamentos confirmados / visitas
          </span>
        </div>
      </div>
    </Card>
  );
}
