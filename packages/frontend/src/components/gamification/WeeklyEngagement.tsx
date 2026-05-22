import { Card } from '../../design-system/components';

export interface WeekMetrics {
  appointments: number;
  newClients: number;
  revenue: number;
}

export interface WeeklyEngagementProps {
  /** Current week metrics */
  currentWeek: WeekMetrics;
  /** Previous week metrics */
  previousWeek: WeekMetrics;
  /** Whether data is still loading */
  loading?: boolean;
}

const headerStyles: React.CSSProperties = {
  margin: '0 0 var(--ds-space-4) 0',
  fontSize: 'var(--ds-font-size-base)',
  fontWeight: 'var(--ds-font-weight-semibold)',
  color: 'var(--ds-color-text-primary)',
};

const gridStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 'var(--ds-space-3)',
};

const metricCardStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--ds-space-2)',
  padding: 'var(--ds-space-4)',
  borderRadius: 'var(--ds-radius-md)',
  backgroundColor: 'var(--ds-color-bg-muted)',
};

const metricLabelStyles: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--ds-font-size-xs)',
  fontWeight: 'var(--ds-font-weight-medium)',
  color: 'var(--ds-color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 'var(--ds-letter-spacing-wide)',
};

const metricValueStyles: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--ds-font-size-2xl)',
  fontWeight: 'var(--ds-font-weight-bold)',
  color: 'var(--ds-color-text-primary)',
  lineHeight: 'var(--ds-line-height-tight)',
};

const trendContainerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--ds-space-1)',
  fontSize: 'var(--ds-font-size-xs)',
  fontWeight: 'var(--ds-font-weight-medium)',
};

const loadingStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '120px',
  color: 'var(--ds-color-text-muted)',
  fontSize: 'var(--ds-font-size-sm)',
};

interface MetricConfig {
  key: keyof WeekMetrics;
  label: string;
  format: (value: number) => string;
}

const METRICS: MetricConfig[] = [
  {
    key: 'appointments',
    label: 'Atendimentos',
    format: (v) => String(v),
  },
  {
    key: 'newClients',
    label: 'Novos Clientes',
    format: (v) => String(v),
  },
  {
    key: 'revenue',
    label: 'Receita',
    format: (v) => `R$ ${v.toFixed(2).replace('.', ',')}`,
  },
];

function getTrend(current: number, previous: number): { direction: 'up' | 'down' | 'neutral'; percentage: number } {
  if (previous === 0 && current === 0) return { direction: 'neutral', percentage: 0 };
  if (previous === 0) return { direction: 'up', percentage: 100 };
  const change = ((current - previous) / previous) * 100;
  if (change > 0) return { direction: 'up', percentage: Math.round(change) };
  if (change < 0) return { direction: 'down', percentage: Math.abs(Math.round(change)) };
  return { direction: 'neutral', percentage: 0 };
}

function TrendIndicator({ current, previous }: { current: number; previous: number }) {
  const { direction, percentage } = getTrend(current, previous);

  const color =
    direction === 'up'
      ? 'var(--ds-color-success)'
      : direction === 'down'
        ? 'var(--ds-color-danger)'
        : 'var(--ds-color-text-muted)';

  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';

  return (
    <div style={{ ...trendContainerStyles, color }}>
      <span>{arrow}</span>
      <span>{percentage}% vs semana anterior</span>
    </div>
  );
}

/**
 * WeeklyEngagement displays comparison cards showing current vs previous week
 * for appointments, new clients, and revenue with up/down trend arrows.
 */
export function WeeklyEngagement({ currentWeek, previousWeek, loading = false }: WeeklyEngagementProps) {
  if (loading) {
    return (
      <Card>
        <div style={loadingStyles}>Carregando...</div>
      </Card>
    );
  }

  return (
    <Card>
      <h3 style={headerStyles}>Engajamento Semanal</h3>
      <div style={gridStyles}>
        {METRICS.map((metric) => (
          <div key={metric.key} style={metricCardStyles}>
            <p style={metricLabelStyles}>{metric.label}</p>
            <p style={metricValueStyles}>{metric.format(currentWeek[metric.key])}</p>
            <TrendIndicator
              current={currentWeek[metric.key]}
              previous={previousWeek[metric.key]}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
