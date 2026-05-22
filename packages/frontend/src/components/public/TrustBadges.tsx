import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { Card } from '../../design-system/components/Card';
import { Badge } from '../../design-system/components/Badge';

/* ── Types ─────────────────────────────────────────── */

interface TenantSettings {
  garantia_enabled: boolean;
}

interface LiquidityData {
  totalCompleted: number;
}

export interface TrustBadgesProps {
  slug: string;
}

/* ── Component ─────────────────────────────────────── */

export function TrustBadges({ slug }: TrustBadgesProps) {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [totalCompleted, setTotalCompleted] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function fetchData() {
      try {
        const [settingsRes, liquidityRes] = await Promise.all([
          api.get<TenantSettings>(`/public/${slug}/settings`),
          api.get<LiquidityData>(`/public/${slug}/liquidity`),
        ]);
        if (!cancelled) {
          setSettings(settingsRes);
          setTotalCompleted(liquidityRes.totalCompleted);
        }
      } catch {
        // Non-critical — silently fail
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading || !settings) {
    return null;
  }

  const showGarantia = settings.garantia_enabled;
  const showCompleted = totalCompleted > 0;

  // Don't render if there's nothing to show
  if (!showGarantia && !showCompleted) {
    return null;
  }

  return (
    <section style={{ marginBottom: 'var(--ds-space-6)' }}>
      <Card variant="outlined" padded>
        <div style={containerStyles}>
          {showGarantia && (
            <div style={badgeRowStyles}>
              <Badge variant="success" size="md">
                🛡️ Garantia Inclusa
              </Badge>
              <span style={badgeDescStyles}>
                Serviços realizados com garantia de qualidade.
              </span>
            </div>
          )}

          {showCompleted && (
            <div style={badgeRowStyles}>
              <Badge variant="primary" size="md">
                ✓ {totalCompleted} {totalCompleted === 1 ? 'serviço realizado' : 'serviços realizados'}
              </Badge>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}

/* ── Styles ────────────────────────────────────────── */

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--ds-space-3)',
};

const badgeRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--ds-space-3)',
  flexWrap: 'wrap',
};

const badgeDescStyles: React.CSSProperties = {
  fontFamily: 'var(--ds-font-family)',
  fontSize: 'var(--ds-font-size-sm)',
  color: 'var(--ds-color-text-secondary)',
};
