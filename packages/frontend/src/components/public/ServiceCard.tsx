import { Card } from '../../design-system/components/Card';
import { Badge } from '../../design-system/components/Badge';

/* ── Types ─────────────────────────────────────────── */

export interface ServiceCardProps {
  /** Service name */
  name: string;
  /** Service description */
  description?: string | null;
  /** Photo URL for the service */
  photoUrl?: string | null;
  /** Price in BRL (null means "Sob consulta") */
  price: number | null;
  /** Duration in minutes */
  durationMinutes: number;
  /** Total completed count for social proof */
  totalCompleted?: number;
  /** Whether this card is currently selected */
  selected?: boolean;
  /** Click handler */
  onClick?: () => void;
}

/* ── Helpers ───────────────────────────────────────── */

function formatPrice(value: number | null): string {
  if (value === null || value === undefined) {
    return 'Sob consulta';
  }
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remaining}min`;
}

/* ── Component ─────────────────────────────────────── */

export function ServiceCard({
  name,
  description,
  photoUrl,
  price,
  durationMinutes,
  totalCompleted,
  selected = false,
  onClick,
}: ServiceCardProps) {
  return (
    <Card
      variant={selected ? 'elevated' : 'default'}
      hoverable
      padded={false}
      onClick={onClick}
      style={{
        border: selected
          ? '2px solid var(--ds-color-primary)'
          : '1px solid var(--ds-color-border-light)',
        cursor: 'pointer',
        transition: 'all 0.1s ease',
        overflow: 'hidden',
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Serviço: ${name}. ${formatPrice(price)}. Duração: ${formatDuration(durationMinutes)}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Image Section */}
      {photoUrl && (
        <div style={imageWrapperStyles}>
          <img
            src={photoUrl}
            alt={name}
            style={imageStyles}
          />
        </div>
      )}

      {/* Content Section */}
      <div style={bodyStyles}>
        <h4 style={titleStyles}>{name}</h4>

        {description && (
          <p style={descStyles}>{description}</p>
        )}

        {/* Footer with price, duration, and completed count */}
        <div style={footerStyles}>
          <div style={priceRowStyles}>
            <span style={priceStyles(price)}>
              {formatPrice(price)}
            </span>
            <span style={durationStyles}>
              ⏱ {formatDuration(durationMinutes)}
            </span>
          </div>

          {totalCompleted != null && totalCompleted > 0 && (
            <div style={{ marginTop: 'var(--ds-space-2)' }}>
              <Badge variant="default" size="sm">
                ✓ {totalCompleted} {totalCompleted === 1 ? 'realizado' : 'realizados'}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ── Styles ────────────────────────────────────────── */

const imageWrapperStyles: React.CSSProperties = {
  width: '100%',
  height: '140px',
  overflow: 'hidden',
  backgroundColor: 'var(--ds-color-bg-muted)',
};

const imageStyles: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const bodyStyles: React.CSSProperties = {
  padding: 'var(--ds-space-4)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--ds-space-2)',
};

const titleStyles: React.CSSProperties = {
  fontSize: 'var(--ds-font-size-base)',
  fontWeight: 'var(--ds-font-weight-semibold)',
  color: 'var(--ds-color-text-primary)',
  margin: 0,
  lineHeight: 'var(--ds-line-height-tight)',
};

const descStyles: React.CSSProperties = {
  fontSize: 'var(--ds-font-size-sm)',
  color: 'var(--ds-color-text-secondary)',
  margin: 0,
  lineHeight: 'var(--ds-line-height-normal)',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

const footerStyles: React.CSSProperties = {
  marginTop: 'var(--ds-space-2)',
};

const priceRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--ds-space-2)',
};

function priceStyles(price: number | null): React.CSSProperties {
  return {
    fontSize: 'var(--ds-font-size-base)',
    fontWeight: 'var(--ds-font-weight-bold)',
    color: price !== null ? 'var(--ds-color-primary)' : 'var(--ds-color-text-muted)',
    fontFamily: 'var(--ds-font-family)',
  };
}

const durationStyles: React.CSSProperties = {
  fontSize: 'var(--ds-font-size-sm)',
  color: 'var(--ds-color-text-muted)',
  fontFamily: 'var(--ds-font-family)',
};
