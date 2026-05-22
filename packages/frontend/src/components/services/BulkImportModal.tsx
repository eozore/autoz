import { useState } from 'react';
import { Modal } from '../../design-system/components/Modal';
import { Button } from '../../design-system/components/Button';
import { Badge } from '../../design-system/components/Badge';
import api from '../../lib/api';

export interface BulkImportModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Called when the modal requests to close */
  onClose: () => void;
  /** Called after successful import */
  onSuccess: () => void;
}

interface ServiceTemplate {
  nome: string;
  duracao_minutos: number;
  valor: number;
}

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  { nome: 'Troca de Óleo e Filtro', duracao_minutos: 45, valor: 150 },
  { nome: 'Alinhamento e Balanceamento', duracao_minutos: 60, valor: 120 },
  { nome: 'Revisão Completa', duracao_minutos: 120, valor: 250 },
  { nome: 'Diagnóstico Eletrônico', duracao_minutos: 30, valor: 100 },
  { nome: 'Lavagem Completa', duracao_minutos: 60, valor: 90 },
  { nome: 'Troca de Pastilhas de Freio', duracao_minutos: 90, valor: 180 },
  { nome: 'Higienização de Ar Condicionado', duracao_minutos: 45, valor: 80 },
  { nome: 'Polimento e Cristalização', duracao_minutos: 180, valor: 350 },
];

const listStyles: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: '0 0 var(--ds-space-4) 0',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--ds-space-2)',
};

const itemStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--ds-space-3)',
  padding: 'var(--ds-space-3) var(--ds-space-4)',
  borderRadius: 'var(--ds-radius-md)',
  border: '1px solid var(--ds-color-border-light)',
  backgroundColor: 'var(--ds-color-bg-card)',
  cursor: 'pointer',
  transition: 'border-color var(--ds-transition-fast), background-color var(--ds-transition-fast)',
};

const itemSelectedStyles: React.CSSProperties = {
  ...itemStyles,
  borderColor: 'var(--ds-color-primary)',
  backgroundColor: 'var(--ds-color-primary-glow)',
};

const checkboxStyles: React.CSSProperties = {
  width: '18px',
  height: '18px',
  accentColor: 'var(--ds-color-primary)',
  cursor: 'pointer',
  flexShrink: 0,
};

const serviceInfoStyles: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--ds-space-1)',
};

const serviceNameStyles: React.CSSProperties = {
  fontSize: 'var(--ds-font-size-base)',
  fontWeight: 'var(--ds-font-weight-medium)',
  color: 'var(--ds-color-text-primary)',
};

const serviceMetaStyles: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--ds-space-2)',
  alignItems: 'center',
};

const footerStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: 'var(--ds-space-4)',
  borderTop: '1px solid var(--ds-color-border-light)',
};

const selectAllStyles: React.CSSProperties = {
  fontSize: 'var(--ds-font-size-sm)',
  color: 'var(--ds-color-primary)',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  fontWeight: 'var(--ds-font-weight-medium)',
  padding: 'var(--ds-space-1) var(--ds-space-2)',
  borderRadius: 'var(--ds-radius-sm)',
};

const errorStyles: React.CSSProperties = {
  color: 'var(--ds-color-danger)',
  fontSize: 'var(--ds-font-size-sm)',
  marginBottom: 'var(--ds-space-3)',
};

export function BulkImportModal({ open, onClose, onSuccess }: BulkImportModalProps) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(SERVICE_TEMPLATES.map((_, i) => i))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleItem(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === SERVICE_TEMPLATES.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(SERVICE_TEMPLATES.map((_, i) => i)));
    }
  }

  async function handleImport() {
    if (selected.size === 0) return;

    setLoading(true);
    setError('');

    try {
      const services = SERVICE_TEMPLATES
        .filter((_, i) => selected.has(i))
        .map((t) => ({
          nome: t.nome,
          duracao_minutos: t.duracao_minutos,
          valor: t.valor,
        }));

      await api.post('/services/bulk', { services });
      onSuccess();
      onClose();
    } catch {
      setError('Erro ao importar serviços. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const allSelected = selected.size === SERVICE_TEMPLATES.length;

  return (
    <Modal open={open} onClose={onClose} title="Importar Pacote de Serviços">
      <p style={{ color: 'var(--ds-color-text-secondary)', fontSize: 'var(--ds-font-size-sm)', marginTop: 0, marginBottom: 'var(--ds-space-4)' }}>
        Selecione os serviços automotivos que deseja importar. Você pode editar os valores depois.
      </p>

      {error && <p style={errorStyles}>{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--ds-space-2)' }}>
        <button
          type="button"
          onClick={toggleAll}
          style={selectAllStyles}
        >
          {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
        </button>
      </div>

      <ul style={listStyles} role="list">
        {SERVICE_TEMPLATES.map((template, index) => (
          <li
            key={template.nome}
            style={selected.has(index) ? itemSelectedStyles : itemStyles}
            onClick={() => toggleItem(index)}
            role="option"
            aria-selected={selected.has(index)}
          >
            <input
              type="checkbox"
              checked={selected.has(index)}
              onChange={() => toggleItem(index)}
              style={checkboxStyles}
              aria-label={`Selecionar ${template.nome}`}
              onClick={(e) => e.stopPropagation()}
            />
            <div style={serviceInfoStyles}>
              <span style={serviceNameStyles}>{template.nome}</span>
              <div style={serviceMetaStyles}>
                <Badge variant="info" size="sm">⏱️ {template.duracao_minutos} min</Badge>
                <Badge variant="success" size="sm">R$ {template.valor.toFixed(2)}</Badge>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div style={footerStyles}>
        <span style={{ fontSize: 'var(--ds-font-size-sm)', color: 'var(--ds-color-text-muted)' }}>
          {selected.size} de {SERVICE_TEMPLATES.length} selecionados
        </span>
        <div style={{ display: 'flex', gap: 'var(--ds-space-3)' }}>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleImport}
            loading={loading}
            disabled={selected.size === 0}
          >
            Importar Selecionados
          </Button>
        </div>
      </div>
    </Modal>
  );
}
