import { useState, useEffect, useMemo, useCallback, type FormEvent } from 'react';
import api, { ApiError, uploadFile } from '../lib/api';
import { BulkImportModal } from '../components/services/BulkImportModal';
import { ImagePreviewCrop } from '../components/services/ImagePreviewCrop';
import { validateServiceField } from '../components/services/serviceValidation';
import { ServiceAutofill, type ServiceTemplate } from '../components/services/ServiceAutofill';
import { Modal } from '../design-system/components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

interface Service {
  id: string;
  nome: string;
  descricao: string | null;
  foto_url: string | null;
  duracao_minutos: number;
  valor: number | null;
  categoria: string | null;
  ativo: boolean;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const emptyForm = { nome: '', descricao: '', duracao_minutos: '60', valor: '', categoria: 'Principais', ativo: true };

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
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { dialogProps, confirm } = useConfirmDialog();

  /** Validate a single field on blur, providing feedback within 300ms */
  const validateField = useCallback((field: string, value: string) => {
    const result = validateServiceField(field, value);
    setFieldErrors(prev => {
      if (result.error) return { ...prev, [field]: result.error };
      const next = { ...prev };
      delete next[field];
      return next;
    });
    return result.error;
  }, []);

  const handleFieldBlur = useCallback((field: string, value: string) => {
    validateField(field, value);
  }, [validateField]);

  /** When a template is selected from ServiceAutofill, populate form fields */
  const handleAutofillSelect = useCallback((template: ServiceTemplate) => {
    setForm(prev => ({
      ...prev,
      nome: template.nome,
      duracao_minutos: String(template.duracao_minutos),
      valor: String(template.valor),
    }));
    // Clear any existing field errors for the auto-filled fields
    setFieldErrors(prev => {
      const next = { ...prev };
      delete next.nome;
      delete next.duracao_minutos;
      delete next.valor;
      return next;
    });
  }, []);

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
    setFieldErrors({});
    setShowForm(true);
  }

  function startEdit(s: Service) {
    setEditId(s.id);
    setForm({ nome: s.nome, descricao: s.descricao || '', duracao_minutos: String(s.duracao_minutos), valor: s.valor != null ? String(s.valor) : '', categoria: s.categoria || '', ativo: s.ativo });
    setPhotoFile(null);
    setFieldErrors({});
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
        categoria: form.categoria || null,
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
    confirm({
      title: 'Confirmar Exclusão',
      description: 'Tem certeza que deseja excluir este serviço?',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/services/${id}`);
          await load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Erro ao excluir');
        }
      },
    });
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
        <input className="search-input" placeholder="Buscar por nome..." value={search} onChange={e => { setSearch(e.target.value); }} />
      </div>

      {showForm && (
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editId ? 'Editar Serviço' : 'Novo Serviço'}>
              <form onSubmit={handleSubmit}>
                {!editId ? (
                  <label>Nome *
                    <ServiceAutofill
                      value={form.nome}
                      onChange={(value) => setForm(p => ({ ...p, nome: value }))}
                      onSelect={handleAutofillSelect}
                      placeholder="Digite o nome do serviço..."
                    />
                    {fieldErrors.nome && <span className="field-error" role="alert" style={fieldErrorStyle}>{fieldErrors.nome}</span>}
                  </label>
                ) : (
                  <label>Nome *
                    <input
                      value={form.nome}
                      onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                      onBlur={e => handleFieldBlur('nome', e.target.value)}
                      required
                      style={fieldErrors.nome ? { borderColor: 'var(--ds-color-danger, #ef4444)' } : undefined}
                    />
                    {fieldErrors.nome && <span className="field-error" role="alert" style={fieldErrorStyle}>{fieldErrors.nome}</span>}
                  </label>
                )}
                <label>Descrição<textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} rows={2} /></label>
                <label>Categoria
                  <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                    <option value="Principais">Principais</option>
                    <option value="Outros">Outros</option>
                    {Array.from(new Set(services.map(s => s.categoria).filter(Boolean)))
                      .filter(c => c !== 'Principais' && c !== 'Outros')
                      .map(cat => (
                        <option key={cat} value={cat!}>{cat}</option>
                      ))}
                  </select>
                </label>
                <div className="form-row">
                  <label>Duração (min) *
                    <input
                      type="number"
                      value={form.duracao_minutos}
                      onChange={e => setForm(p => ({ ...p, duracao_minutos: e.target.value }))}
                      onBlur={e => handleFieldBlur('duracao_minutos', e.target.value)}
                      min={5}
                      max={480}
                      required
                      style={fieldErrors.duracao_minutos ? { borderColor: 'var(--ds-color-danger, #ef4444)' } : undefined}
                    />
                    {fieldErrors.duracao_minutos && <span className="field-error" role="alert" style={fieldErrorStyle}>{fieldErrors.duracao_minutos}</span>}
                  </label>
                  <label>Valor (R$)
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.valor}
                      onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                      onBlur={e => handleFieldBlur('valor', e.target.value)}
                      placeholder="Sob consulta"
                      style={fieldErrors.valor ? { borderColor: 'var(--ds-color-danger, #ef4444)' } : undefined}
                    />
                    {fieldErrors.valor && <span className="field-error" role="alert" style={fieldErrorStyle}>{fieldErrors.valor}</span>}
                  </label>
                </div>
                <div className="form-row">
                  <label>Foto (JPEG/PNG)<input type="file" accept="image/jpeg,image/png" onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} /></label>
                </div>
                <ImagePreviewCrop file={photoFile} aspectRatio={1} previewSize={160} />
                <label style={{ flexDirection: 'row', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="checkbox" checked={form.ativo} onChange={e => setForm(p => ({ ...p, ativo: e.target.checked }))} /> Ativo
                </label>
                <div className="form-row">
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
                  <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
                </div>
              </form>
        </Modal>
      )}

      {services.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: '#ffffff', border: '1px dashed var(--border-base)', borderRadius: 'var(--radius-lg)', marginTop: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🔧</span>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Nenhum Serviço Cadastrado</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto 1.5rem', lineHeight: '1.6' }}>
            Para habilitar os agendamentos online dos clientes e agilizar a criação de ordens de serviço, você precisa cadastrar seus serviços ou produtos.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={startCreate}>Cadastrar Serviço</button>
            <button className="btn" onClick={() => setShowBulkImport(true)} style={{ border: '1px solid var(--border-base)', background: '#ffffff', color: 'var(--text-primary)' }}>
              🚀 Importar pacote de serviços
            </button>
          </div>
          <BulkImportModal
            open={showBulkImport}
            onClose={() => setShowBulkImport(false)}
            onSuccess={load}
          />
        </div>
      ) : filtered.length === 0 ? (
        <p className="empty">Nenhum serviço encontrado para "{search}".</p>
      ) : (
        <div className="item-cards">
          {filtered.map(s => {
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
                {s.categoria && (
                  <div style={{ padding: '0 1rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 500 }}>
                      📁 {s.categoria}
                    </span>
                  </div>
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

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

const fieldErrorStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  color: 'var(--ds-color-danger, #ef4444)',
  marginTop: '0.25rem',
  lineHeight: 1.4,
};
