import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { ApiError, uploadFile } from '../lib/api';

interface CompanyResponse {
  token: string;
  company: { id: string; nome: string };
  location: { id: string };
}

export default function CompanySetupPage() {
  const { user, isAuthenticated, setTokenAndUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    horario_abertura: '08:00',
    horario_fechamento: '18:00',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.tenant_id) return <Navigate to="/dashboard" replace />;

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let logo_url: string | undefined;

      if (logoFile) {
        const uploadRes = await uploadFile(logoFile);
        logo_url = uploadRes.url;
      }

      const res = await api.post<CompanyResponse>('/companies', {
        nome: form.nome,
        descricao: form.descricao || null,
        logo_url: logo_url || null,
        endereco: {
          rua: form.rua,
          numero: form.numero,
          complemento: form.complemento || null,
          bairro: form.bairro,
          cidade: form.cidade,
          estado: form.estado,
          cep: form.cep,
        },
        horario_abertura: form.horario_abertura,
        horario_fechamento: form.horario_fechamento,
      });

      // Decode the new token to get updated user info
      const payload = JSON.parse(atob(res.token.split('.')[1]));
      setTokenAndUser(res.token, {
        ...user!,
        tenant_id: payload.tenant_id,
      });

      // Redirect to Dashboard with onboarding checklist expanded
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details) {
          const details = err.details as Array<{ message: string }>;
          setError(details.map(d => d.message).join(', '));
        } else {
          setError(err.message);
        }
      } else {
        setError('Erro ao configurar empresa. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card wide">
        <h1>Configurar Empresa</h1>
        <p className="subtitle">Configure seu estabelecimento para começar a usar a plataforma.</p>
        {error && <p className="error-msg">{error}</p>}
        <form onSubmit={handleSubmit}>
          <fieldset>
            <legend>Dados da Empresa</legend>
            <label>
              Nome da Empresa *
              <input type="text" value={form.nome} onChange={(e) => update('nome', e.target.value)} required />
            </label>
            <label>
              Descrição
              <textarea value={form.descricao} onChange={(e) => update('descricao', e.target.value)} rows={3} />
            </label>
            <label>
              Logo (JPEG, máx 5MB)
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Endereço da Loja Principal</legend>
            <div className="form-row">
              <label className="flex-grow">
                Rua *
                <input type="text" value={form.rua} onChange={(e) => update('rua', e.target.value)} required />
              </label>
              <label>
                Número *
                <input type="text" value={form.numero} onChange={(e) => update('numero', e.target.value)} required />
              </label>
            </div>
            <label>
              Complemento
              <input type="text" value={form.complemento} onChange={(e) => update('complemento', e.target.value)} />
            </label>
            <div className="form-row">
              <label className="flex-grow">
                Bairro *
                <input type="text" value={form.bairro} onChange={(e) => update('bairro', e.target.value)} required />
              </label>
              <label className="flex-grow">
                Cidade *
                <input type="text" value={form.cidade} onChange={(e) => update('cidade', e.target.value)} required />
              </label>
            </div>
            <div className="form-row">
              <label>
                Estado *
                <input type="text" value={form.estado} onChange={(e) => update('estado', e.target.value)} required maxLength={2} placeholder="SP" />
              </label>
              <label>
                CEP *
                <input type="text" value={form.cep} onChange={(e) => update('cep', e.target.value)} required placeholder="00000-000" />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Horário de Funcionamento</legend>
            <div className="form-row">
              <label className="flex-grow">
                Horário de Abertura
                <input type="time" value={form.horario_abertura} onChange={(e) => update('horario_abertura', e.target.value)} />
              </label>
              <label className="flex-grow">
                Horário de Fechamento
                <input type="time" value={form.horario_fechamento} onChange={(e) => update('horario_fechamento', e.target.value)} />
              </label>
            </div>
          </fieldset>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Criando...' : 'Criar Empresa'}
          </button>
        </form>
      </div>
    </div>
  );
}
