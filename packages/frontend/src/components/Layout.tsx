import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Painel', icon: '📊' },
  { to: '/appointments', label: 'Agendamentos', icon: '📅' },
  { to: '/clients', label: 'Clientes', icon: '👥' },
  { to: '/services', label: 'Serviços', icon: '🔧' },
  { to: '/inventory', label: 'Estoque', icon: '📦' },
  { to: '/bills', label: 'Contas', icon: '💰' },
  { to: '/locations', label: 'Lojas', icon: '🏪' },
];

export default function Layout() {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isAuthenticated) return <Outlet />;

  return (
    <div className="app-layout">
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Menu">
        ☰
      </button>
      <div
        className={`sidebar-overlay${sidebarOpen ? ' active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/dashboard" className="sidebar-brand" onClick={() => setSidebarOpen(false)}>
            <img src="/logo.png" alt="Gerencia" style={{ height: 70 }} />
          </Link>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`sidebar-link${location.pathname === item.to ? ' sidebar-link-active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              <span className="sidebar-link-label">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="si
debar-user">
            <div className="sidebar-user-avatar">
              {user?.nome?.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.nome}</div>
              <div className="sidebar-user-role">Proprietário</div>
            </div>
          </div>
          <button onClick={logout} className="sidebar-logout">Sair</button>
        </div>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
