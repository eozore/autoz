import { useState, useEffect, useMemo, type FormEvent } from 'react';
import api, { ApiError } from '../lib/api';
import SearchableSelect from '../components/SearchableSelect';
import { DetailDrawer } from '../components/DetailDrawer';
import { Modal } from '../design-system/components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

interface Client { id: string; nome: string; }

interface OwnershipHistory {
  id: string;
  client_id: string;
  started_at: string;
  ended_at: string | null;
  client: { id: string; nome: string };
}

interface Vehicle {
  id: string;
  client_id: string;
  marca: string;
  modelo: string;
  ano: number;
  placa: string;
  quilometragem: number | null;
  cor: string | null;
  client?: { id: string; nome: string };
  ownershipHistory?: OwnershipHistory[];
}

const emptyForm = { client_id: '', marca: '', modelo: '', ano: '', placa: '', quilometragem: '', cor: '' };

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);

  // Transfer state
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferClientId, setTransferClientId] = useState('');
  const [transferring, setTransferring] = useState(false);
  const { dialogProps, confirm } = useConfirmDialog();

  async function loadVehicles(cursor?: string, searchTerm?: string) {
    try {
      const params = new URLSearchParams({ limit: '9' });
      if (cursor) params.set('cursor', cursor);
      if (searchTerm) params.set('search', searchTerm);
      const res = await api.get<{ data: Vehicle[]; nextCursor: string | null }>(`/vehicles?${params}`);
      if (cursor) {
        setVehicles(prev => [...prev, ...res.data]);
      } else {
        setVehicles(res.data);
      }
      setNextCursor(res.nextCursor);
    } catch { setError('Erro ao carregar veículos'); }
    finally { setLoading(false); }
  }

  async function loadClients() {
    try {
      const res = await api.get<{ data: Client[] }>('/clients?limit=100');
      setClients(res.data);
    } catch { /* ignore */ }
  }

  async function loadDetail(id: string) {
    setLoadingDetail(true);
    try {
      const v = await api.get<Vehicle>(`/vehicles/${id}`);
      setSelectedVehicle(v);
    } catch { /* ignore */ }
    finally { setLoadingDetail(false); }
  }

  useEffect(() => { loadVehicles(); }, []);

  function handleSearch() {
    setSearch(searchInput);
    setLoading(true);
    loadVehicles(undefined, searchInput);
  }

  function handleSearchKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch();
  }

  async function openCreate() {
    await loadClients();
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
    setSelectedId(null);
    setSelectedVehicle(null);
  }

  async function openEdit(v: Vehicle) {
    await loadClients();
    setEditId(v.id);
    setForm({
      client_id: v.client_id,
      marca: v.marca,
      modelo: v.modelo,
      ano: String(v.ano),
      placa: v.placa,
      quilometragem: v.quilometragem != null ? String(v.quilometragem) : '',
      cor: v.cor || '',
    });
    setShowForm(true);
    setSelectedId(null);
    setSelectedVehicle(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        marca: form.marca,
        modelo: form.modelo,
        ano: parseInt(form.ano),
        placa: form.placa,
        quilometragem: form.quilometragem ? parseInt(form.quilometragem) : null,
        cor: form.cor || null,
      };
      if (editId) {
        await api.put(`/vehicles/${editId}`, body);
      } else {
        body.client_id = form.client_id;
        await api.post('/vehicles', body);
      }
      setShowForm(false);
      setLoading(true);
      await loadVehicles(undefined, search);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar veículo');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    confirm({
      title: 'Confirmar Exclusão',
      description: 'Tem certeza que deseja excluir este veículo?',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/vehicles/${id}`);
          setVehicles(prev => prev.filter(v => v.id !== id));
          if (selectedId === id) { setSelectedId(null); setSelectedVehicle(null); }
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Erro ao excluir');
        }
      },
    });
  }

  async function handleSelectVehicle(id: string) {
    if (selectedId === id) {
      setSelectedId(null);
      setSelectedVehicle(null);
      return;
    }
    setSelectedId(id);
    setShowForm(false);
    await loadDetail(id);
  }

  async function handleTransfer(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setTransferring(true);
    setError('');
    try {
      await api.patch(`/vehicles/${selectedId}/transfer`, { client_id: transferClientId });
      setShowTransfer(false);
      setTransferClientId('');
      await loadDetail(selectedId);
      await loadVehicles(undefined, search);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao transferir veículo');
    } finally { setTransferring(false); }
  }

  function upd(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })); }

  const money = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',');

  if (loading && vehicles.length === 0) return <div className="loading">Carregando...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Veículos</h1>
        <button className="btn btn-primary" onClick={openCreate}>Novo Veículo</button>
      </div>
      {error && <p className="error-msg">{error}</p>}

      <div className="search-bar" style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          className="search-input"
          placeholder="Buscar por placa, marca ou modelo..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={handleSearchKey}
          style={{ flex: 1 }}
        />
        <button className="btn" onClick={handleSearch}>Buscar</button>
      </div>

      {showForm && (
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editId ? 'Editar Veículo' : 'Novo Veículo'}>
              <form onSubmit={handleSubmit}>
                {!editId && (
                  <label>Cliente *
                    <SearchableSelect
                      options={clients.map(c => ({ value: c.id, label: c.nome }))}
                      value={form.client_id}
                      onChange={val => upd('client_id', val)}
                      placeholder="Selecione o cliente..."
                      required
                    />
                  </label>
                )}
                <div className="form-row">
                  <label className="flex-grow">Marca *<input value={form.marca} onChange={e => upd('marca', e.target.value)} required /></label>
                  <label className="flex-grow">Modelo *<input value={form.modelo} onChange={e => upd('modelo', e.target.value)} required /></label>
                </div>
                <div className="form-row">
                  <label className="flex-grow">Ano *<input type="number" value={form.ano} onChange={e => upd('ano', e.target.value)} required min={1900} max={new Date().getFullYear() + 1} /></label>
                  <label className="flex-grow">Placa *<input value={form.placa} onChange={e => upd('placa', e.target.value.toUpperCase())} required /></label>
                </div>
                <div className="form-row">
                  <label className="flex-grow">Cor<input value={form.cor} onChange={e => upd('cor', e.target.value)} placeholder="Ex: Preto, Branco..." /></label>
                  <label className="flex-grow">Quilometragem (km)<input type="number" min={0} value={form.quilometragem} onChange={e => upd('quilometragem', e.target.value)} placeholder="Ex: 45000" /></label>
                </div>
                <div className="form-row">
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
                  <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
                </div>
              </form>
        </Modal>
      )}

      {/* Detail Drawer */}
      <DetailDrawer open={!!selectedId} onClose={() => { setSelectedId(null); setSelectedVehicle(null); setShowTransfer(false); }} title="Detalhes do Veículo">
        {loadingDetail ? (
          <div className="loading" style={{ padding: '1rem' }}>Carregando...</div>
        ) : selectedVehicle ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.88rem' }}>
              <div><strong>Proprietário:</strong> {selectedVehicle.client?.nome || '—'}</div>
              <div><strong>Placa:</strong> {selectedVehicle.placa}</div>
              <div><strong>Marca/Modelo:</strong> {selectedVehicle.marca} {selectedVehicle.modelo}</div>
              <div><strong>Ano:</strong> {selectedVehicle.ano}</div>
              {selectedVehicle.cor && <div><strong>Cor:</strong> {selectedVehicle.cor}</div>}
              {selectedVehicle.quilometragem != null && <div><strong>Quilometragem:</strong> {selectedVehicle.quilometragem.toLocaleString('pt-BR')} km</div>}
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-sm btn-primary" onClick={() => { setShowTransfer(true); loadClients(); }}>Transferir</button>
            </div>

            {showTransfer && (
              <form onSubmit={handleTransfer} style={{ marginTop: '1rem', padding: '0.75rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <strong style={{ fontSize: '0.88rem' }}>Transferir para outro cliente</strong>
                <div className="form-row" style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <SearchableSelect
                      options={clients.filter(c => c.id !== selectedVehicle.client_id).map(c => ({ value: c.id, label: c.nome }))}
                      value={transferClientId}
                      onChange={val => setTransferClientId(val)}
                      placeholder="Selecione o novo proprietário..."
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-sm btn-primary" disabled={transferring}>{transferring ? 'Transferindo...' : 'Confirmar'}</button>
                  <button type="button" className="btn btn-sm" onClick={() => setShowTransfer(false)}>Cancelar</button>
                </div>
              </form>
            )}

            {selectedVehicle.ownershipHistory && selectedVehicle.ownershipHistory.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <strong style={{ fontSize: '0.88rem' }}>Histórico de Proprietários</strong>
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {selectedVehicle.ownershipHistory.map(h => (
                    <div key={h.id} style={{ fontSize: '0.82rem', padding: '0.4rem 0.6rem', background: '#f3f4f6', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>👤 {h.client.nome}</span>
                      <span style={{ color: '#6b7280' }}>
                        {new Date(h.started_at).toLocaleDateString('pt-BR')}
                        {h.ended_at ? ` → ${new Date(h.ended_at).toLocaleDateString('pt-BR')}` : ' → atual'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </DetailDrawer>

      {vehicles.length === 0 && !loading ? (
        <p className="empty">{search ? 'Nenhum veículo encontrado.' : 'Nenhum veículo cadastrado.'}</p>
      ) : (
        <div className="item-cards">
          {vehicles.map(v => (
            <div
              className={`item-card${selectedId === v.id ? ' item-card-selected' : ''}`}
              key={v.id}
              onClick={() => handleSelectVehicle(v.id)}
              style={{ cursor: 'pointer' }}
            >
              <div className="item-card-header">
                <div>
                  <div className="item-card-title">{v.marca} {v.modelo}</div>
                  <div className="item-card-subtitle">🚗 {v.placa} · {v.ano}</div>
                </div>
                {v.cor && <span className="badge badge-blue">{v.cor}</span>}
              </div>
              <div className="item-card-body">
                {v.client && <div>👤 {v.client.nome}</div>}
                {v.quilometragem != null && <div>🛣️ {v.quilometragem.toLocaleString('pt-BR')} km</div>}
              </div>
              <div className="item-card-actions" onClick={e => e.stopPropagation()}>
                <button className="btn btn-sm" onClick={() => openEdit(v)}>Editar</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(v.id)}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {nextCursor && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button className="btn" onClick={() => loadVehicles(nextCursor, search)}>Ver mais</button>
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
