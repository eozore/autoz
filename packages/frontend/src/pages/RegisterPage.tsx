import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../lib/api';

export default function RegisterPage() {
  const { register, isAuthenticated, user } = useAuth();
  const [form, setForm] = useState({ email: '', senha: '', nome: '', idade: '', celular: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={user?.tenant_id ? '/dashboard' : '/setup'} replace />;
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.nome.trim()) errs.nome = 'Nome é obrigatório';
    if (!form.email.trim()) errs.email = 'Email é obrigatório';
    if (form.senha.length < 8) errs.senha = 'Senha deve ter no mínimo 8 caracteres';
    const idade = Number(form.idade);
    if (!form.idade || isNaN(idade) || idade < 18) errs.idade = 'Idade mínima é 18 anos';
    if (!form.celular.trim()) errs.celular = 'Celular é obrigatório';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGlobalError('');
    if (!validate()) return;
    setLoading(true);
    try {
      await register({
        email: form.email,
        senha: form.senha,
        nome: form.nome,
        idade: Number(form.idade),
        celular: form.celular,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setGlobalError(err.message);
      } else {
        setGlobalError('Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Criar Conta</h1>
        {globalError && <p className="error-msg">{globalError}</p>}
        <form onSubmit={handleSubmit}>
          <label>
            Nome
            <input type="text" value={form.nome} onChange={(e) => update('nome', e.target.value)} required />
            {errors.nome && <span className="field-error">{errors.nome}</span>}
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </label>
          <label>
            Senha
            <input type="password" value={form.senha} onChange={(e) => update('senha', e.target.value)} required minLength={8} />
            {errors.senha && <span className="field-error">{errors.senha}</span>}
          </label>
          <label>
            Idade
            <input type="number" value={form.idade} onChange={(e) => update('idade', e.target.value)} required min={18} />
            {errors.idade && <span className="field-error">{errors.idade}</span>}
          </label>
          <label>
            Celular
            <input type="tel" value={form.celular} onChange={(e) => update('celular', e.target.value)} required placeholder="+5511999999999" />
            {errors.celular && <span className="field-error">{errors.celular}</span>}
          </label>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Criando...' : 'Criar Conta'}
          </button>
        </form>
        <p className="auth-link">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
