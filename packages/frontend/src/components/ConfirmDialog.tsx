import { Modal } from '../design-system/components/Modal';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning';
}

const descriptionStyles: React.CSSProperties = {
  fontSize: 'var(--ds-font-size-base, 0.95rem)',
  color: 'var(--ds-color-text-secondary, #475569)',
  lineHeight: 'var(--ds-line-height-normal, 1.5)',
  margin: '0 0 var(--ds-space-6, 1.5rem) 0',
};

const actionsStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 'var(--ds-space-3, 0.75rem)',
};

const cancelButtonStyles: React.CSSProperties = {
  padding: '0.55rem 1.1rem',
  border: '1px solid var(--ds-color-border-base, #e2e8f0)',
  borderRadius: 'var(--ds-radius-md, 10px)',
  background: '#ffffff',
  cursor: 'pointer',
  fontSize: '0.88rem',
  fontFamily: 'inherit',
  fontWeight: 600,
  color: 'var(--ds-color-text-secondary, #475569)',
};

const confirmButtonBaseStyles: React.CSSProperties = {
  padding: '0.55rem 1.1rem',
  border: 'none',
  borderRadius: 'var(--ds-radius-md, 10px)',
  cursor: 'pointer',
  fontSize: '0.88rem',
  fontFamily: 'inherit',
  fontWeight: 600,
  color: '#ffffff',
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  variant = 'danger',
}: ConfirmDialogProps) {
  const confirmStyles: React.CSSProperties = {
    ...confirmButtonBaseStyles,
    background: variant === 'danger'
      ? 'var(--ds-color-danger, #ef4444)'
      : 'var(--ds-color-warning, #f59e0b)',
  };

  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p style={descriptionStyles}>{description}</p>
      <div style={actionsStyles}>
        <button type="button" style={cancelButtonStyles} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" style={confirmStyles} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
