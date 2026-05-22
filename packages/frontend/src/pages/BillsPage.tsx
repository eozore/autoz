import { useState, useEffect, useMemo, type FormEvent } from 'react';
import api, { ApiError } from '../lib/api';
import { Modal } from '../design-system/components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

interface Bill {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: 'PENDENTE' | 'PAGO';
}

const emptyBill = { descricao: '', valor: '', data_vencimento: '' };

type FilterOption = 'TODOS' | 'PENDENTE' | 'VENCIDO' | 'PAGO';

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyBill);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterOption>('TODOS');
  const [search, setSearch] = useState('');
  const { dialogProps, confirm } = useConfirmDialog();

  async function loadBills(apiStatus?: string) {
    try {
      const params = apiStatus ? `?status=${apiStatus}` : '';
      const res = await api.get<{ data: Bill[]; nextCursor: string | null }>(`/bills${params}`);
      setBills(res.data);
    } catch { setError('Erro ao carregar contas'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadBills(); }, []);

  function applyFilter(option: FilterOption) {
    setFilterStatus(option);
    setLoading(true);
    if (option === 'PAGO') {
      loadBills('PAGO');
    } else if (option === 'PENDENTE' || option === 'VENCIDO') {
      loadBills('PENDENTE');
    } else {
      loadBills();
    }
  }

  const filtered = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let result = bills;

    // "Pendente" shows ALL PENDENTE bills (including overdue)
    // "Vencido" shows only PENDENTE with past due date
    if (filterStatus === 'PENDENTE') {
      result = result.filter(b => b.status === 'PENDENTE');
    } else if (filterStatus === 'VENCIDO') {
      result = result.filter(b => b.status === 'PENDENTE' && new Date(b.data_vencimento) < now);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(b => b.descricao.toLowerCase().includes(q));
    }
    return result;
  }, [bills, search, filterStatus]);

  function startCreate() {
    setEditId(null);
    setForm(emptyBill);
    setShowForm(true);
  }

  function startEdit(b: Bill) {
    setEditId(b.id);
    setForm({
      descricao: b.descricao,
      valor: String(b.valor),
      data_vencimento: b.data_vencimento.split('T')[0],
    });
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body = {
        descricao: form.descricao,
        valor: parseFloat(form.valor),
        data_vencimento: form.data_vencimento,
      };
      if (editId) {
        await api.put(`/bills/${editId}`, body);
      } else {
        await api.post('/bills', body);
      }
      setShowForm(false);
      applyFilter(filterStatus);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  async function handlePay(id: string) {
    try {
      await api.patch(`/bills/${id}/pay`);
      applyFilter(filterStatus);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao marcar como paga');
    }
  }

  async function handleDelete(id: string) {
    confirm({
      title: 'Confirmar Exclusão',
      description: 'Tem certeza que deseja excluir esta conta?',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/bills/${id}`);
          applyFilter(filterStatus);
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Erro ao excluir');
        }
      },
    });
  }

  function upd(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })); }

  if (loading) return <div className="loading">Carregando...</div>;

  const filterOptions: { key: FilterOption; label: string }[] = [
    { key: 'TODOS', label: 'Todos' },
    { key: 'PENDENTE', label: 'Pendente' },
    { key: 'VENCIDO', label: 'Vencido' },
    { key: 'PAGO', label: 'Pago' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Contas a Pagar</h1>
        <button className="btn btn-primary" onClick={startCreate}>Nova Conta</button>
      </div>
      {error && <p className="error-msg">{error}</p>}

      <div className="filter-pills">
        {filterOptions.map(opt => (
          <button
            key={opt.key}
            className={`filter-pill${filterStatus === opt.key ? ' active' : ''}${opt.key === 'VENCIDO' ? ' danger' : ''}`}
            onClick={() => applyFilter(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="search-bar">
        <input className="search-input" placeholder="Buscar por descrição..." value={search} onChange={e => { setSearch(e.target.value); }} />
      </div>

      {showForm && (
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editId ? 'Editar Conta' : 'Nova Conta'}>
              <form onSubmit={handleSubmit}>
                <label>Descrição *<input value={form.descricao} onChange={e => upd('descricao', e.target.value)} required /></label>
                <div className="form-row">
                  <label className="flex-grow">Valor (R$) *<input type="number" step="0.01" value={form.valor} onChange={e => upd('valor', e.target.value)} required /></label>
                  <label className="flex-grow">Data de Vencimento *<input type="date" value={form.data_vencimento} onChange={e => upd('data_vencimento', e.target.value)} required /></label>
                </div>
                <div className="form-row">
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
                  <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
                </div>
              </form>
        </Modal>
      )}

      {filtered.length === 0 ? (
        <p className="empty">{search ? 'Nenhuma conta encontrada.' : 'Nenhuma conta cadastrada.'}</p>
      ) : (
        <div className="item-cards">
          {filtered.map(b => {
            const isOverdue = b.status === 'PENDENTE' && new Date(b.data_vencimento) < new Date();
            const badgeClass = b.status === 'PAGO' ? 'badge-green' : isOverdue ? 'badge-red' : 'badge-yellow';
            const badgeText = b.status === 'PAGO' ? 'Pago' : isOverdue ? 'Vencido' : 'Pendente';
            return (
              <div className="item-card" key={b.id} style={isOverdue ? { borderLeft: '3px solid #dc2626' } : undefined}>
                <div className="item-card-header">
                  <div className="item-card-title">{b.descricao}</div>
                  <span className={`badge ${badgeClass}`}>{badgeText}</span>
                </div>
                <div className="item-card-body">
                  <div className="item-card-row">
                    <span className="item-card-label">Valor</span>
                    <span className="item-card-value">R$ {Number(b.valor).toFixed(2)}</span>
                  </div>
                  <div className="item-card-row">
                    <span className="item-card-label">Vencimento</span>
                    <span className="item-card-value" style={isOverdue ? { color: '#dc2626', fontWeight: 600 } : undefined}>
                      {new Date(b.data_vencimento).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  {b.data_pagamento && (
                    <div className="item-card-row">
                      <span className="item-card-label">Pagamento</span>
                      <span className="item-card-value">{new Date(b.data_pagamento).toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                </div>
                <div className="item-card-actions">
                  <button className="btn btn-sm" onClick={() => startEdit(b)}>Editar</button>
                  {b.status !== 'PAGO' && <button className="btn btn-sm btn-success" onClick={() => handlePay(b.id)}>Pagar</button>}
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(b.id)}>Excluir</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
