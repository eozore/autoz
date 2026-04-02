import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../lib/api';

const features = [
  { icon: '📅', title: 'Agendamento Online', desc: 'Seus clientes agendam direto pelo site.' },
  { icon: '👥', title: 'Clientes e Veículos', desc: 'Cadastro completo com histórico.' },
  { icon: '📦', title: 'Controle de Estoque', desc: 'Peças e itens de uso com alertas.' },
  { icon: '💰', title: 'Contas a Pagar', desc: 'Controle de vencimentos e pagamentos.' },
  { icon: '🏪', title: 'Múltiplas Lojas', desc: 'Vários pontos na mesma conta.' },
  { icon: '💬', title: 'WhatsApp', desc: 'Contato direto na página pública.' },
];

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={user?.tenant_id ? '/dashboard' : '/setup'} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, senha);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lp">
      <nav className="lp-nav">
        <span className="lp-logo">
          <img src="/logo.png" alt="Gerencia" style={{ height: 70 }} />
        </span>
        <div className="lp-nav-links">
          <a href="#features" className="lp-nav-link">Recursos</a>
          <a href="#login" className="lp-nav-link">Entrar</a>
          <Link to="/register" className="lp-nav-cta">Criar Conta</Link>
        </div>
      </nav>

      <section className="lp-hero">
        <div className="lp-hero-content">
          <div className="lp-hero-text">
            <div className="lp-badge">🚀 Plataforma para gestão de serviços</div>
            <h1 className="lp-title">Gerencie seu negócio com{' '}<span className="lp-highlight">simplicidade</span></h1>
            <p className="lp-subtitle">Agendamentos, clientes, estoque e finanças em um só lugar. Seus clientes agendam online, você foca no que importa.</p>
            <div className="lp-stats">
              <div className="lp-stat"><span className="lp-stat-num">100%</span><span className="lp-stat-label">Online</span></div>
              <div className="lp-stat-div" />
              <div className="lp-stat"><span className="lp-stat-num">Multi</span><span className="lp-stat-label">Lojas</span></div>
              <div className="lp-stat-div" />
              <div className="lp-stat"><span className="lp-stat-num">0</span><span className="lp-stat-label">Custo inicial</span></div>
            </div>
          </div>

          <div className="lp-login-card" id="login">
            <h2 className="lp-login-title">Entrar na plataforma</h2>
            <p className="lp-login-sub">Acesse seu painel de gerenciamento</p>
            {error && <p className="lp-error">{error}</p>}
            <form onSubmit={handleSubmit} className="lp-form">
              <label className="lp-label">Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com" className="lp-input" />
              </label>
              <label className="lp-label">Senha
                <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={8} placeholder="••••••••" className="lp-input" />
              </label>
              <button type="submit" disabled={loading} className="lp-submit">{loading ? 'Entrando...' : 'Entrar'}</button>
            </form>
            <p className="lp-register-link">Não tem conta?{' '}<Link to="/register" className="lp-link">Criar conta grátis</Link></p>
          </div>
        </div>
      </section>

      <section className="lp-features" id="features">
        <h2 className="lp-features-title">Tudo que você precisa</h2>
        <p className="lp-features-sub">Ferramentas pensadas para quem trabalha com serviços</p>
        <div className="lp-features-grid">
          {features.map((f, i) => (
            <div key={i} className="lp-feature-card">
              <span className="lp-feature-icon">{f.icon}</span>
              <h3 className="lp-feature-name">{f.title}</h3>
              <p className="lp-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="lp-footer">
        <span className="lp-footer-logo">
          <img src="/logo.png" alt="Gerencia" style={{ height: 50 }} />
        </span>
        <p className="lp-footer-text">© {new Date().getFullYear()} Gerencia. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
