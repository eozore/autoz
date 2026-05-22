import { useState, useCallback } from 'react';
import type { ConfirmDialogProps } from '../components/ConfirmDialog';

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
}

type DialogProps = Omit<ConfirmDialogProps, 'children'>;

export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<DialogProps>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  const confirm = useCallback((options: ConfirmOptions) => {
    setDialogState({
      open: true,
      title: options.title,
      description: options.description,
      confirmLabel: options.confirmLabel,
      cancelLabel: options.cancelLabel,
      variant: options.variant || 'danger',
      onConfirm: () => {
        options.onConfirm();
        setDialogState(prev => ({ ...prev, open: false }));
      },
      onCancel: () => {
        setDialogState(prev => ({ ...prev, open: false }));
      },
    });
  }, []);

  return { dialogProps: dialogState, confirm };
}
