import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../design-system/components/Card';
import { Badge } from '../../design-system/components/Badge';
import api from '../../lib/api';

interface LiquidityData {
  completedThisMonth: number;
  avgResponseTimeMinutes: number | null;
  isColdStart: boolean;
  totalCompleted: number;
}

export interface LiquiditySignalsProps {
  slug: string;
}

const POLL_INTERVAL_MS = 300000; // 5 minutes

export function LiquiditySignals({ slug }: LiquiditySignalsProps) {
  const [data, setData] = useState<LiquidityData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLiquidity = useCallback(async () => {
    try {
      const result = await api.get<LiquidityData>(`/public/${slug}/liquidity`);
      setData(result);
    } catch {
      // Silently fail — liquidity signals are non-critical
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchLiquidity();

    const intervalId = setInterval(fetchLiquidity, POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchLiquidity]);

  if (loading || !data) {
    return null;
  }

  if (data.isColdStart) {
    return (
      <Card variant="outlined" padded>
        <div style={containerStyles}>
          <Badge variant="success" size="md">
            ✓ Oficina Ativa
          </Badge>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="outlined" padded>
      <div style={containerStyles}>
        <div style={metricStyles}>
          <Badge variant="primary" size="sm">
            📅
          </Badge>
          <span style={metricTextStyles}>
            {data.completedThisMonth} atendimentos este mês
          </span>
        </div>
        {data.avgResponseTimeMinutes !== null && (
          <div style={metricStyles}>
            <Badge variant="info" size="sm">
              ⚡
            </Badge>
            <span style={metricTextStyles}>
              Tempo médio de resposta: {Math.round(data.avgResponseTimeMinutes)} min
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--ds-space-3)',
};

const metricStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--ds-space-2)',
};

const metricTextStyles: React.CSSProperties = {
  fontFamily: 'var(--ds-font-family)',
  fontSize: 'var(--ds-font-size-sm)',
  color: 'var(--ds-color-text-secondary)',
};
