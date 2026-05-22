import { Card, Badge } from '../../design-system/components';

export interface RepeatCustomersProps {
  /** Repeat customer percentage as an integer */
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
  backgroundColor: 'var(--ds-color-success-bg)',
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

export function RepeatCustomers({ value, trend }: RepeatCustomersProps) {
  return (
    <Card variant="default" padded>
      <div style={containerStyles}>
        <div style={headerStyles}>
          <div style={iconStyles} aria-hidden="true">
            🔄
          </div>
          <span style={labelStyles}>Clientes Recorrentes</span>
        </div>
        <div style={valueStyles}>{value}%</div>
        <div style={footerStyles}>
          {getTrendBadge(trend)}
          <span
            style={{
              fontSize: 'var(--ds-font-size-xs)',
              color: 'var(--ds-color-text-muted)',
            }}
          >
            Últimos 90 dias
          </span>
        </div>
      </div>
    </Card>
  );
}
