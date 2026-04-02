import { useState, useEffect, useMemo, type FormEvent } from 'react';
import api, { ApiError } from '../lib/api';

interface InventoryItem {
  id: string;
  nome: string;
  descricao: string | null;
  custo: number;
  valor_venda: number;
  tipo: 'USO' | 'VENDA';
  quantidade_atual: number;
  quantidade_minima: number;
}

interface Summary {
  total_items: number;
  total_uso: number;
  total_venda: number;
  low_stock_count: number;
}

const emptyItem = { nome: '', descricao: '', custo: '', valor_venda: '', tipo: 'USO', quantidade_inicial: '', quantidade_minima: '0' };
const emptyMov = { item_id: '', tipo: 'ENTRADA', quantidade: '', notas: '' };

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Item form
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyItem);
  const [saving, setSaving] = useState(false);

  // Movement form
  const [showMov, setShowMov] = useState(false);
  const [movForm, setMovForm] = useState(emptyMov);
  const [movSaving, setMovSaving] = useState(false);

  const filtered = useMemo(() => {
    let result = items;
    if (lowStockOnly) {
      result = result.filter(i => i.quantidade_atual <= i.quantidade_minima);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.nome.toLowerCase().includes(q) ||
        (i.descricao || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, search, lowStockOnly]);

  async function loadItems(tipo?: string) {
    try {
      const params = tipo ? `?tipo=${tipo}&limit=9` : '?limit=9';
      const res = await api.get<{ data: InventoryItem[]; nextCursor: string | null }>(`/inventory${params}`);
      setItems(res.data);
      setNextCursor(res.nextCursor);
    } catch { setError('Erro ao carregar estoque'); }
    finally { setLoading(false); }
  }

  async function loadSummary() {
    try {
      const s = await api.get<Summary>('/inventory/summary');
      setSummary(s);
    } catch { /* ignore */ }
  }

  useEffect(() => { loadItems(); loadSummary(); }, []);

  function applyTypeFilter(tipo: string) {
    setFilterType(tipo);
    setSearch('');
    setLoading(true);
    loadItems(tipo || undefined);
  }

  async function loadMore() {
    if (!nextCursor) return;
    try {
      const params = filterType ? `?tipo=${filterType}&limit=9&cursor=${nextCursor}` : `?limit=9&cursor=${nextCursor}`;
      const res = await api.get<{ data: InventoryItem[]; nextCursor: string | null }>(`/inventory${params}`);
      setItems(prev => [...prev, ...res.data]);
      setNextCursor(res.nextCursor);
    } catch { /* ignore */ }
  }

  function startCreate() {
    setEditId(null);
    setForm(emptyItem);
    setShowForm(true);
  }

  function startEdit(item: InventoryItem) {
    setEditId(item.id);
    setForm({
      nome: item.nome, descricao: item.descricao || '',
      custo: String(item.custo), valor_venda: String(item.valor_venda),
      tipo: item.tipo, quantidade_inicial: String(item.quantidade_atual),
      quantidade_minima: String(item.quantidade_minima),
    });
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/inventory/${editId}`, {
          nome: form.nome, descricao: form.descricao || undefined,
          custo: parseFloat(form.custo), valor_venda: parseFloat(form.valor_venda),
          quantidade_minima: parseInt(form.quantidade_minima) || 0,
        });
      } else {
        await api.post('/inventory', {
          nome: form.nome, descricao: form.descricao || undefined,
          custo: parseFloat(form.custo), valor_venda: parseFloat(form.valor_venda),
          tipo: form.tipo, quantidade_inicial: parseInt(form.quantidade_inicial) || 0,
          quantidade_minima: parseInt(form.quantidade_minima) || 0,
        });
      }
      setShowForm(false);
      await loadItems(filterType || undefined);
      await loadSummary();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este item?')) return;
    try {
      await api.delete(`/inventory/${id}`);
      await loadItems(filterType || undefined);
      await loadSummary();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir');
    }
  }

  async function handleMovSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMovSaving(true);
    try {
      await api.post(`/inventory/${movForm.item_id}/movements`, {
        tipo: movForm.tipo,
        quantidade: parseInt(movForm.quantidade),
        notas: movForm.notas || undefined,
      });
      setShowMov(false);
      setMovForm(emptyMov);
      await loadItems(filterType || undefined);
      await loadSummary();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro na movimentação');
    } finally { setMovSaving(false); }
  }

  function upd(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })); }

  if (loading) return <div className="loading">Carregando...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Estoque</h1>
        <div className="row-actions">
          <button className="btn btn-primary" onClick={startCreate}>Novo Item</button>
          <button className="btn" onClick={() => { setShowMov(true); setMovForm(emptyMov); }}>Movimentação</button>
        </div>
      </div>
      {error && <p className="error-msg">{error}</p>}

      {summary && (
        <div className="summary-row">
          <div className="summary-card"><div className="label">Total de Itens</div><div className="value">{summary.total_items}</div></div>
          <div className="summary-card"><div className="label">Itens de Uso</div><div className="value">{summary.total_uso}</div></div>
          <div className="summary-card"><div className="label">Itens de Venda</div><div className="value">{summary.total_venda}</div></div>
          <div className="summary-card"><div className="label">Estoque Baixo</div><div className="value" style={{ color: summary.low_stock_count > 0 ? '#dc2626' : undefined }}>{summary.low_stock_count}</div></div>
        </div>
      )}

      <div className="filter-pills">
        <button className={`filter-pill${filterType === '' ? ' active' : ''}`} onClick={() => applyTypeFilter('')}>Todos</button>
        <button className={`filter-pill${filterType === 'USO' ? ' active' : ''}`} onClick={() => applyTypeFilter('USO')}>Uso</button>
        <button className={`filter-pill${filterType === 'VENDA' ? ' active' : ''}`} onClick={() => applyTypeFilter('VENDA')}>Venda</button>
        <button className={`filter-pill danger${lowStockOnly ? ' active' : ''}`} onClick={() => setLowStockOnly(v => !v)}>⚠ Estoque Baixo</button>
      </div>

      <div className="search-bar">
        <input className="search-input" placeholder="Buscar por nome ou descrição..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {showMov && (
        <div className="form-panel">
          <h2>Nova Movimentação</h2>
          <form onSubmit={handleMovSubmit}>
            <div className="form-row">
              <label className="flex-grow">Item *
                <select value={movForm.item_id} onChange={e => setMovForm(p => ({ ...p, item_id: e.target.value }))} required>
                  <option value="">Selecione...</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.nome} ({i.tipo})</option>)}
                </select>
              </label>
              <label>Tipo *
                <select value={movForm.tipo} onChange={e => setMovForm(p => ({ ...p, tipo: e.target.value }))}>
                  <option value="ENTRADA">Entrada</option>
                  <option value="SAIDA_USO">Saída Uso</option>
                  <option value="SAIDA_VENDA">Saída Venda</option>
                </select>
              </label>
              <label>Quantidade *<input type="number" min={1} value={movForm.quantidade} onChange={e => setMovForm(p => ({ ...p, quantidade: e.target.value }))} required /></label>
            </div>
            <label>Notas<input value={movForm.notas} onChange={e => setMovForm(p => ({ ...p, notas: e.target.value }))} /></label>
            <div className="form-row">
              <button type="submit" className="btn btn-primary" disabled={movSaving}>{movSaving ? 'Salvando...' : 'Registrar'}</button>
              <button type="button" className="btn" onClick={() => setShowMov(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {showForm && (
        <div className="form-panel">
          <h2>{editId ? 'Editar Item' : 'Novo Item'}</h2>
          <form onSubmit={handleSubmit}>
            <label>Nome *<input value={form.nome} onChange={e => upd('nome', e.target.value)} required /></label>
            <label>Descrição<input value={form.descricao} onChange={e => upd('descricao', e.target.value)} /></label>
            <div className="form-row">
              <label className="flex-grow">Custo (R$) *<input type="number" step="0.01" value={form.custo} onChange={e => upd('custo', e.target.value)} required /></label>
              <label className="flex-grow">Valor Venda (R$) *<input type="number" step="0.01" value={form.valor_venda} onChange={e => upd('valor_venda', e.target.value)} required /></label>
            </div>
            <div className="form-row">
              {!editId && (
                <label>Tipo *
                  <select value={form.tipo} onChange={e => upd('tipo', e.target.value)}>
                    <option value="USO">Uso</option>
                    <option value="VENDA">Venda</option>
                  </select>
                </label>
              )}
              {!editId && <label>Quantidade Inicial *<input type="number" min={0} value={form.quantidade_inicial} onChange={e => upd('quantidade_inicial', e.target.value)} required /></label>}
              <label>Quantidade Mínima<input type="number" min={0} value={form.quantidade_minima} onChange={e => upd('quantidade_minima', e.target.value)} /></label>
            </div>
            <div className="form-row">
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="empty">{search || lowStockOnly ? 'Nenhum item encontrado.' : 'Nenhum item no estoque.'}</p>
      ) : (
        <div className="item-cards">
          {filtered.map(item => {
            const isLow = item.quantidade_atual <= item.quantidade_minima;
            return (
              <div className="item-card" key={item.id} style={isLow ? { borderColor: '#fca5a5', borderWidth: 2 } : undefined}>
                <div className="item-card-header">
                  <div>
                    <div className="item-card-title">{item.nome}</div>
                    {item.descricao && <div className="item-card-subtitle">{item.descricao}</div>}
                  </div>
                  <span className={`badge ${item.tipo === 'USO' ? 'badge-blue' : 'badge-yellow'}`}>{item.tipo}</span>
                </div>
                <div className="item-card-body">
                  <div className="item-card-row">
                    <span className="item-card-label">Custo</span>
                    <span className="item-card-value">R$ {Number(item.custo).toFixed(2)}</span>
                  </div>
                  <div className="item-card-row">
                    <span className="item-card-label">Valor Venda</span>
                    <span className="item-card-value">R$ {Number(item.valor_venda).toFixed(2)}</span>
                  </div>
                  <div className="item-card-row">
                    <span className="item-card-label">Qtd Atual</span>
                    <span className="item-card-value" style={isLow ? { color: '#dc2626', fontWeight: 700 } : undefined}>{item.quantidade_atual}</span>
                  </div>
                  <div className="item-card-row">
                    <span className="item-card-label">Qtd Mínima</span>
                    <span className="item-card-value">{item.quantidade_minima}</span>
                  </div>
                </div>
                {isLow && (
                  <div className="item-card-meta"><span style={{ color: '#dc2626' }}>⚠️ Estoque baixo</span></div>
                )}
                <div className="item-card-actions">
                  <button className="btn btn-sm" onClick={() => startEdit(item)}>Editar</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>Excluir</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {nextCursor && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button className="btn" onClick={loadMore}>Ver mais</button>
        </div>
      )}
    </div>
  );
}
