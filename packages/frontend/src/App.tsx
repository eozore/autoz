import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const CompanySetupPage = lazy(() => import('./pages/CompanySetupPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const LocationsPage = lazy(() => import('./pages/LocationsPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const BillsPage = lazy(() => import('./pages/BillsPage'));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'));
const VehiclesPage = lazy(() => import('./pages/VehiclesPage'));
const PublicPage = lazy(() => import('./pages/PublicPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function RootRedirect() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.tenant_id) return <Navigate to="/setup" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'50vh',color:'#9ca3af'}}>Carregando...</div>}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/p/:slug" element={<PublicPage />} />
        <Route
          path="/setup"
          element={
            <ProtectedRoute>
              <CompanySetupPage />
            </ProtectedRoute>
          }
        />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/locations" element={<ProtectedRoute><LocationsPage /></ProtectedRoute>} />
          <Route path="/services" element={<ProtectedRoute><ServicesPage /></ProtectedRoute>} />
          <Route path="/clients" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
          <Route path="/bills" element={<ProtectedRoute><BillsPage /></ProtectedRoute>} />
          <Route path="/appointments" element={<ProtectedRoute><AppointmentsPage /></ProtectedRoute>} />
          <Route path="/vehicles" element={<ProtectedRoute><VehiclesPage /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
