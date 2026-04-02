import { useState, useEffect, useMemo, type FormEvent } from 'react';
import api, { ApiError } from '../lib/api';

interface Appointment {
  id: string;
  client_id: string | null;
  service_id: string;
  location_id: string;
  data_hora: string;
  duracao_minutos: number;
  status: string;
  nome_visitante: string | null;
  celular_visitante: string | null;
  notas: string | null;
  desconto: number | null;
  forma_pagamento: string | null;
  valor_servico: number | null;
  client?: { id: string; nome: string };
  service?: { id: string; nome: string; duracao_minutos?: number; valor?: number };
  location?: { id: string; endereco_rua: string; endereco_numero: string };
}

interface Client { id: string; nome: string; }
interface Service { id: string; nome: string; duracao_minutos: number; valor?: number; }
interface Location { id: string; endereco_rua: string; endereco_numero: string; endereco_cidade: string; }
interface Company { id: string; locations: Location[]; }

const statusBadge: Record<string, string> = {
  AGENDADO: 'badge-blue',
  CONFIRMADO: 'badge-blue',
  EM_ANDAMENTO: 'badge-yellow',
  CONCLUIDO: 'badge-gray',
  CANCELADO: 'badge-red',
};

const statusLabel: Record<string, string> = {
  AGENDADO: 'Agendado',
  CONFIRMADO: 'Agendado',
  EM_ANDAMENTO: 'Em Andamento',
  CONCLUIDO: 'Finalizado',
  CANCELADO: 'Cancelado',
};

const statusFlow: Record<string, string[]> = {
  AGENDADO: ['EM_ANDAMENTO', 'CANCELADO'],
  CONFIRMADO: ['EM_ANDAMENTO', 'CANCELADO'],
  EM_ANDAMENTO: ['CONCLUIDO', 'CANCELADO'],
};

const statusButtonLabel: Record<string, string> = {
  EM_ANDAMENTO: 'Em Andamento',
  CONCLUIDO: 'Finalizar',
  CANCELADO: 'Cancelar',
};

const money = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',');

function todayStr() { return new Date().toISOString().split('T')[0]; }
function weekLaterStr() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

type StatusFilter = 'TODOS' | 'AGENDADO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';

interface FormState {
  client_id: string;
  service_id: string;
  location_id: string;
  data_hora: string;
  notas: string;
  valor_servico: string;
  desconto: string;
  forma_pagamento: string;
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(weekLaterStr());
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('TODOS');

  // Create/Edit form
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [visibleCount, setVisibleCount] = useState(9);
  const [form, setForm] = useState<FormState>({
    client_id: '', service_id: '', location_id: '', data_hora: '',
    notas: '', valor_servico: '', desconto: '', forma_pagamento: '',
  });

  const filtered = useMemo(() => {
    let result = appointments;

    // Status filter (AGENDADO includes CONFIRMADO)
    if (statusFilter === 'AGENDADO') {
      result = result.filter(a => a.status === 'AGENDADO' || a.status === 'CONFIRMADO');
    } else if (statusFilter !== 'TODOS') {
      result = result.filter(a => a.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        (a.client?.nome || a.nome_visitante || '').toLowerCase().includes(q) ||
        (a.service?.nome || '').toLowerCase().includes(q) ||
        (a.notas || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [appointments, search, statusFilter]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return appointments.find(a => a.id === selectedId) || null;
  }, [appointments, selectedId]);

  async function loadAppointments() {
    setLoading(true);
    try {
      const params = `?start=${startDate}T00:00:00&end=${endDate}T23:59:59`;
      const data = await api.get<Appointment[]>(`/appointments${params}`);
      setAppointments(data);
    } catch { setError('Erro ao carregar agendamentos'); }
    finally { setLoading(false); }
  }

  async function loadFormData() {
    try {
      const [clientRes, serviceRes, companyRes] = await Promise.all([
        api.get<{ data: Client[] }>('/clients?limit=100'),
        api.get<Service[]>('/services'),
        api.get<Company>('/companies/me'),
      ]);
      setClients(clientRes.data);
      setServices(serviceRes);
      setLocations(companyRes.locations || []);
    } catch { /* ignore */ }
  }

  useEffect(() => { loadAppointments(); }, []);

  function handleFilter() { setVisibleCount(9); loadAppointments(); }

  async function openCreateForm() {
    await loadFormData();
    setEditId(null);
    setForm({
      client_id: '', service_id: '', location_id: '', data_hora: '',
      notas: '', valor_servico: '', desconto: '', forma_pagamento: '',
    });
    setShowForm(true);
  }

  async function openEditForm(a: Appointment) {
    await loadFormData();
    setEditId(a.id);
    const dtLocal = a.data_hora ? new Date(a.data_hora).toISOString().slice(0, 16) : '';
    setForm({
      client_id: a.client_id || '',
      service_id: a.service_id,
      location_id: a.location_id,
      data_hora: dtLocal,
      notas: a.notas || '',
      valor_servico: a.valor_servico != null ? String(Number(a.valor_servico)) : '',
      desconto: a.desconto != null ? String(Number(a.desconto)) : '',
      forma_pagamento: a.forma_pagamento || '',
    });
    setShowForm(true);
  }

  function handleServiceChange(serviceId: string) {
    const svc = services.find(s => s.id === serviceId);
    setForm(prev => ({
      ...prev,
      service_id: serviceId,
      valor_servico: svc?.valor ? String(Number(svc.valor)) : prev.valor_servico,
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const selectedService = services.find(s => s.id === form.service_id);
      if (editId) {
        const body = {
          valor_servico: form.valor_servico ? parseFloat(form.valor_servico) : null,
          desconto: form.desconto ? parseFloat(form.desconto) : null,
          forma_pagamento: form.forma_pagamento || null,
          notas: form.notas || null,
        };
        await api.put(`/appointments/${editId}`, body);
      } else {
        const body = {
          client_id: form.client_id || undefined,
          service_id: form.service_id,
          location_id: form.location_id,
          data_hora: new Date(form.data_hora).toISOString(),
          duracao_minutos: selectedService?.duracao_minutos || 60,
          notas: form.notas || undefined,
          valor_servico: form.valor_servico ? parseFloat(form.valor_servico) : undefined,
          desconto: form.desconto ? parseFloat(form.desconto) : undefined,
          forma_pagamento: form.forma_pagamento || undefined,
        };
        await api.post('/appointments', body);
      }
      setShowForm(false);
      setEditId(null);
      await loadAppointments();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : editId ? 'Erro ao atualizar agendamento' : 'Erro ao criar agendamento');
    } finally { setSaving(false); }
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancelar este agendamento?')) return;
    try {
      await api.patch(`/appointments/${id}/cancel`);
      await loadAppointments();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cancelar');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este agendamento permanentemente?')) return;
    try {
      await api.delete(`/appointments/${id}`);
      setSelectedId(null);
      await loadAppointments();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir');
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      await api.patch(`/appointments/${id}/status`, { status: newStatus });
      await loadAppointments();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar status');
    }
  }

  function upd(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })); }

  function valorFinal(a: Appointment): number {
    const v = Number(a.valor_servico) || 0;
    const d = Number(a.desconto) || 0;
    return v - d;
  }

  const pagamentoLabel: Record<string, string> = {
    A_VISTA: 'À Vista',
    PARCELADO: 'Parcelado',
  };

  const filterOptions: { key: StatusFilter; label: string }[] = [
    { key: 'TODOS', label: 'Todos' },
    { key: 'AGENDADO', label: 'Agendado' },
    { key: 'EM_ANDAMENTO', label: 'Em Andamento' },
    { key: 'CONCLUIDO', label: 'Finalizado' },
    { key: 'CANCELADO', label: 'Cancelado' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Agendamentos</h1>
        <button className="btn btn-primary" onClick={openCreateForm}>Novo Agendamento</button>
      </div>
      {error && <p className="error-msg">{error}</p>}

      <div className="filter-row">
        <label>De:<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
        <label>Até:<input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
        <button className="btn" onClick={handleFilter}>Filtrar</button>
      </div>

      <div className="filter-pills">
        {filterOptions.map(opt => (
          <button
            key={opt.key}
            className={`filter-pill${statusFilter === opt.key ? ' active' : ''}${opt.key === 'CANCELADO' ? ' danger' : ''}`}
            onClick={() => { setStatusFilter(opt.key); setVisibleCount(9); }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="search-bar">
        <input className="search-input" placeholder="Buscar por cliente, serviço ou notas..." value={search} onChange={e => { setSearch(e.target.value); setVisibleCount(9); }} />
      </div>

      {showForm && (
        <div className="form-panel">
          <h2>{editId ? 'Editar Agendamento' : 'Novo Agendamento'}</h2>
          <form onSubmit={handleSubmit}>
            {!editId && (
              <>
                <div className="form-row">
                  <label className="flex-grow">Cliente
                    <select value={form.client_id} onChange={e => upd('client_id', e.target.value)}>
                      <option value="">Nenhum (visitante)</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </label>
                  <label className="flex-grow">Serviço *
                    <select value={form.service_id} onChange={e => handleServiceChange(e.target.value)} required>
                      <option value="">Selecione...</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.nome} ({s.duracao_minutos}min){s.valor ? ` - R${Number(s.valor).toFixed(2)}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="form-row">
                  <label className="flex-grow">Localização *
                    <select value={form.location_id} onChange={e => upd('location_id', e.target.value)} required>
                      <option value="">Selecione...</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.endereco_rua}, {l.endereco_numero} - {l.endereco_cidade}</option>)}
                    </select>
                  </label>
                  <label className="flex-grow">Data e Hora *
                    <input type="datetime-local" value={form.data_hora} onChange={e => upd('data_hora', e.target.value)} required />
                  </label>
                </div>
              </>
            )}
            <div className="form-row">
              <label className="flex-grow">Valor do Serviço (R$)
                <input type="number" step="0.01" min="0" value={form.valor_servico} onChange={e => upd('valor_servico', e.target.value)} placeholder="0.00" />
              </label>
              <label className="flex-grow">Desconto (R$)
                <input type="number" step="0.01" min="0" value={form.desconto} onChange={e => upd('desconto', e.target.value)} placeholder="0.00" />
              </label>
              <label className="flex-grow">Forma de Pagamento
                <select value={form.forma_pagamento} onChange={e => upd('forma_pagamento', e.target.value)}>
                  <option value="">Selecione...</option>
                  <option value="A_VISTA">À Vista</option>
                  <option value="PARCELADO">Parcelado</option>
                </select>
              </label>
            </div>
            <label>Notas<input value={form.notas} onChange={e => upd('notas', e.target.value)} /></label>
            <div className="form-row">
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : editId ? 'Salvar' : 'Criar'}</button>
              <button type="button" className="btn" onClick={() => { setShowForm(false); setEditId(null); }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="form-panel" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h2>Detalhes do Agendamento</h2>
            <button className="btn btn-sm" onClick={() => setSelectedId(null)}>✕ Fechar</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem', fontSize: '0.88rem' }}>
            <div><strong>Cliente:</strong> {selected.client?.nome || selected.nome_visitante || '—'}</div>
            <div><strong>Serviço:</strong> {selected.service?.nome || '—'}</div>
            <div><strong>Local:</strong> {selected.location ? `${selected.location.endereco_rua}, ${selected.location.endereco_numero}` : '—'}</div>
            <div><strong>Data/Hora:</strong> {new Date(selected.data_hora).toLocaleString('pt-BR')}</div>
            <div><strong>Duração:</strong> {selected.duracao_minutos} min</div>
            <div><strong>Status:</strong> <span className={`badge ${statusBadge[selected.status] || 'badge-gray'}`}>{statusLabel[selected.status] || selected.status}</span></div>
            <div><strong>Valor Serviço:</strong> {selected.valor_servico != null ? money(Number(selected.valor_servico)) : '—'}</div>
            <div><strong>Desconto:</strong> {selected.desconto != null ? money(Number(selected.desconto)) : '—'}</div>
            <div><strong>Valor Final:</strong> {selected.valor_servico != null ? money(valorFinal(selected)) : '—'}</div>
            <div><strong>Pagamento:</strong> {selected.forma_pagamento ? (pagamentoLabel[selected.forma_pagamento] || selected.forma_pagamento) : '—'}</div>
          </div>
          {selected.notas && <div style={{ marginTop: '0.5rem', fontSize: '0.88rem' }}><strong>Notas:</strong> {selected.notas}</div>}
        </div>
      )}

      {loading ? (
        <div className="loading">Carregando...</div>
      ) : filtered.length === 0 ? (
        <p className="empty">{search || statusFilter !== 'TODOS' ? 'Nenhum agendamento encontrado.' : 'Nenhum agendamento no período.'}</p>
      ) : (
        <div className="item-cards">
          {filtered.slice(0, visibleCount).map(a => (
            <div className="item-card" key={a.id} onClick={() => setSelectedId(a.id === selectedId ? null : a.id)} style={{ cursor: 'pointer' }}>
              <div className="item-card-header">
                <div>
                  <div className="item-card-title">{new Date(a.data_hora).toLocaleString('pt-BR')}</div>
                  <div className="item-card-subtitle">{a.duracao_minutos} min</div>
                </div>
                <span className={`badge ${statusBadge[a.status] || 'badge-gray'}`}>{statusLabel[a.status] || a.status}</span>
              </div>
              <div className="item-card-body">
                <div><strong>{a.service?.nome || '—'}</strong></div>
                <div>👤 {a.client?.nome || a.nome_visitante || '—'}</div>
                {a.location && <div>📍 {a.location.endereco_rua}, {a.location.endereco_numero}</div>}
                {a.valor_servico != null && (
                  <div style={{ marginTop: '0.35rem' }}>
                    💰 {money(Number(a.valor_servico))}
                    {a.desconto != null && Number(a.desconto) > 0 && (
                      <span style={{ color: '#16a34a', marginLeft: '0.5rem' }}>(-{money(Number(a.desconto))})</span>
                    )}
                    <strong style={{ marginLeft: '0.5rem' }}>= {money(valorFinal(a))}</strong>
                  </div>
                )}
                {a.forma_pagamento && (
                  <span className={`badge ${a.forma_pagamento === 'A_VISTA' ? 'badge-green' : 'badge-yellow'}`} style={{ marginTop: '0.35rem' }}>
                    {pagamentoLabel[a.forma_pagamento] || a.forma_pagamento}
                  </span>
                )}
              </div>
              {a.notas && (
                <div className="item-card-meta"><span>📝 {a.notas}</span></div>
              )}
              <div className="item-card-actions" onClick={e => e.stopPropagation()}>
                <button className="btn btn-sm" onClick={() => openEditForm(a)}>Editar</button>
                {statusFlow[a.status]?.map(next => (
                  <button
                    key={next}
                    className={`btn btn-sm ${next === 'CANCELADO' ? 'btn-danger' : 'btn-success'}`}
                    onClick={() => next === 'CANCELADO' ? handleCancel(a.id) : handleStatusChange(a.id, next)}
                  >
                    {statusButtonLabel[next] || next}
                  </button>
                ))}
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(a.id)}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && visibleCount < filtered.length && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button className="btn" onClick={() => setVisibleCount(v => v + 9)}>Ver mais</button>
        </div>
      )}
    </div>
  );
}
