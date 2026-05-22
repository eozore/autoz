import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../design-system/components/Card';
import { Badge } from '../../design-system/components/Badge';
import api from '../../lib/api';

export interface ContextualTipProps {
  /** Unique key identifying the page (e.g., 'dashboard', 'services', 'clients') */
  pageKey: string;
  /** Title of the tip */
  title: string;
  /** Description explaining the page purpose and next recommended action */
  description: string;
}

const STORAGE_KEY = 'autoz_tips_dismissed';

/** Read dismissed tips from localStorage for immediate rendering */
function getLocalDismissed(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Persist a dismissed tip to localStorage */
function addLocalDismissed(pageKey: string): void {
  const current = getLocalDismissed();
  if (!current.includes(pageKey)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, pageKey]));
  }
}

/**
 * ContextualTip — A dismissible info card that explains the purpose of an admin page
 * and suggests the next recommended action.
 *
 * Dismissed state is persisted both locally (for fast UX) and via the API
 * (TenantSettings tips_dismissed array) for cross-device persistence.
 *
 * Validates: Requirements 3.4
 */
export function ContextualTip({ pageKey, title, description }: ContextualTipProps) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    return getLocalDismissed().includes(pageKey);
  });
  const [loaded, setLoaded] = useState(false);

  // Fetch dismissed state from API on mount (reconcile with server)
  useEffect(() => {
    let cancelled = false;

    async function fetchDismissedState() {
      try {
        const data = await api.get<{ tips_dismissed: string[] }>('/settings/tips-dismissed');
        if (!cancelled) {
          if (data.tips_dismissed.includes(pageKey)) {
            setDismissed(true);
            addLocalDismissed(pageKey);
          }
          setLoaded(true);
        }
      } catch {
        // If API fails, rely on local state
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    fetchDismissedState();
    return () => { cancelled = true; };
  }, [pageKey]);

  const handleDismiss = useCallback(async () => {
    setDismissed(true);
    addLocalDismissed(pageKey);

    // Persist to backend (fire-and-forget)
    try {
      await api.post('/settings/dismiss-tip', { pageKey });
    } catch {
      // Dismissal is already saved locally; API failure is non-blocking
    }
  }, [pageKey]);

  // Don't render if already dismissed
  if (dismissed) {
    return null;
  }

  // Don't render until we've checked (avoids flash of tip that was dismissed on another device)
  if (!loaded && getLocalDismissed().includes(pageKey)) {
    return null;
  }

  return (
    <Card
      variant="outlined"
      padded
      style={{
        borderColor: 'var(--ds-color-info-border)',
        backgroundColor: 'var(--ds-color-info-bg)',
        marginBottom: 'var(--ds-space-5)',
      }}
      role="status"
      aria-label={`Dica: ${title}`}
    >
      <div style={containerStyles}>
        <div style={iconContainerStyles}>
          <LightbulbIcon />
        </div>
        <div style={contentStyles}>
          <div style={headerStyles}>
            <div style={titleRowStyles}>
              <h4 style={titleStyles}>{title}</h4>
              <Badge variant="info" size="sm">Dica</Badge>
            </div>
            <button
              onClick={handleDismiss}
              style={closeButtonStyles}
              aria-label="Fechar dica"
              type="button"
            >
              <CloseIcon />
            </button>
          </div>
          <p style={descriptionStyles}>{description}</p>
        </div>
      </div>
    </Card>
  );
}

/** Lightbulb SVG icon */
function LightbulbIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ds-color-info)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  );
}

/** Close (X) SVG icon */
function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ===== Inline Styles =====

const containerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--ds-space-3)',
};

const iconContainerStyles: React.CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '36px',
  height: '36px',
  borderRadius: 'var(--ds-radius-md)',
  backgroundColor: 'rgba(59, 130, 246, 0.1)',
  marginTop: 'var(--ds-space-1)',
};

const contentStyles: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const headerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 'var(--ds-space-2)',
};

const titleRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--ds-space-2)',
  flexWrap: 'wrap',
};

const titleStyles: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--ds-font-size-sm)',
  fontWeight: 'var(--ds-font-weight-semibold)',
  color: 'var(--ds-color-text-primary)',
  fontFamily: 'var(--ds-font-family)',
  lineHeight: 'var(--ds-line-height-tight)',
};

const descriptionStyles: React.CSSProperties = {
  margin: 0,
  marginTop: 'var(--ds-space-1)',
  fontSize: 'var(--ds-font-size-sm)',
  color: 'var(--ds-color-text-secondary)',
  fontFamily: 'var(--ds-font-family)',
  lineHeight: 'var(--ds-line-height-normal)',
};

const closeButtonStyles: React.CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'var(--ds-touch-target-min)',
  height: 'var(--ds-touch-target-min)',
  minWidth: 'var(--ds-touch-target-min)',
  minHeight: 'var(--ds-touch-target-min)',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  borderRadius: 'var(--ds-radius-sm)',
  color: 'var(--ds-color-text-muted)',
  padding: 0,
  transition: 'color var(--ds-transition-fast), background-color var(--ds-transition-fast)',
};
