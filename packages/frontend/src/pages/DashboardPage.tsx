import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { ApiError } from '../lib/api';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Appointment {
  id: string; data_hora: string; duracao_minutos: number; status: string;
  nome_visitante: string | null; client_id: string | null; notas: string | null;
  service_id: string;
}
interface Bill { id: string; descricao: string; valor: number; data_vencimento: string; status: string; }
interface FinStats {
  month: {
    servicesCompleted: number;
    salesRevenue: number;
    servicesRevenue: number;
    totalExpenses: number;
    paidExpenses: number;
    pendingExpenses: number;
    cashFlow: number;
  };
  bills: { totalPaid: number; totalPending: number; totalOverdue: number; overdueCount: number; };
  receivables: {
    inProgress: { count: number; total: number };
    installments: { count: number; total: number };
  };
  allTime: { totalServicesCompleted: number; totalSalesRevenue: number; };
  inventory: { stockCostTotal: number; stockSaleValue: number; };
}
interface InvItem { id: string; nome: string; quantidade_atual: number; quantidade_minima: number; tipo: string; }
interface ServiceInfo { id: string; nome: string; }
interface Location { id: string; endereco_rua: string; endereco_numero: string; endereco_cidade: string; is_primary: boolean; }

const money = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',');
const statusDot: Record<string, string> = { AGENDADO:'#ff914d', CONFIRMADO:'#ff914d', EM_ANDAMENTO:'#f59e0b', CONCLUIDO:'#9ca3af', CANCELADO:'#dc2626' };

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fin, setFin] = useState<FinStats | null>(null);
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([]);
  const [nextAppts, setNextAppts] = useState<Appointment[]>([]);
  const [lowStock, setLowStock] = useState<InvItem[]>([]);
  const [slug, setSlug] = useState('');
  const [dailyData, setDailyData] = useState<Array<{ name: string; servicos: number }>>([]);
  const [billsChart, setBillsChart] = useState<Array<{ name: string; valor: number }>>([]);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [selectedLocation, setSelectedLocation] = useState('all');

  const svcName = useCallback((id: string) => services.find(s => s.id === id)?.nome || 'Serviço', [services]);

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { if (!loading) loadFiltered(); }, [selectedMonth, selectedLocation]);

  async function loadBase() {
    try {
      const [compR, svcR, invR] = await Promise.all([
        api.get<{ tenant?: { slug: string }; locations: Location[] }>('/companies/me'),
        api.get<ServiceInfo[]>('/services'),
        api.get<{ data: InvItem[] }>('/inventory'),
      ]);
      setSlug(compR.tenant?.slug || '');
      setLocations(compR.locations || []);
      setServices(svcR);
      setLowStock((invR.data || []).filter(i => i.quantidade_atual <= i.quantidade_minima).slice(0, 5));
    } catch {}
    await loadFiltered();
    setLoading(false);
  }

  async function loadFiltered() {
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const mStart = new Date(year, month - 1, 1);
      const mEnd = new Date(year, month, 0, 23, 59, 59);
      const ms = mStart.toISOString();
      const me = mEnd.toISOString();
      const today = new Date().toISOString().split('T')[0];
      const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

      const [finR, monthAppts, todayR, weekR, billsR] = await Promise.all([
        api.get<FinStats>('/dashboard/stats'),
        api.get<Appointment[]>(`/appointments?start=${ms}&end=${me}`),
        api.get<Appointment[]>(`/appointments?start=${today}T00:00:00&end=${today}T23:59:59`),
        api.get<Appointment[]>(`/appointments?start=${today}T00:00:00&end=${weekEnd}T23:59:59`),
        api.get<{ data: Bill[] }>('/bills'),
      ]);

      setFin(finR);
      setTodayAppts(todayR.filter(a => a.status !== 'CANCELADO'));
      setNextAppts(weekR.filter(a => a.status !== 'CANCELADO' && a.status !== 'CONCLUIDO').slice(0, 6));

      // Daily chart from month appointments
      const daysInMonth = mEnd.getDate();
      const daily: Record<number, number> = {};
      for (let d = 1; d <= daysInMonth; d++) daily[d] = 0;
      (monthAppts || []).forEach(a => {
        if (a.status === 'CONCLUIDO') {
          const day = new Date(a.data_hora).getDate();
          daily[day] = (daily[day] || 0) + 1;
        }
      });
      setDailyData(Object.entries(daily).map(([d, v]) => ({ name: String(d), servicos: v })));

      // Bills chart: pago vs pendente vs vencido
      const allBills = billsR.data || [];
      const now = new Date();
      const pago = allBills.filter(b => b.status === 'PAGO').reduce((s, b) => s + Number(b.valor), 0);
      const pendente = allBills.filter(b => b.status === 'PENDENTE' && new Date(b.data_vencimento) >= now).reduce((s, b) => s + Number(b.valor), 0);
      const vencido = allBills.filter(b => b.status === 'PENDENTE' && new Date(b.data_vencimento) < now).reduce((s, b) => s + Number(b.valor), 0);
      setBillsChart([
        { name: 'Pago', valor: pago },
        { name: 'Pendente', valor: pendente },
        { name: 'Vencido', valor: vencido },
      ]);
    } catch (err) { console.error(err); }
  }

  async function cancelAppt(id: string) {
    if (!confirm('Cancelar este agendamento?')) return;
    try {
      await api.patch(`/appointments/${id}/cancel`);
      await loadFiltered();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Erro ao cancelar');
    }
  }

  if (loading) return <div className="loading">Carregando painel...</div>;

  const monthLabel = new Date(selectedMonth + '-01').toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  const faturamento = (fin?.month.servicesRevenue || 0) + (fin?.month.salesRevenue || 0);
  const cashFlow = faturamento - (fin?.month.paidExpenses || 0);

  return (
    <div className="dash">
      {/* Header with filters */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Dashboard</h1>
          <p className="dash-subtitle">Olá, {user?.nome}</p>
        </div>
        <div className="dash-filters">
          <label className="dash-filter">
            <span>Mês</span>
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
          </label>
          <label className="dash-filter">
            <span>Loja</span>
            <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}>
              <option value="all">Todas as lojas</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.endereco_rua}, {l.endereco_numero}{l.is_primary ? ' (Principal)' : ''}</option>
              ))}
            </select>
          </label>
          {slug && <a href={`/p/${slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm" style={{ textDecoration: 'none', alignSelf: 'flex-end' }}>🌐 Página Pública</a>}
        </div>
      </div>

      {/* KPIs */}
      <div className="dash-kpi-row">
        <div className="dash-kpi">
          <div className="dash-kpi-label">Faturamento</div>
          <div className="dash-kpi-value" style={{ color: '#16a34a' }}>{money(faturamento)}</div>
          <div className="dash-kpi-sub">{fin?.month.servicesCompleted || 0} serviços concluídos</div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-label">Contas Pagas</div>
          <div className="dash-kpi-value">{money(fin?.month.paidExpenses || 0)}</div>
          <div className="dash-kpi-sub" style={{ color: '#dc2626' }}>Falta: {money(fin?.month.pendingExpenses || 0)}</div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-label">Fluxo de Caixa</div>
          <div className="dash-kpi-value" style={{ color: cashFlow >= 0 ? '#16a34a' : '#dc2626' }}>
            {cashFlow >= 0 ? '+' : ''}{money(cashFlow)}
          </div>
          <div className="dash-kpi-sub">receita - despesas</div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-label">Hoje</div>
          <div className="dash-kpi-value" style={{ color: '#ff914d' }}>{todayAppts.length}</div>
          <div className="dash-kpi-sub">agendamentos</div>
        </div>
      </div>

      {/* Receivables */}
      {fin?.receivables && (fin.receivables.inProgress.count > 0 || fin.receivables.installments.count > 0) && (
        <div className="dash-receivables">
          <h3>Valores a Receber</h3>
          {fin.receivables.inProgress.count > 0 && (
            <div className="dash-receivables-row">
              <span>🔧 Em Andamento: {fin.receivables.inProgress.count} serviços</span>
              <strong style={{ color: '#f59e0b' }}>{money(fin.receivables.inProgress.total)}</strong>
            </div>
          )}
          {fin.receivables.installments.count > 0 && (
            <div className="dash-receivables-row">
              <span>💳 Parcelado: {fin.receivables.installments.count} serviços</span>
              <strong style={{ color: '#ff914d' }}>{money(fin.receivables.installments.total)}</strong>
            </div>
          )}
        </div>
      )}

      {/* Charts row */}
      <div className="dash-charts-row">
        <div className="dash-panel dash-panel-wide">
          <div className="dash-panel-header">
            <h3>Serviços Concluídos por Dia — {monthLabel}</h3>
          </div>
          <div style={{ height: 200, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={dailyData}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} width={25} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Area type="monotone" dataKey="servicos" stroke="#ff914d" fill="rgba(255,145,77,0.1)" name="Serviços" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="dash-panel">
          <div className="dash-panel-header">
            <h3>Contas</h3>
            <Link to="/bills">Ver →</Link>
          </div>
          <div style={{ height: 200, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={billsChart} layout="vertical" barSize={20}>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#374151' }} axisLine={false} tickLine={false} width={65} />
                <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="valor" radius={[0, 6, 6, 0]} name="Valor">
                  {billsChart.map((entry, i) => {
                    const colors = ['#16a34a', '#f59e0b', '#dc2626'];
                    return <rect key={i} fill={colors[i]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom: Agenda + Stock + Upcoming */}
      <div className="dash-bottom-row">
        {/* Today's agenda */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <h3>Agenda de Hoje</h3>
            <Link to="/appointments">Ver todos →</Link>
          </div>
          {todayAppts.length === 0 ? (
            <p className="empty" style={{ padding: '1rem 0' }}>Nenhum agendamento hoje.</p>
          ) : (
            <div className="dash-agenda">
              {todayAppts.map(a => (
                <div key={a.id} className="dash-agenda-item">
                  <div className="dash-agenda-time">
                    {new Date(a.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="dash-agenda-dot" style={{ background: statusDot[a.status] || '#9ca3af' }} />
                  <div className="dash-agenda-info">
                    <div className="dash-agenda-title">{svcName(a.service_id)}</div>
                    <div className="dash-agenda-sub">{a.notas || a.nome_visitante || ''} · {a.duracao_minutos}min</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming with cancel */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <h3>Próximos Agendamentos</h3>
            <Link to="/appointments">Ver todos →</Link>
          </div>
          {nextAppts.length === 0 ? (
            <p className="empty" style={{ padding: '1rem 0' }}>Nenhum agendamento próximo.</p>
          ) : (
            <div>
              {nextAppts.map(a => (
                <div key={a.id} className="dash-upcoming-item">
                  <div className="dash-upcoming-left">
                    <div className="dash-upcoming-svc">{svcName(a.service_id)}</div>
                    <div className="dash-upcoming-meta">
                      {new Date(a.data_hora).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às{' '}
                      {new Date(a.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      {a.notas ? ` · ${a.notas}` : ''}
                    </div>
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={() => cancelAppt(a.id)} title="Cancelar">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low stock */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <h3>Estoque em Alerta</h3>
            <Link to="/inventory">Gerenciar →</Link>
          </div>
          {lowStock.length === 0 ? (
            <p style={{ color: '#16a34a', fontSize: '0.88rem', padding: '1rem 0' }}>✓ Estoque OK</p>
          ) : (
            <div>
              {lowStock.map(item => (
                <div key={item.id} className="dash-stock-item">
                  <div>
                    <div className="dash-stock-name">{item.nome}</div>
                    <div className="dash-stock-type">{item.tipo === 'USO' ? 'Uso interno' : 'Venda'}</div>
                  </div>
                  <div className="dash-stock-qty" style={{ color: item.quantidade_atual === 0 ? '#dc2626' : '#f59e0b' }}>
                    {item.quantidade_atual} <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>/ {item.quantidade_minima}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Inventory value */}
          {fin && (
            <div className="dash-inv-mini">
              <div>Custo: <strong>{money(fin.inventory.stockCostTotal)}</strong></div>
              <div>Venda: <strong style={{ color: '#16a34a' }}>{money(fin.inventory.stockSaleValue)}</strong></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
