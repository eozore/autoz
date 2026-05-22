import { useState, useEffect, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import api, { ApiError } from '../lib/api';
import { ReviewSection } from '../components/public/ReviewSection';
import { LiquiditySignals } from '../components/public/LiquiditySignals';
import { TrustBadges } from '../components/public/TrustBadges';
import { FAQSection } from '../components/public/FAQSection';

/* ── Types ─────────────────────────────────────────── */

interface Profile {
  nome: string;
  logo_url: string | null;
  descricao: string | null;
}

interface PublicService {
  id: string;
  nome: string;
  descricao: string | null;
  foto_url: string | null;
  duracao_minutos: number;
  valor: number | null;
  categoria: string | null;
}

interface PublicLocation {
  id: string;
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

type BookingStep = 'idle' | 'date' | 'slots' | 'form' | 'success';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function PublicPage() {
  const { slug } = useParams<{ slug: string }>();

  // Profile & services
  const [profile, setProfile] = useState<Profile | null>(null);
  const [services, setServices] = useState<PublicService[]>([]);
  const [locations, setLocations] = useState<PublicLocation[]>([]);
  const [whatsappLink, setWhatsappLink] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  // Location selection
  const [selectedLocation, setSelectedLocation] = useState<PublicLocation | null>(null);

  // Booking flow
  const [step, setStep] = useState<BookingStep>('idle');
  const [selectedService, setSelectedService] = useState<PublicService | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [nome, setNome] = useState('');
  const [celular, setCelular] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');



  /* ── Load profile, services, locations, whatsapp ── */

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const [p, s, w, l] = await Promise.all([
          api.get<Profile>(`/public/${slug}/profile`),
          api.get<PublicService[]>(`/public/${slug}/services`),
          api.get<{ link: string }>(`/public/${slug}/whatsapp`),
          api.get<PublicLocation[]>(`/public/${slug}/locations`),
        ]);
        setProfile(p);
        setServices(s);
        setWhatsappLink(w.link);
        setLocations(l);
        // Auto-select primary or first location
        const primary = l.find((loc) => loc.is_primary) || l[0];
        if (primary) setSelectedLocation(primary);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  /* ── Load slots when date changes ──────────────── */

  async function loadSlots(serviceId: string, date: string) {
    setSlotsLoading(true);
    setSlots([]);
    setError('');
    try {
      const locParam = selectedLocation ? `&location_id=${selectedLocation.id}` : '';
      const data = await api.get<string[]>(
        `/public/${slug}/slots?service_id=${serviceId}&date=${date}${locParam}`,
      );
      setSlots(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar horários');
    } finally {
      setSlotsLoading(false);
    }
  }

  /* ── Booking handlers ──────────────────────────── */

  function handleSelectService(svc: PublicService) {
    setSelectedService(svc);
    setSelectedDate('');
    setSelectedSlot('');
    setSlots([]);
    setNome('');
    setCelular('');
    setError('');
    setStep('date');
    setTimeout(() => {
      document.getElementById('booking-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function handleDateChange(date: string) {
    setSelectedDate(date);
    setSelectedSlot('');
    if (date && selectedService) {
      loadSlots(selectedService.id, date);
      setStep('slots');
    }
  }

  function handleSelectSlot(slot: string) {
    setSelectedSlot(slot);
    setStep('form');
  }

  function handleLocationChange(locId: string) {
    const loc = locations.find((l) => l.id === locId);
    if (loc) {
      setSelectedLocation(loc);
      if (selectedDate && selectedService) {
        setSelectedSlot('');
        setStep('slots');
        setSlotsLoading(true);
        setSlots([]);
        setError('');
        const locParam = `&location_id=${loc.id}`;
        api.get<string[]>(
          `/public/${slug}/slots?service_id=${selectedService.id}&date=${selectedDate}${locParam}`,
        ).then((data) => {
          setSlots(data);
        }).catch((err) => {
          setError(err instanceof ApiError ? err.message : 'Erro ao carregar horários');
        }).finally(() => {
          setSlotsLoading(false);
        });
      }
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedService || !selectedSlot) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/public/${slug}/appointments`, {
        nome_visitante: nome.trim(),
        celular_visitante: celular.trim(),
        service_id: selectedService.id,
        data_hora: selectedSlot,
        ...(selectedLocation ? { location_id: selectedLocation.id } : {}),
      });
      setStep('success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao agendar');
    } finally {
      setSubmitting(false);
    }
  }

  function resetBooking() {
    setStep('idle');
    setSelectedService(null);
    setSelectedDate('');
    setSelectedSlot('');
    setSlots([]);
    setNome('');
    setCelular('');
    setError('');
  }

  /* ── Helpers ───────────────────────────────────── */

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }

  function formatAddress(loc: PublicLocation) {
    let addr = `${loc.endereco_rua}, ${loc.endereco_numero}`;
    if (loc.endereco_complemento) addr += ` - ${loc.endereco_complemento}`;
    addr += `, ${loc.endereco_bairro} - ${loc.endereco_cidade}/${loc.endereco_estado}`;
    return addr;
  }

  const getCategory = (svc: PublicService): string => {
    if (svc.categoria) return svc.categoria;
    return 'Principais';
  };

  const groupedServices = (() => {
    const groups: Record<string, PublicService[]> = {};
    services.forEach(svc => {
      const cat = getCategory(svc);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(svc);
    });
    return Object.entries(groups).filter(([_, list]) => list.length > 0);
  })();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #ff914d', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Carregando dados da oficina...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '1.5rem' }}>
        <div style={{ textAlign: 'center', background: '#ffffff', borderRadius: '24px', padding: '4rem 2rem', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', maxWidth: '440px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>🔍</span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>Ops! Não Encontrado</h1>
          <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            Não encontramos nenhuma oficina ativa no endereço digitado. Verifique a URL e tente novamente.
          </p>
          <a href="/" style={{ display: 'inline-block', background: '#ff914d', color: '#ffffff', textDecoration: 'none', padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 600 }}>
            Voltar para o Início
          </a>
        </div>
      </div>
    );
  }





  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', fontFamily: '"Outfit", "Inter", sans-serif' }}>
      
      {/* Dynamic Header / Hero Banner */}
      <header style={{ background: 'linear-gradient(135deg, var(--primary, #ff914d) 0%, #e67a30 50%, #cc6520 100%)', padding: '3rem 1.5rem 2.5rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {profile.logo_url ? (
            <img
              src={profile.logo_url.startsWith('http') ? profile.logo_url : `${API_URL}${profile.logo_url}`}
              alt={`Logo ${profile.nome}`}
              style={{ width: '80px', height: '80px', borderRadius: '20px', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.3)', marginBottom: '1rem' }}
            />
          ) : (
            <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'rgba(255,255,255,0.2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem', border: '3px solid rgba(255,255,255,0.3)' }}>
              {profile.nome.substring(0, 1).toUpperCase()}
            </div>
          )}
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.75rem', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            {profile.nome}
          </h1>
          <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.9)', margin: '0 0 1.5rem', lineHeight: 1.6, maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
            {profile.descricao || 'Serviços automotivos e de motos especializados com garantia de qualidade.'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                const el = document.querySelector('.services-category-nav') || document.getElementById('cat-Revisão-&-Óleo');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              style={{ background: '#ffffff', color: 'var(--primary, #ff914d)', border: 'none', borderRadius: '12px', padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', transition: 'transform 0.2s' }}
            >
              Agendar Agora
            </button>
            {whatsappLink && (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '2px solid rgba(255,255,255,0.4)', borderRadius: '12px', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}>
                <span>💬</span> WhatsApp
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Grid container */}
      <main style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '2rem 1.5rem' }}>
        <div className="public-booking-container">
          
          {/* Left Content Column */}
          <div className="public-content-column">
            
            {/* Trust + Liquidity compact bar */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '2rem', padding: '1rem 1.25rem', background: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-base)', boxShadow: 'var(--shadow-sm)' }}>
              <TrustBadges slug={slug!} />
              <LiquiditySignals slug={slug!} />
            </div>

            {/* Location Selector */}
            {locations.length > 1 && (
              <section style={{ background: '#ffffff', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-base)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📍</span> Escolha a Unidade
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                  {locations.map((loc) => {
                    const isSel = selectedLocation?.id === loc.id;
                    return (
                      <div
                        key={loc.id}
                        onClick={() => handleLocationChange(loc.id)}
                        style={{
                          background: isSel ? '#fffbf7' : '#ffffff',
                          border: isSel ? '2px solid var(--primary)' : '1px solid var(--border-base)',
                          borderRadius: '12px',
                          padding: '1rem',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{loc.endereco_rua}, {loc.endereco_numero}</span>
                          {loc.is_primary && (
                            <span style={{ fontSize: '0.7rem', background: '#dcfce7', color: '#15803d', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontWeight: 600 }}>Principal</span>
                          )}
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0.25rem 0' }}>
                          {loc.endereco_bairro} - {loc.endereco_cidade}/{loc.endereco_estado}
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span>🕐</span> {loc.horario_abertura} às {loc.horario_fechamento}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Single Location Info */}
            {locations.length === 1 && selectedLocation && (
              <div style={{ background: '#ffffff', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '2rem', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-base)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                  📍 <strong>Unidade:</strong> {formatAddress(selectedLocation)}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  🕐 Segunda a Sexta: {selectedLocation.horario_abertura} - {selectedLocation.horario_fechamento}
                </span>
              </div>
            )}

            {/* Operating Hours - displayed above service list (Requirement 12.2) */}
            {selectedLocation && (
              <div className="public-operating-hours">
                <span className="public-operating-hours-icon">🕐</span>
                <span className="public-operating-hours-label">Horário de Funcionamento:</span>
                <span className="public-operating-hours-value">
                  {selectedLocation.horario_abertura} às {selectedLocation.horario_fechamento}
                </span>
              </div>
            )}

            {/* Category Navigation Bar (iFood style) */}
            {services.length > 0 && (
              <div className="services-category-nav">
                {groupedServices.map(([catName]) => (
                  <button
                    key={catName}
                    className="category-nav-btn"
                    onClick={() => {
                      const el = document.getElementById(`cat-${catName.replace(/\s+/g, '-')}`);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }
                    }}
                  >
                    {catName}
                  </button>
                ))}
              </div>
            )}

            {/* Services List Grouped by Category */}
            <section style={{ marginBottom: '2.5rem' }}>
              {services.length === 0 ? (
                <div style={{ background: '#111827', padding: '2.5rem 1.5rem', textAlign: 'center', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.06)', color: 'var(--text-secondary)' }}>
                  Nenhum serviço disponível para agendamento online neste momento.
                </div>
              ) : (
                groupedServices.map(([catName, list]) => (
                  <div key={catName} id={`cat-${catName.replace(/\s+/g, '-')}`} style={{ marginBottom: '2rem' }}>
                    <h3 className="services-category-title">
                      <span>🔧</span> {catName}
                    </h3>
                    <div className="services-horizontal-row">
                      {list.map((svc) => {
                        const isSel = selectedService?.id === svc.id;
                        const photoSrc = svc.foto_url
                          ? (svc.foto_url.startsWith('http') ? svc.foto_url : `${API_URL}${svc.foto_url}`)
                          : null;
                        return (
                          <div
                            key={svc.id}
                            className={`ifood-service-card ds-touch-feedback ${isSel ? 'selected' : ''}`}
                            onClick={() => handleSelectService(svc)}
                          >
                            <div className="ifood-service-img-wrapper">
                              {photoSrc ? (
                                <img src={photoSrc} alt={svc.nome} className="ifood-service-img" />
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', background: '#1f2937' }}>
                                  ⚙️
                                </div>
                              )}
                            </div>
                            <div className="ifood-service-body">
                              <h4 className="ifood-service-title">{svc.nome}</h4>
                              <p className="ifood-service-desc">{svc.descricao || 'Serviço profissional de alta qualidade.'}</p>
                              <div className="ifood-service-footer">
                                <span className="ifood-service-price">
                                  {svc.valor != null ? `R$ ${Number(svc.valor).toFixed(2).replace('.', ',')}` : 'Sob consulta'}
                                </span>
                                <span className="ifood-service-duration">
                                  ⏱ {svc.duracao_minutos}m
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </section>

            {/* Reviews section (API-driven with cold-start fallback) */}
            <ReviewSection slug={slug!} />

            {/* FAQ section (API-driven with fallback content) */}
            <FAQSection slug={slug!} />

          </div>

          {/* Right Sticky Booking Widget */}
          <div className="public-booking-sticky-column" id="booking-panel">
            <div className="booking-stepper-widget">
              
              {/* Stepper Header */}
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-base)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Agendamento Online</h3>
                {step !== 'idle' && step !== 'success' && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '9999px', fontWeight: 600, ...((step === 'date' || step === 'slots' || step === 'form') ? { background: '#ffe4e6', color: '#be123c' } : { background: '#f1f5f9', color: '#64748b' }) }}>
                      1. Data
                    </span>
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '9999px', fontWeight: 600, ...((step === 'slots' || step === 'form') ? { background: '#ffe4e6', color: '#be123c' } : { background: '#f1f5f9', color: '#64748b' }) }}>
                      2. Horário
                    </span>
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '9999px', fontWeight: 600, ...(step === 'form' ? { background: '#ffe4e6', color: '#be123c' } : { background: '#f1f5f9', color: '#64748b' }) }}>
                      3. Confirmação
                    </span>
                  </div>
                )}
              </div>

              {/* Stepper Body */}
              <div style={{ padding: '1.5rem' }}>
                {error && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#dc2626', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    {error}
                  </div>
                )}

                {/* State: Idle / No Service Selected */}
                {step === 'idle' && (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                    <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>📅</span>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                      Selecione um dos serviços da lista ao lado para iniciar o seu agendamento online.
                    </p>
                  </div>
                )}

                {/* Selected Service Detail Info */}
                {selectedService && step !== 'success' && (
                  <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1.25rem', borderLeft: '3px solid var(--primary)', fontSize: '0.88rem' }}>
                    <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{selectedService.nome}</strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      ⏱ {selectedService.duracao_minutos} min | {selectedService.valor != null ? `R$ ${Number(selectedService.valor).toFixed(2).replace('.', ',')}` : 'Valor sob consulta'}
                    </span>
                  </div>
                )}

                {/* Step 1: Select Date */}
                {(step === 'date' || step === 'slots' || step === 'form') && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>1. Selecione o Dia</label>
                    <input
                      type="date"
                      min={todayStr()}
                      value={selectedDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.75rem',
                        border: '1px solid var(--border-base)',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        fontFamily: 'inherit',
                        outline: 'none',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                )}

                {/* Step 2: Select Slot */}
                {(step === 'slots' || step === 'form') && selectedDate && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>2. Escolha o Horário</label>
                    {slotsLoading ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>Carregando horários...</p>
                    ) : slots.length === 0 ? (
                      <p style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 500, margin: 0 }}>Nenhum horário disponível para esta data.</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', padding: '0.25rem' }}>
                        {slots.map((slot) => {
                          const isSel = selectedSlot === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => handleSelectSlot(slot)}
                              style={{
                                padding: '0.5rem',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                background: isSel ? 'var(--primary)' : '#ffffff',
                                color: isSel ? '#ffffff' : 'var(--text-primary)',
                                border: isSel ? '1px solid var(--primary)' : '1px solid var(--border-base)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                            >
                              {formatTime(slot)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Identity Form */}
                {step === 'form' && selectedSlot && (
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                      🕒 {formatDate(selectedSlot)} às {formatTime(selectedSlot)}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>Nome Completo *</label>
                      <input
                        type="text"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                        placeholder="Como gostaria de ser chamado?"
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.75rem',
                          border: '1px solid var(--border-base)',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          fontFamily: 'inherit',
                          outline: 'none',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>WhatsApp / Celular *</label>
                      <input
                        type="tel"
                        value={celular}
                        onChange={(e) => setCelular(e.target.value)}
                        required
                        placeholder="(DDD) 99999-9999"
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.75rem',
                          border: '1px solid var(--border-base)',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          fontFamily: 'inherit',
                          outline: 'none',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        type="submit"
                        disabled={submitting}
                        style={{
                          flex: 1,
                          background: 'var(--primary)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '0.75rem 1rem',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {submitting ? 'Confirmando...' : 'Confirmar Reserva'}
                      </button>
                      <button
                        type="button"
                        onClick={resetBooking}
                        style={{
                          background: 'transparent',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-base)',
                          borderRadius: '8px',
                          padding: '0.75rem 1rem',
                          fontSize: '0.9rem',
                          cursor: 'pointer'
                        }}
                      >
                        Voltar
                      </button>
                    </div>
                  </form>
                )}

                {/* State: Success Message */}
                {step === 'success' && (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                    <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.75rem' }}>✅</span>
                    <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#166534', marginBottom: '0.5rem' }}>Agendamento Confirmado!</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 1.5rem 0' }}>
                      Seu agendamento foi registrado com sucesso. Você receberá um lembrete ou notificação em breve!
                    </p>
                    <button
                      onClick={resetBooking}
                      style={{
                        width: '100%',
                        background: 'var(--primary)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.75rem 1rem',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Realizar Novo Agendamento
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer style={{ background: '#ffffff', borderTop: '1px solid var(--border-base)', padding: '2rem 1.5rem', textAlign: 'center', marginTop: 'auto' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
          © {new Date().getFullYear()} <strong>{profile.nome}</strong>. Todos os direitos reservados.
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Desenvolvido com tecnologia de agendamento instantâneo.
        </p>
      </footer>
    </div>
  );
}
