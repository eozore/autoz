import { Card, Badge as DSBadge, EmptyState } from '../../design-system/components';

export interface BadgeItem {
  id: string;
  type: string;
  awardedAt: string;
  label: string;
}

export interface BadgeDisplayProps {
  /** List of earned badges */
  badges: BadgeItem[];
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
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gap: 'var(--ds-space-3)',
};

const badgeCardStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--ds-space-2)',
  padding: 'var(--ds-space-4)',
  borderRadius: 'var(--ds-radius-md)',
  backgroundColor: 'var(--ds-color-bg-muted)',
  textAlign: 'center',
};

const badgeIconStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '48px',
  height: '48px',
  borderRadius: 'var(--ds-radius-full)',
  backgroundColor: 'var(--ds-color-primary-glow)',
  fontSize: 'var(--ds-font-size-xl)',
};

const badgeLabelStyles: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--ds-font-size-sm)',
  fontWeight: 'var(--ds-font-weight-medium)',
  color: 'var(--ds-color-text-primary)',
  lineHeight: 'var(--ds-line-height-tight)',
};

const badgeDateStyles: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--ds-font-size-xs)',
  color: 'var(--ds-color-text-muted)',
};

const loadingStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '120px',
  color: 'var(--ds-color-text-muted)',
  fontSize: 'var(--ds-font-size-sm)',
};

/** Map badge types to emoji icons */
const BADGE_ICONS: Record<string, string> = {
  PERFIL_COMPLETO: '✅',
  STREAK_MENSAL: '🔥',
  PRIMEIRO_REVIEW: '⭐',
};

function formatDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/**
 * BadgeDisplay shows a grid of earned badges with icons and labels.
 * Displays an empty state when no badges have been earned.
 */
export function BadgeDisplay({ badges, loading = false }: BadgeDisplayProps) {
  if (loading) {
    return (
      <Card>
        <div style={loadingStyles}>Carregando...</div>
      </Card>
    );
  }

  if (badges.length === 0) {
    return (
      <Card>
        <h3 style={headerStyles}>Conquistas</h3>
        <EmptyState
          icon={<span>🏆</span>}
          title="Nenhuma conquista ainda"
          description="Complete ações na plataforma para ganhar badges e conquistas."
        />
      </Card>
    );
  }

  return (
    <Card>
      <h3 style={headerStyles}>Conquistas</h3>
      <div style={gridStyles}>
        {badges.map((badge) => (
          <div key={badge.id} style={badgeCardStyles}>
            <div style={badgeIconStyles}>
              {BADGE_ICONS[badge.type] || '🏅'}
            </div>
            <DSBadge variant="primary" size="sm">
              {badge.label}
            </DSBadge>
            <p style={badgeLabelStyles}>{badge.label}</p>
            <p style={badgeDateStyles}>{formatDate(badge.awardedAt)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
