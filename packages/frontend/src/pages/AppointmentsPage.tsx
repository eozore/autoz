import { useState, useEffect, useMemo, type FormEvent } from 'react';
import api, { ApiError } from '../lib/api';
import SearchableSelect from '../components/SearchableSelect';
import SearchableMultiSelect from '../components/SearchableMultiSelect';
import { DetailDrawer } from '../components/DetailDrawer';
import { Modal } from '../design-system/components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { StatusBadge, type AppointmentStatus } from '../components/StatusBadge';

interface Appointment {
  id: string;
  client_id: string | null;
  service_id: string | null;
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
  vehicle_id: string | null;
  quilometragem: number | null;
  client?: { id: string; nome: string };
  service?: { id: string; nome: string; duracao_minutos?: number; valor?: number } | null;
  location?: { id: string; endereco_rua: string; endereco_numero: string };
  appointmentServices?: { id: string; service_id: string; service: { id: string; nome: string } }[];
  vehicle?: { id: string; marca: string; modelo: string; placa: string; cor: string | null } | null;
}

interface Client { id: string; nome: string; }
interface Service { id: string; nome: string; duracao_minutos: number; valor?: number; }
interface Location { id: string; endereco_rua: string; endereco_numero: string; endereco_cidade: string; }
interface Company { id: string; locations: Location[]; }
interface Vehicle { id: string; client_id?: string | null; marca: string; modelo: string; placa: string; cor: string | null; }

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

function defaultStartStr() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}
function defaultEndStr() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

type StatusFilter = 'TODOS' | 'AGENDADO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';

interface FormState {
  client_id: string;
  service_ids: string[];
  location_id: string;
  data_hora: string;
  notas: string;
  valor_servico: string;
  desconto: string;
  forma_pagamento: string;
  vehicle_id: string;
  quilometragem: string;
}

function getServiceNames(a: Appointment): string {
  if (a.appointmentServices && a.appointmentServices.length > 0) {
    return a.appointmentServices.map(as => as.service.nome).join(', ');
  }
  return a.service?.nome || '—';
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState(defaultStartStr());
  const [endDate, setEndDate] = useState(defaultEndStr());
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('TODOS');
  const { dialogProps, confirm } = useConfirmDialog();

  // Create/Edit form
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [form, setForm] = useState<FormState>({
    client_id: '', service_ids: [], location_id: '', data_hora: '',
    notas: '', valor_servico: '', desconto: '', forma_pagamento: '',
    vehicle_id: '', quilometragem: '',
  });
  const filteredVehicles = useMemo(() => {
    if (!form.client_id) return vehicles;
    return vehicles.filter(v => v.client_id === form.client_id);
  }, [vehicles, form.client_id]);

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
        getServiceNames(a).toLowerCase().includes(q) ||
        (a.notas || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [appointments, search, statusFilter]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return appointments.find(a => a.id === selectedId) || null;
  }, [appointments, selectedId]);

  // Derived: selected vehicle details for form
  const selectedFormVehicle = useMemo(() => {
    if (!form.vehicle_id) return null;
    return vehicles.find(v => v.id === form.vehicle_id) || null;
  }, [form.vehicle_id, vehicles]);

  // Derived: total duration from selected services
  const totalDuration = useMemo(() => {
    return form.service_ids.reduce((sum, id) => {
      const svc = services.find(s => s.id === id);
      return sum + (svc?.duracao_minutos || 0);
    }, 0);
  }, [form.service_ids, services]);

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
      const [clientRes, serviceRes, companyRes, vehicleRes] = await Promise.all([
        api.get<{ data: Client[] }>('/clients?limit=100'),
        api.get<Service[]>('/services'),
        api.get<Company>('/companies/me'),
        api.get<{ data: Vehicle[] }>('/vehicles?limit=100'),
      ]);
      setClients(clientRes.data);
      setServices(serviceRes);
      setLocations(companyRes.locations || []);
      setVehicles(vehicleRes.data);
    } catch { /* ignore */ }
  }

  useEffect(() => { loadAppointments(); }, []);

  function handleFilter() { loadAppointments(); }

  async function openCreateForm() {
    await loadFormData();
    setEditId(null);
    setForm({
      client_id: '', service_ids: [], location_id: '', data_hora: '',
      notas: '', valor_servico: '', desconto: '', forma_pagamento: '',
      vehicle_id: '', quilometragem: '',
    });
    setShowForm(true);
  }

  async function openEditForm(a: Appointment) {
    await loadFormData();
    setEditId(a.id);
    const dtLocal = a.data_hora ? new Date(a.data_hora).toISOString().slice(0, 16) : '';
    // Collect service_ids from appointmentServices or fallback to service_id
    const serviceIds = a.appointmentServices && a.appointmentServices.length > 0
      ? a.appointmentServices.map(as => as.service_id)
      : (a.service_id ? [a.service_id] : []);
    setForm({
      client_id: a.client_id || '',
      service_ids: serviceIds,
      location_id: a.location_id,
      data_hora: dtLocal,
      notas: a.notas || '',
      valor_servico: a.valor_servico != null ? String(Number(a.valor_servico)) : '',
      desconto: a.desconto != null ? String(Number(a.desconto)) : '',
      forma_pagamento: a.forma_pagamento || '',
      vehicle_id: a.vehicle_id || '',
      quilometragem: a.quilometragem != null ? String(a.quilometragem) : '',
    });
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editId) {
        const body: Record<string, unknown> = {
          valor_servico: form.valor_servico ? parseFloat(form.valor_servico) : null,
          desconto: form.desconto ? parseFloat(form.desconto) : null,
          forma_pagamento: form.forma_pagamento || null,
          notas: form.notas || null,
          service_ids: form.service_ids.length > 0 ? form.service_ids : undefined,
          vehicle_id: form.vehicle_id || null,
          quilometragem: form.quilometragem ? parseInt(form.quilometragem) : null,
        };
        await api.put(`/appointments/${editId}`, body);
      } else {
        const body: Record<string, unknown> = {
          client_id: form.client_id || undefined,
          service_ids: form.service_ids,
          location_id: form.location_id,
          data_hora: new Date(form.data_hora).toISOString(),
          duracao_minutos: totalDuration || 60,
          notas: form.notas || undefined,
          valor_servico: form.valor_servico ? parseFloat(form.valor_servico) : undefined,
          desconto: form.desconto ? parseFloat(form.desconto) : undefined,
          forma_pagamento: form.forma_pagamento || undefined,
          vehicle_id: form.vehicle_id || undefined,
          quilometragem: form.quilometragem ? parseInt(form.quilometragem) : undefined,
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
    confirm({
      title: 'Cancelar Agendamento',
      description: 'Tem certeza que deseja cancelar este agendamento?',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.patch(`/appointments/${id}/cancel`);
          await loadAppointments();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Erro ao cancelar');
        }
      },
    });
  }

  async function handleDelete(id: string) {
    confirm({
      title: 'Confirmar Exclusão',
      description: 'Excluir este agendamento permanentemente?',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/appointments/${id}`);
          setSelectedId(null);
          await loadAppointments();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Erro ao excluir');
        }
      },
    });
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
            onClick={() => { setStatusFilter(opt.key); }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="search-bar">
        <input className="search-input" placeholder="Buscar por cliente, serviço ou notas..." value={search} onChange={e => { setSearch(e.target.value); }} />
      </div>

      {showForm && (
        <Modal open={showForm} onClose={() => { setShowForm(false); setEditId(null); }} title={editId ? 'Editar Agendamento' : 'Novo Agendamento'}>
              <form onSubmit={handleSubmit}>
                {!editId && (
                  <>
                    <div className="form-row">
                      <label className="flex-grow">Cliente
                        <SearchableSelect
                          options={[
                            { value: '', label: 'Nenhum (visitante)' },
                            ...clients.map(c => ({ value: c.id, label: c.nome }))
                          ]}
                          value={form.client_id}
                          onChange={val => upd('client_id', val)}
                          placeholder="Selecione o cliente..."
                        />
                      </label>
                      <label className="flex-grow">Localização *
                        <SearchableSelect
                          options={locations.map(l => ({ value: l.id, label: `${l.endereco_rua}, ${l.endereco_numero} - ${l.endereco_cidade}` }))}
                          value={form.location_id}
                          onChange={val => upd('location_id', val)}
                          placeholder="Selecione a loja..."
                          required
                        />
                      </label>
                    </div>
                    <label className="flex-grow">Data e Hora *
                      <input type="datetime-local" value={form.data_hora} onChange={e => upd('data_hora', e.target.value)} required />
                    </label>
                  </>
                )}

                {/* Multi-select service dropdown */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
                    Serviços {!editId && '*'}
                    {form.service_ids.length > 0 && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#2563eb', fontWeight: 400 }}>
                        ({form.service_ids.length} selecionado{form.service_ids.length > 1 ? 's' : ''}{totalDuration > 0 ? ` · ${totalDuration} min` : ''})
                      </span>
                    )}
                  </label>
                  <SearchableMultiSelect
                    options={services.map(s => ({
                      value: s.id,
                      label: s.nome,
                      meta: `${s.duracao_minutos} min${s.valor ? ` · R$ ${Number(s.valor).toFixed(2)}` : ''}`,
                    }))}
                    value={form.service_ids}
                    onChange={(ids) => setForm(prev => ({ ...prev, service_ids: ids }))}
                    placeholder="Selecione os serviços..."
                    required={!editId}
                  />
                </div>

                {/* Vehicle field */}
                <div className="form-row">
                  <label className="flex-grow">Veículo
                    <SearchableSelect
                      options={[
                        { value: '', label: 'Nenhum' },
                        ...filteredVehicles.map(v => ({ value: v.id, label: `${v.marca} ${v.modelo} · ${v.placa}${v.cor ? ` · ${v.cor}` : ''}` }))
                      ]}
                      value={form.vehicle_id || ''}
                      onChange={val => upd('vehicle_id', val)}
                      placeholder="Selecione o veículo..."
                    />
                  </label>
                  <label className="flex-grow">Quilometragem (km)
                    <input
                      type="number"
                      min={0}
                      value={form.quilometragem}
                      onChange={e => upd('quilometragem', e.target.value)}
                      disabled={!form.vehicle_id}
                      placeholder={form.vehicle_id ? 'Ex: 45000' : '—'}
                    />
                  </label>
                </div>
                {selectedFormVehicle && (
                  <div style={{ fontSize: '0.82rem', color: '#4b5563', marginBottom: '0.5rem', padding: '0.4rem 0.6rem', background: '#f3f4f6', borderRadius: '6px' }}>
                    🚗 {selectedFormVehicle.marca} {selectedFormVehicle.modelo} · {selectedFormVehicle.placa}{selectedFormVehicle.cor ? ` · ${selectedFormVehicle.cor}` : ''}
                  </div>
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
        </Modal>
      )}

      {/* Detail Drawer */}
      <DetailDrawer open={!!selected} onClose={() => setSelectedId(null)} title="Detalhes do Agendamento">
        {selected && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.88rem' }}>
              <div><strong>Cliente:</strong> {selected.client?.nome || selected.nome_visitante || '—'}</div>
              <div><strong>Serviço(s):</strong> {getServiceNames(selected)}</div>
              <div><strong>Local:</strong> {selected.location ? `${selected.location.endereco_rua}, ${selected.location.endereco_numero}` : '—'}</div>
              <div><strong>Data/Hora:</strong> {new Date(selected.data_hora).toLocaleString('pt-BR')}</div>
              <div><strong>Duração:</strong> {selected.duracao_minutos} min</div>
              <div><strong>Status:</strong> <StatusBadge status={selected.status as AppointmentStatus} /></div>
              <div><strong>Valor Serviço:</strong> {selected.valor_servico != null ? money(Number(selected.valor_servico)) : '—'}</div>
              <div><strong>Desconto:</strong> {selected.desconto != null ? money(Number(selected.desconto)) : '—'}</div>
              <div><strong>Valor Final:</strong> {selected.valor_servico != null ? money(valorFinal(selected)) : '—'}</div>
              <div><strong>Pagamento:</strong> {selected.forma_pagamento ? (pagamentoLabel[selected.forma_pagamento] || selected.forma_pagamento) : '—'}</div>
              {selected.vehicle && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <strong>Veículo:</strong> 🚗 {selected.vehicle.marca} {selected.vehicle.modelo} · {selected.vehicle.placa}{selected.vehicle.cor ? ` · ${selected.vehicle.cor}` : ''}
                  {selected.quilometragem != null && ` · ${selected.quilometragem.toLocaleString('pt-BR')} km`}
                </div>
              )}
            </div>
            {selected.notas && <div style={{ marginTop: '0.75rem', fontSize: '0.88rem' }}><strong>Notas:</strong> {selected.notas}</div>}
            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-sm" onClick={() => openEditForm(selected)}>Editar</button>
              {statusFlow[selected.status]?.map(next => (
                <button
                  key={next}
                  className={`btn btn-sm ${next === 'CANCELADO' ? 'btn-danger' : 'btn-success'}`}
                  onClick={() => next === 'CANCELADO' ? handleCancel(selected.id) : handleStatusChange(selected.id, next)}
                >
                  {statusButtonLabel[next] || next}
                </button>
              ))}
              <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selected.id)}>Excluir</button>
            </div>
          </>
        )}
      </DetailDrawer>

      {loading ? (
        <div className="loading">Carregando...</div>
      ) : filtered.length === 0 ? (
        <p className="empty">{search || statusFilter !== 'TODOS' ? 'Nenhum agendamento encontrado.' : 'Nenhum agendamento no período.'}</p>
      ) : (
        <div className="item-cards">
          {filtered.map(a => (
            <div className="item-card" key={a.id} onClick={() => setSelectedId(a.id === selectedId ? null : a.id)} style={{ cursor: 'pointer' }}>
              <div className="item-card-header">
                <div>
                  <div className="item-card-title">{new Date(a.data_hora).toLocaleString('pt-BR')}</div>
                  <div className="item-card-subtitle">{a.duracao_minutos} min</div>
                </div>
                <StatusBadge status={a.status as AppointmentStatus} />
              </div>
              <div className="item-card-body">
                <div><strong>{getServiceNames(a)}</strong></div>
                <div>👤 {a.client?.nome || a.nome_visitante || '—'}</div>
                {a.vehicle && (
                  <div>🚗 {a.vehicle.marca} {a.vehicle.modelo} · {a.vehicle.placa}{a.vehicle.cor ? ` · ${a.vehicle.cor}` : ''}</div>
                )}
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

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
