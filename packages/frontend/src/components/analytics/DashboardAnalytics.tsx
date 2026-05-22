import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../lib/api';

interface DashboardAnalyticsData {
  topServices: Array<{ nome: string; count: number }>;
  topProducts: Array<{ nome: string; count: number }>;
}

export function DashboardAnalytics() {
  const [data, setData] = useState<DashboardAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get<DashboardAnalyticsData>('/dashboard/analytics');
        setData(res);
      } catch (err) {
        console.error('Error loading analytics:', err);
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted, #9ca3af)', fontSize: '0.875rem' }}>
        Carregando analytics...
      </div>
    );
  }

  const hasServices = data?.topServices && data.topServices.length > 0;
  const hasProducts = data?.topProducts && data.topProducts.length > 0;

  if (!hasServices && !hasProducts) {
    return (
      <div style={{ background: 'var(--bg-primary, #ffffff)', borderRadius: 'var(--radius-lg, 12px)', padding: '2rem', border: '1px solid var(--border-base, #e5e7eb)', textAlign: 'center' }}>
        <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📊</span>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)', margin: '0 0 0.5rem' }}>Analytics</h3>
        <p style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.875rem', margin: 0 }}>
          Nenhum dado disponível. Conclua agendamentos e registre movimentações de estoque para ver os gráficos.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)', margin: '0 0 1rem 0' }}>
        Analytics
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Top Services Chart */}
        <div style={{ background: 'var(--bg-primary, #ffffff)', borderRadius: 'var(--radius-lg, 12px)', padding: '1.25rem', border: '1px solid var(--border-base, #e5e7eb)', boxShadow: 'var(--shadow-sm)' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)', margin: '0 0 1rem' }}>
            Top 5 Serviços Mais Realizados
          </h4>
          {hasServices ? (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data!.topServices} layout="vertical" barSize={18} margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted, #9ca3af)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: 'var(--text-secondary, #64748b)' }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--border-base, #e5e7eb)', fontSize: 12 }} />
                  <Bar dataKey="count" fill="var(--primary, #ff914d)" radius={[0, 6, 6, 0]} name="Concluídos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>Nenhum dado disponível</p>
          )}
        </div>

        {/* Top Products Chart */}
        <div style={{ background: 'var(--bg-primary, #ffffff)', borderRadius: 'var(--radius-lg, 12px)', padding: '1.25rem', border: '1px solid var(--border-base, #e5e7eb)', boxShadow: 'var(--shadow-sm)' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)', margin: '0 0 1rem' }}>
            Top 5 Produtos Mais Utilizados
          </h4>
          {hasProducts ? (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data!.topProducts} layout="vertical" barSize={18} margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted, #9ca3af)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: 'var(--text-secondary, #64748b)' }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--border-base, #e5e7eb)', fontSize: 12 }} />
                  <Bar dataKey="count" fill="#2563eb" radius={[0, 6, 6, 0]} name="Movimentações" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>Nenhum dado disponível</p>
          )}
        </div>
      </div>
    </div>
  );
}
