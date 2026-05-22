import { Link } from 'react-router-dom';
import { Card, Badge, Button } from '../../design-system/components';

export interface OnboardingStepData {
  key: string;
  title: string;
  description: string;
  completed: boolean;
  completedAt: string | null;
}

export interface OnboardingStepCardProps {
  step: OnboardingStepData;
  index: number;
  /** Route path for the action link */
  actionPath?: string;
  /** Label for the action button */
  actionLabel?: string;
}

/** Maps onboarding step keys to their relevant admin page paths */
const STEP_PATHS: Record<string, string> = {
  company_profile: '/locations',
  services_setup: '/services',
  location_setup: '/locations',
  first_client: '/clients',
  first_appointment: '/appointments',
  public_page_activation: '/locations',
  first_review_received: '/appointments',
};

const cardStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--ds-space-3)',
  padding: 'var(--ds-space-4)',
};

const numberStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  minWidth: '32px',
  borderRadius: 'var(--ds-radius-full)',
  fontSize: 'var(--ds-font-size-sm)',
  fontWeight: 'var(--ds-font-weight-semibold)',
  transition: 'background-color var(--ds-transition-fast), color var(--ds-transition-fast)',
};

const completedNumberStyles: React.CSSProperties = {
  ...numberStyles,
  backgroundColor: 'var(--ds-color-success)',
  color: 'var(--ds-color-text-inverse)',
};

const pendingNumberStyles: React.CSSProperties = {
  ...numberStyles,
  backgroundColor: 'var(--ds-color-bg-muted)',
  color: 'var(--ds-color-text-secondary)',
};

const contentStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--ds-space-1)',
  flex: 1,
};

const titleStyles: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--ds-font-size-sm)',
  fontWeight: 'var(--ds-font-weight-semibold)',
  color: 'var(--ds-color-text-primary)',
  lineHeight: 'var(--ds-line-height-tight)',
};

const descStyles: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--ds-font-size-xs)',
  color: 'var(--ds-color-text-muted)',
  lineHeight: 'var(--ds-line-height-normal)',
};

const actionRowStyles: React.CSSProperties = {
  marginTop: 'var(--ds-space-2)',
};

export function OnboardingStepCard({
  step,
  index,
  actionPath,
  actionLabel = 'Configurar',
}: OnboardingStepCardProps) {
  const path = actionPath || STEP_PATHS[step.key] || '/';

  return (
    <Card
      variant="outlined"
      padded={false}
      style={{
        opacity: step.completed ? 0.75 : 1,
      }}
    >
      <div style={cardStyles}>
        <div style={step.completed ? completedNumberStyles : pendingNumberStyles}>
          {step.completed ? '✓' : index + 1}
        </div>
        <div style={contentStyles}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-2)' }}>
            <h4 style={titleStyles}>{step.title}</h4>
            {step.completed && (
              <Badge variant="success" size="sm">
                Concluído
              </Badge>
            )}
          </div>
          <p style={descStyles}>{step.description}</p>
          {!step.completed && (
            <div style={actionRowStyles}>
              <Link to={path} style={{ textDecoration: 'none' }}>
                <Button variant="outline" size="sm">
                  {actionLabel}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
