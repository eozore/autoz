import { useState, useEffect, useMemo, type FormEvent } from 'react';
import api, { ApiError } from '../lib/api';

interface Client {
  id: string;
  nome: string;
  email: string | null;
  celular: string;
  data_nascimento: string | null;
  _count?: { vehicles: number };
}

interface Vehicle {
  id: string;
  client_id: string;
  marca: string;
  modelo: string;
  ano: number;
  placa: string;
  cor: string | null;
  quilometragem: number | null;
}

const emptyClient = { nome: '', email: '', celular: '', data_nascimento: '' };
const emptyVehicle = { marca: '', modelo: '', ano: '', placa: '', cor: '', quilometragem: '' };

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyClient);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Vehicle state
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Record<string, Vehicle[]>>({});
  const [vForm, setVForm] = useState(emptyVehicle);
  const [vEditId, setVEditId] = useState<string | null>(null);
  const [showVForm, setShowVForm] = useState(false);
  const [vSaving, setVSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c =>
      c.nome.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      c.celular.toLowerCase().includes(q)
    );
  }, [clients, search]);

  async function loadClients(cursor?: string) {
    try {
      const url = cursor ? `/clients?limit=9&cursor=${cursor}` : '/clients?limit=9';
      const res = await api.get<{ data: Client[]; nextCursor: string | null }>(url);
      if (cursor) {
        setClients(prev => [...prev, ...res.data]);
      } else {
        setClients(res.data);
      }
      setNextCursor(res.nextCursor);
    } catch { setError('Erro ao carregar clientes'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadClients(); }, []);

  async function loadVehicles(clientId: string) {
    try {
      const data = await api.get<Vehicle[]>(`/clients/${clientId}/vehicles`);
      setVehicles(prev => ({ ...prev, [clientId]: data }));
    } catch { /* ignore */ }
  }

  function toggleExpand(clientId: string) {
    if (expandedClient === clientId) {
      setExpandedClient(null);
      setShowVForm(false);
    } else {
      setExpandedClient(clientId);
      setShowVForm(false);
      setVEditId(null);
      if (!vehicles[clientId]) loadVehicles(clientId);
    }
  }

  function startCreate() {
    setEditId(null);
    setForm(emptyClient);
    setShowForm(true);
  }

  function startEdit(c: Client) {
    setEditId(c.id);
    setForm({
      nome: c.nome, email: c.email || '', celular: c.celular,
      data_nascimento: c.data_nascimento ? c.data_nascimento.split('T')[0] : '',
    });
    setShowForm(true);
    // Expand vehicles section when editing
    setExpandedClient(c.id);
    if (!vehicles[c.id]) loadVehicles(c.id);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        nome: form.nome, celular: form.celular,
        email: form.email || undefined,
        data_nascimento: form.data_nascimento || undefined,
      };
      if (editId) {
        await api.put(`/clients/${editId}`, body);
      } else {
        await api.post('/clients', body);
      }
      setShowForm(false);
      setLoading(true);
      await loadClients();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este cliente?')) return;
    try {
      await api.delete(`/clients/${id}`);
      setClients(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir');
    }
  }

  // Vehicle handlers
  function startVCreate() {
    setVEditId(null);
    setVForm(emptyVehicle);
    setShowVForm(true);
  }

  function startVEdit(v: Vehicle) {
    setVEditId(v.id);
    setVForm({ marca: v.marca, modelo: v.modelo, ano: String(v.ano), placa: v.placa, cor: v.cor || '', quilometragem: v.quilometragem != null ? String(v.quilometragem) : '' });
    setShowVForm(true);
  }

  async function handleVSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setVSaving(true);
    try {
      const body = { marca: vForm.marca, modelo: vForm.modelo, ano: parseInt(vForm.ano), placa: vForm.placa, cor: vForm.cor || null, quilometragem: vForm.quilometragem ? parseInt(vForm.quilometragem) : null };
      if (vEditId) {
        await api.put(`/vehicles/${vEditId}`, body);
      } else {
        await api.post(`/clients/${expandedClient}/vehicles`, body);
      }
      setShowVForm(false);
      await loadVehicles(expandedClient!);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar veículo');
    } finally { setVSaving(false); }
  }

  async function handleVDelete(vId: string) {
    if (!confirm('Excluir este veículo?')) return;
    try {
      await api.delete(`/vehicles/${vId}`);
      await loadVehicles(expandedClient!);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir veículo');
    }
  }

  function upd(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })); }

  function renderVehiclesSection(clientId: string, clientName: string) {
    return (
      <div className="vehicles-section" style={{ marginTop: '0.75rem', padding: '0.85rem', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
          <strong style={{ fontSize: '0.85rem' }}>Veículos de {clientName}</strong>
          <button className="btn btn-sm btn-primary" onClick={startVCreate}>Novo Veículo</button>
        </div>
        {showVForm && (
          <form onSubmit={handleVSubmit} style={{ marginBottom: '0.75rem', padding: '0.75rem', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden', boxSizing: 'border-box', width: '100%' }}>
            <div className="vehicle-form-grid">
              <label>Marca *<input value={vForm.marca} onChange={e => setVForm(p => ({ ...p, marca: e.target.value }))} required /></label>
              <label>Modelo *<input value={vForm.modelo} onChange={e => setVForm(p => ({ ...p, modelo: e.target.value }))} required /></label>
              <label>Ano *<input type="number" value={vForm.ano} onChange={e => setVForm(p => ({ ...p, ano: e.target.value }))} required /></label>
              <label>Placa *<input value={vForm.placa} onChange={e => setVForm(p => ({ ...p, placa: e.target.value }))} required /></label>
              <label>Cor<input value={vForm.cor} onChange={e => setVForm(p => ({ ...p, cor: e.target.value }))} placeholder="Ex: Preto, Branco..." /></label>
              <label>Quilometragem (km)<input type="number" min={0} value={vForm.quilometragem} onChange={e => setVForm(p => ({ ...p, quilometragem: e.target.value }))} placeholder="Ex: 45000" /></label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem' }}>
              <button type="submit" className="btn btn-sm btn-primary" disabled={vSaving}>{vSaving ? 'Salvando...' : 'Salvar'}</button>
              <button type="button" className="btn btn-sm" onClick={() => setShowVForm(false)}>Cancelar</button>
            </div>
          </form>
        )}
        {(vehicles[clientId] || []).length === 0 ? (
          <p className="empty" style={{ padding: '0.5rem', fontSize: '0.82rem' }}>Nenhum veículo.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(vehicles[clientId] || []).map(v => (
              <div key={v.id} className="vehicle-sub-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{v.marca} {v.modelo}</div>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>Ano: {v.ano} · Placa: {v.placa}{v.cor ? ` · ${v.cor}` : ''}{v.quilometragem != null ? ` · ${v.quilometragem.toLocaleString('pt-BR')} km` : ''}</div>
                  </div>
                  <div className="row-actions">
                    <button className="btn btn-sm" onClick={() => startVEdit(v)}>Editar</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleVDelete(v.id)}>Excluir</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (loading) return <div className="loading">Carregando...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Clientes</h1>
        <button className="btn btn-primary" onClick={startCreate}>Novo Cliente</button>
      </div>
      {error && <p className="error-msg">{error}</p>}

      <div className="search-bar">
        <input className="search-input" placeholder="Buscar por nome, email ou celular..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {showForm && (
        <div className="form-panel">
          <h2>{editId ? 'Editar Cliente' : 'Novo Cliente'}</h2>
          <form onSubmit={handleSubmit}>
            <label>Nome *<input value={form.nome} onChange={e => upd('nome', e.target.value)} required /></label>
            <div className="form-row">
              <label className="flex-grow">Email<input type="email" value={form.email} onChange={e => upd('email', e.target.value)} /></label>
              <label className="flex-grow">Celular *<input value={form.celular} onChange={e => upd('celular', e.target.value)} required placeholder="+5511999999999" /></label>
            </div>
            <label>Data de Nascimento<input type="date" value={form.data_nascimento} onChange={e => upd('data_nascimento', e.target.value)} /></label>
            <div className="form-row">
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
          {/* Show vehicles section below client edit form */}
          {editId && expandedClient === editId && renderVehiclesSection(editId, form.nome)}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="empty">{search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'}</p>
      ) : (
        <div className="item-cards">
          {filtered.map(c => (
            <div className="item-card" key={c.id}>
              <div className="item-card-header">
                <div>
                  <div className="item-card-title">{c.nome}</div>
                  {c.email && <div className="item-card-subtitle">✉️ {c.email}</div>}
                </div>
                {c._count?.vehicles != null && (
                  <span className="badge badge-blue">{c._count.vehicles} veíc.</span>
                )}
              </div>
              <div className="item-card-body">
                <div>📱 {c.celular}</div>
                {c.data_nascimento && <div>🎂 {new Date(c.data_nascimento).toLocaleDateString('pt-BR')}</div>}
              </div>

              {/* Expandable vehicles section */}
              <div style={{ marginTop: '0.5rem' }}>
                <button className="btn btn-sm" onClick={() => toggleExpand(c.id)} style={{ width: '100%', textAlign: 'left' }}>
                  {expandedClient === c.id ? '▼' : '▶'} Veículos
                </button>
                {expandedClient === c.id && !(showForm && editId === c.id) && renderVehiclesSection(c.id, c.nome)}
              </div>

              <div className="item-card-actions">
                <button className="btn btn-sm" onClick={() => startEdit(c)}>Editar</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c.id)}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {nextCursor && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button className="btn" onClick={() => loadClients(nextCursor)}>Ver mais</button>
        </div>
      )}
    </div>
  );
}
