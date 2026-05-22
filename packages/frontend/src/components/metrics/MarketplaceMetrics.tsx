import { useState, useEffect } from 'react';
import { Grid } from '../../design-system/components';
import { ConversionRate } from './ConversionRate';
import { RepeatCustomers } from './RepeatCustomers';
import { CustomerRating } from './CustomerRating';
import api from '../../lib/api';

interface MarketplaceMetricsResponse {
  conversionRate: number;
  averageRating: number | null;
  repeatCustomerPercent: number;
  completedThisMonth: number;
  avgResponseTimeMinutes: number | null;
}

const sectionStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--ds-space-4)',
};

const titleStyles: React.CSSProperties = {
  fontSize: 'var(--ds-font-size-lg)',
  fontWeight: 'var(--ds-font-weight-semibold)',
  color: 'var(--ds-color-text-primary)',
  margin: 0,
};

const loadingStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--ds-space-8)',
  color: 'var(--ds-color-text-muted)',
  fontSize: 'var(--ds-font-size-sm)',
};

const errorStyles: React.CSSProperties = {
  padding: 'var(--ds-space-4)',
  color: 'var(--ds-color-danger)',
  fontSize: 'var(--ds-font-size-sm)',
  textAlign: 'center',
};

export function MarketplaceMetrics() {
  const [metrics, setMetrics] = useState<MarketplaceMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchMetrics() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.get<MarketplaceMetricsResponse>(
          '/dashboard/marketplace-metrics',
        );
        if (!cancelled) {
          setMetrics(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Não foi possível carregar as métricas do marketplace.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchMetrics();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div style={loadingStyles}>
        Carregando métricas...
      </div>
    );
  }

  if (error) {
    return (
      <div style={errorStyles}>
        {error}
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <section style={sectionStyles}>
      <h3 style={titleStyles}>Métricas do Marketplace</h3>
      <Grid columns={{ mobile: 1, tablet: 2, desktop: 3 }} gap="md">
        <ConversionRate value={metrics.conversionRate} />
        <RepeatCustomers value={metrics.repeatCustomerPercent} />
        <CustomerRating value={metrics.averageRating} />
      </Grid>
    </section>
  );
}
