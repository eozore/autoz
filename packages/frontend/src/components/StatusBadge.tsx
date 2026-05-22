import { Badge } from '../design-system/components/Badge';

export type AppointmentStatus = 'AGENDADO' | 'CONFIRMADO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';

interface StatusConfig {
  variant: 'info' | 'warning' | 'success' | 'danger';
  icon: string;
  label: string;
}

const statusMap: Record<AppointmentStatus, StatusConfig> = {
  AGENDADO: { variant: 'info', icon: '⏳', label: 'Agendado' },
  CONFIRMADO: { variant: 'info', icon: '⏳', label: 'Confirmado' },
  EM_ANDAMENTO: { variant: 'warning', icon: '▶', label: 'Em Andamento' },
  CONCLUIDO: { variant: 'success', icon: '✓', label: 'Finalizado' },
  CANCELADO: { variant: 'danger', icon: '✕', label: 'Cancelado' },
};

export interface StatusBadgeProps {
  status: AppointmentStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusMap[status] || statusMap.AGENDADO;

  return (
    <Badge variant={config.variant} aria-label={`Status: ${config.label}`}>
      <span aria-hidden="true">{config.icon}</span> {config.label}
    </Badge>
  );
}
