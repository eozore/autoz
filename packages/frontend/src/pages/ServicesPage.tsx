import { useState, useEffect, useMemo, type FormEvent } from 'react';
import api, { ApiError, uploadFile } from '../lib/api';

interface Service {
  id: string;
  nome: string;
  descricao: string | null;
  foto_url: string | null;
  duracao_minutos: number;
  valor: number | null;
  ativo: boolean;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const emptyForm = { nome: '', descricao: '', duracao_minutos: '60', valor: '', ativo: true };

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(9);

  const filtered = useMemo(() => {
    if (!search.trim()) return services;
    const q = search.toLowerCase();
    return services.filter(s => s.nome.toLowerCase().includes(q));
  }, [services, search]);

  async function load() {
    try {
      const data = await api.get<Service[]>('/services');
      setServices(data);
    } catch { setError('Erro ao carregar serviços'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function startCreate() {
    setEditId(null);
    setForm(emptyForm);
    setPhotoFile(null);
    setShowForm(true);
  }

  function startEdit(s: Service) {
    setEditId(s.id);
    setForm({ nome: s.nome, descricao: s.descricao || '', duracao_minutos: String(s.duracao_minutos), valor: s.valor != null ? String(s.valor) : '', ativo: s.ativo });
    setPhotoFile(null);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      let foto_url: string | undefined;
      if (photoFile) {
        const res = await uploadFile(photoFile);
        foto_url = res.url;
      }
      const body: Record<string, unknown> = {
        nome: form.nome,
        descricao: form.descricao || undefined,
        duracao_minutos: parseInt(form.duracao_minutos) || 60,
        valor: form.valor ? parseFloat(form.valor) : null,
        ativo: form.ativo,
      };
      if (foto_url) body.foto_url = foto_url;

      if (editId) {
        await api.put(`/services/${editId}`, body);
      } else {
        await api.post('/services', body);
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este serviço?')) return;
    try {
      await api.delete(`/services/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir');
    }
  }

  if (loading) return <div className="loading">Carregando...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Serviços</h1>
        <button className="btn btn-primary" onClick={startCreate}>Novo Serviço</button>
      </div>
      {error && <p className="error-msg">{error}</p>}

      <div className="search-bar">
        <input className="search-input" placeholder="Buscar por nome..." value={search} onChange={e => { setSearch(e.target.value); setVisibleCount(9); }} />
      </div>

      {showForm && (
        <div className="form-panel">
          <h2>{editId ? 'Editar Serviço' : 'Novo Serviço'}</h2>
          <form onSubmit={handleSubmit}>
            <label>Nome *<input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} required /></label>
            <label>Descrição<textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} rows={2} /></label>
            <div className="form-row">
              <label>Duração (min) *<input type="number" value={form.duracao_minutos} onChange={e => setForm(p => ({ ...p, duracao_minutos: e.target.value }))} min={1} required /></label>
              <label>Valor (R$)<input type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} placeholder="Sob consulta" /></label>
            </div>
            <div className="form-row">
              <label>Foto (JPEG/PNG)<input type="file" accept="image/jpeg,image/png" onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} /></label>
            </div>
            <label style={{ flexDirection: 'row', gap: '0.5rem', alignItems: 'center' }}>
              <input type="checkbox" checked={form.ativo} onChange={e => setForm(p => ({ ...p, ativo: e.target.checked }))} /> Ativo
            </label>
            <div className="form-row">
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="empty">{search ? 'Nenhum serviço encontrado.' : 'Nenhum serviço cadastrado.'}</p>
      ) : (
        <div className="item-cards">
          {filtered.slice(0, visibleCount).map(s => {
            const photoSrc = s.foto_url
              ? (s.foto_url.startsWith('http') ? s.foto_url : `${API_URL}${s.foto_url}`)
              : null;
            return (
              <div className="item-card" key={s.id}>
                <div className="item-card-header">
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {photoSrc && (
                      <img src={photoSrc} alt={s.nome} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                    )}
                    <div>
                      <div className="item-card-title">{s.nome}</div>
                      <div className="item-card-subtitle">⏱️ {s.duracao_minutos} min</div>
                      <div className="item-card-subtitle">{s.valor != null ? `R$ ${Number(s.valor).toFixed(2)}` : 'Sob consulta'}</div>
                    </div>
                  </div>
                  {s.ativo
                    ? <span className="badge badge-green">Ativo</span>
                    : <span className="badge badge-gray">Inativo</span>
                  }
                </div>
                {s.descricao && (
                  <div className="item-card-body">{s.descricao}</div>
                )}
                <div className="item-card-actions">
                  <button className="btn btn-sm" onClick={() => startEdit(s)}>Editar</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)}>Excluir</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {visibleCount < filtered.length && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button className="btn" onClick={() => setVisibleCount(v => v + 9)}>Ver mais</button>
        </div>
      )}
    </div>
  );
}
