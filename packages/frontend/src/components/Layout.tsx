import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { HamburgerMenu } from '../design-system/components';
import { NavIcon, type NavIconName } from './NavIcon';

const navItems: { to: string; label: string; iconName: NavIconName }[] = [
  { to: '/dashboard', label: 'Painel', iconName: 'dashboard' },
  { to: '/appointments', label: 'Agendamentos', iconName: 'appointments' },
  { to: '/clients', label: 'Clientes', iconName: 'clients' },
  { to: '/vehicles', label: 'Veículos', iconName: 'vehicles' },
  { to: '/services', label: 'Serviços', iconName: 'services' },
  { to: '/inventory', label: 'Estoque', iconName: 'inventory' },
  { to: '/bills', label: 'Contas', iconName: 'bills' },
  { to: '/locations', label: 'Lojas', iconName: 'locations' },
];

function SidebarContent({ user, logout, location, onNavClick }: {
  user: { nome?: string } | null;
  logout: () => void;
  location: { pathname: string };
  onNavClick?: () => void;
}) {
  return (
    <>
      <div className="sidebar-header">
        <Link to="/dashboard" className="sidebar-brand" onClick={onNavClick}>
          <img src="/logo.png" alt="Gerencia" style={{ height: 70 }} />
        </Link>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`sidebar-link${location.pathname === item.to ? ' sidebar-link-active' : ''}`}
            onClick={onNavClick}
          >
            <span className="sidebar-link-icon"><NavIcon name={item.iconName} ariaLabel={item.label} /></span>
            <span className="sidebar-link-label">{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user">
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
    </>
  );
}

export default function Layout() {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!isAuthenticated) return <Outlet />;

  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-nav-link">Pular para conteúdo</a>
      {/* Mobile: hamburger menu with sidebar content */}
      <div className="admin-mobile-header ds-hide-desktop">
        <HamburgerMenu
          open={mobileMenuOpen}
          onOpenChange={setMobileMenuOpen}
          ariaLabel="Abrir menu de navegação"
        >
          <div className="sidebar-mobile-content">
            <SidebarContent
              user={user}
              logout={logout}
              location={location}
              onNavClick={() => setMobileMenuOpen(false)}
            />
          </div>
        </HamburgerMenu>
        <span className="admin-mobile-title">Gerencia</span>
      </div>

      {/* Desktop: standard sidebar */}
      <aside className="sidebar ds-hide-mobile">
        <SidebarContent
          user={user}
          logout={logout}
          location={location}
        />
      </aside>

      <main id="main-content" className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
