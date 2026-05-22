import { useState, useEffect, type FormEvent } from 'react';
import api, { ApiError, uploadFile } from '../lib/api';
import { Modal } from '../design-system/components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

interface Location {
  id: string;
  company_id: string;
  endereco_rua: string;
  endereco_numero: string;
  endereco_complemento: string | null;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_estado: string;
  endereco_cep: string;
  is_primary: boolean;
  horario_abertura: string;
  horario_fechamento: string;
}

interface Company {
  id: string;
  nome: string;
  logo_url: string | null;
  descricao: string | null;
  locations: Location[];
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const emptyForm = {
  rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '',
  horario_abertura: '08:00', horario_fechamento: '18:00',
};

export default function LocationsPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Company edit state
  const [showCompanyEdit, setShowCompanyEdit] = useState(false);
  const [companyForm, setCompanyForm] = useState({ nome: '', descricao: '' });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [companySaving, setCompanySaving] = useState(false);
  const { dialogProps, confirm } = useConfirmDialog();

  async function load() {
    try {
      const c = await api.get<Company>('/companies/me');
      setCompany(c);
      setLocations(c.locations || []);
    } catch { setError('Erro ao carregar lojas'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function startCompanyEdit() {
    if (!company) return;
    setCompanyForm({ nome: company.nome, descricao: company.descricao || '' });
    setLogoFile(null);
    setShowCompanyEdit(true);
  }

  async function handleCompanySubmit(e: FormEvent) {
    e.preventDefault();
    if (!company) return;
    setError('');
    setCompanySaving(true);
    try {
      let logo_url: string | undefined;
      if (logoFile) {
        const res = await uploadFile(logoFile);
        logo_url = res.url;
      }
      const body: Record<string, unknown> = {
        nome: companyForm.nome,
        descricao: companyForm.descricao || undefined,
      };
      if (logo_url) body.logo_url = logo_url;
      await api.put(`/companies/${company.id}`, body);
      setShowCompanyEdit(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar empresa');
    } finally { setCompanySaving(false); }
  }

  function startCreate() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function startEdit(loc: Location) {
    setEditId(loc.id);
    setForm({
      rua: loc.endereco_rua, numero: loc.endereco_numero,
      complemento: loc.endereco_complemento || '', bairro: loc.endereco_bairro,
      cidade: loc.endereco_cidade, estado: loc.endereco_estado, cep: loc.endereco_cep,
      horario_abertura: loc.horario_abertura || '08:00',
      horario_fechamento: loc.horario_fechamento || '18:00',
    });
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/companies/locations/${editId}`, form);
      } else {
        await api.post(`/companies/${company!.id}/locations`, form);
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
      description: 'Tem certeza que deseja excluir esta loja?',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/companies/locations/${id}`);
          await load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Erro ao excluir');
        }
      },
    });
  }

  function upd(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })); }

  if (loading) return <div className="loading">Carregando...</div>;

  const logoSrc = company?.logo_url
    ? (company.logo_url.startsWith('http') ? company.logo_url : `${API_URL}${company.logo_url}`)
    : null;

  return (
    <div>
      {/* Company info section */}
      {company && (
        <div className="form-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {logoSrc && (
            <img src={logoSrc} alt="Logo" style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover' }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>{company.nome}</h2>
            {company.descricao && <p style={{ color: '#6b7280', fontSize: '0.88rem', margin: '0.2rem 0 0' }}>{company.descricao}</p>}
          </div>
          <button className="btn btn-sm" onClick={startCompanyEdit}>Editar</button>
        </div>
      )}

      {showCompanyEdit && (
        <Modal open={showCompanyEdit} onClose={() => setShowCompanyEdit(false)} title="Editar Empresa">
              <form onSubmit={handleCompanySubmit}>
                <label>Nome *<input value={companyForm.nome} onChange={e => setCompanyForm(p => ({ ...p, nome: e.target.value }))} required /></label>
                <label>Descrição<textarea value={companyForm.descricao} onChange={e => setCompanyForm(p => ({ ...p, descricao: e.target.value }))} rows={2} /></label>
                <label>Logo (JPEG/PNG)<input type="file" accept="image/jpeg,image/png" onChange={e => setLogoFile(e.target.files?.[0] ?? null)} /></label>
                <div className="form-row">
                  <button type="submit" className="btn btn-primary" disabled={companySaving}>{companySaving ? 'Salvando...' : 'Salvar'}</button>
                  <button type="button" className="btn" onClick={() => setShowCompanyEdit(false)}>Cancelar</button>
                </div>
              </form>
        </Modal>
      )}

      <div className="page-header">
        <h1>Lojas</h1>
        <button className="btn btn-primary" onClick={startCreate}>Nova Loja</button>
      </div>
      {error && <p className="error-msg">{error}</p>}

      {showForm && (
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editId ? 'Editar Loja' : 'Nova Loja'}>
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <label className="flex-grow">Rua *<input value={form.rua} onChange={e => upd('rua', e.target.value)} required /></label>
                  <label>Número *<input value={form.numero} onChange={e => upd('numero', e.target.value)} required /></label>
                </div>
                <label>Complemento<input value={form.complemento} onChange={e => upd('complemento', e.target.value)} /></label>
                <div className="form-row">
                  <label className="flex-grow">Bairro *<input value={form.bairro} onChange={e => upd('bairro', e.target.value)} required /></label>
                  <label className="flex-grow">Cidade *<input value={form.cidade} onChange={e => upd('cidade', e.target.value)} required /></label>
                </div>
                <div className="form-row">
                  <label>Estado *<input value={form.estado} onChange={e => upd('estado', e.target.value)} required maxLength={2} /></label>
                  <label>CEP *<input value={form.cep} onChange={e => upd('cep', e.target.value)} required /></label>
                </div>
                <div className="form-row">
                  <label className="flex-grow">Horário de Abertura<input type="time" value={form.horario_abertura} onChange={e => upd('horario_abertura', e.target.value)} /></label>
                  <label className="flex-grow">Horário de Fechamento<input type="time" value={form.horario_fechamento} onChange={e => upd('horario_fechamento', e.target.value)} /></label>
                </div>
                <div className="form-row">
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
                  <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
                </div>
              </form>
        </Modal>
      )}

      {locations.length === 0 ? (
        <p className="empty">Nenhuma loja cadastrada.</p>
      ) : (
        <div className="item-cards">
          {locations.map(loc => (
            <div className="item-card" key={loc.id}>
              <div className="item-card-header">
                <div className="item-card-title">
                  📍 {loc.endereco_rua}, {loc.endereco_numero}
                  {loc.endereco_complemento ? ` - ${loc.endereco_complemento}` : ''}
                </div>
                {loc.is_primary && <span className="badge badge-green">Primária</span>}
              </div>
              <div className="item-card-body">
                <div className="item-card-row">
                  <span className="item-card-label">Bairro</span>
                  <span className="item-card-value">{loc.endereco_bairro}</span>
                </div>
                <div className="item-card-row">
                  <span className="item-card-label">Cidade/UF</span>
                  <span className="item-card-value">{loc.endereco_cidade}/{loc.endereco_estado}</span>
                </div>
                <div className="item-card-row">
                  <span className="item-card-label">CEP</span>
                  <span className="item-card-value">{loc.endereco_cep}</span>
                </div>
                <div className="item-card-row">
                  <span className="item-card-label">Horário</span>
                  <span className="item-card-value">🕐 {loc.horario_abertura || '08:00'} - {loc.horario_fechamento || '18:00'}</span>
                </div>
              </div>
              <div className="item-card-actions">
                <button className="btn btn-sm" onClick={() => startEdit(loc)}>Editar</button>
                {!loc.is_primary && <button className="btn btn-sm btn-danger" onClick={() => handleDelete(loc.id)}>Excluir</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
