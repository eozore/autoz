import { useState, useEffect, useCallback } from 'react';
import { Badge } from '../../design-system/components';
import { OnboardingStepCard, type OnboardingStepData } from './OnboardingStepCard';
import api from '../../lib/api';

export interface OnboardingProgressResponse {
  steps: OnboardingStepData[];
  completenessPercent: number;
  allCompleted: boolean;
}

export interface OnboardingBannerProps {
  /** Whether the checklist starts expanded */
  defaultExpanded?: boolean;
  /** Callback when all steps are completed */
  onAllCompleted?: () => void;
}

export function OnboardingBanner({
  defaultExpanded = false,
  onAllCompleted,
}: OnboardingBannerProps) {
  const [progress, setProgress] = useState<OnboardingProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const fetchProgress = useCallback(async () => {
    try {
      const data = await api.get<OnboardingProgressResponse>('/onboarding/progress');
      setProgress(data);
      setError(false);
      if (data.allCompleted) {
        onAllCompleted?.();
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [onAllCompleted]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  if (loading || error || !progress) {
    return null;
  }

  // Don't show if all steps are complete
  if (progress.allCompleted) {
    return null;
  }

  const completedCount = progress.steps.filter((s) => s.completed).length;
  const totalCount = progress.steps.length;
  const nextStep = progress.steps.find((s) => !s.completed);

  return (
    <div style={bannerStyles}>
      {/* Compact bar — always visible */}
      <div
        style={barStyles}
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label="Expandir passos de configuração"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        <div style={barLeftStyles}>
          <span style={{ fontSize: '1rem' }}>📋</span>
          <span style={barTitleStyles}>
            Configuração: {completedCount}/{totalCount}
          </span>
          {nextStep && (
            <span style={nextStepStyles}>
              Próximo: {nextStep.title}
            </span>
          )}
        </div>

        <div style={barRightStyles}>
          {/* Mini progress bar */}
          <div style={miniProgressTrackStyles}>
            <div
              style={{
                ...miniProgressFillStyles,
                width: `${progress.completenessPercent}%`,
              }}
            />
          </div>
          <Badge variant="primary" size="sm">
            {progress.completenessPercent}%
          </Badge>
          <span style={chevronStyles}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Expanded detail — only when user clicks */}
      {expanded && (
        <div style={expandedStyles}>
          <div style={gridStyles}>
            {progress.steps.map((step, index) => (
              <OnboardingStepCard key={step.key} step={step} index={index} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Styles =====

const bannerStyles: React.CSSProperties = {
  marginBottom: 'var(--ds-space-4)',
  borderRadius: 'var(--ds-radius-lg)',
  border: '1px solid var(--ds-color-border-light)',
  overflow: 'hidden',
  backgroundColor: 'var(--ds-color-bg-card)',
  boxShadow: 'var(--ds-shadow-sm)',
};

const barStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.65rem 1rem',
  cursor: 'pointer',
  gap: '1rem',
  transition: 'background-color 0.15s ease',
};

const barLeftStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  minWidth: 0,
  flex: 1,
};

const barTitleStyles: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 600,
  color: 'var(--ds-color-text-primary)',
  whiteSpace: 'nowrap',
};

const nextStepStyles: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--ds-color-text-muted)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const barRightStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  flexShrink: 0,
};

const miniProgressTrackStyles: React.CSSProperties = {
  width: '60px',
  height: '6px',
  backgroundColor: 'var(--ds-color-bg-muted)',
  borderRadius: '3px',
  overflow: 'hidden',
};

const miniProgressFillStyles: React.CSSProperties = {
  height: '100%',
  backgroundColor: 'var(--ds-color-primary)',
  borderRadius: '3px',
  transition: 'width 0.3s ease',
};

const chevronStyles: React.CSSProperties = {
  fontSize: '0.65rem',
  color: 'var(--ds-color-text-muted)',
};

const expandedStyles: React.CSSProperties = {
  borderTop: '1px solid var(--ds-color-border-light)',
  padding: '1rem',
  backgroundColor: 'var(--ds-color-bg-muted)',
};

const gridStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: '0.6rem',
};
