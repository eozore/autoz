import { useState, useEffect, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import api, { ApiError } from '../lib/api';

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

/* ── Booking steps ─────────────────────────────────── */

type BookingStep = 'idle' | 'date' | 'slots' | 'form' | 'success';

/* ── Component ─────────────────────────────────────── */

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
      // Reload slots if we're already in the booking flow
      if (selectedDate && selectedService) {
        setSelectedSlot('');
        setStep('slots');
        // We need to load slots with the new location
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
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  function formatAddress(loc: PublicLocation) {
    let addr = `${loc.endereco_rua}, ${loc.endereco_numero}`;
    if (loc.endereco_complemento) addr += ` - ${loc.endereco_complemento}`;
    addr += `, ${loc.endereco_bairro} - ${loc.endereco_cidade}/${loc.endereco_estado}`;
    return addr;
  }

  /* ── Render: loading / 404 ─────────────────────── */

  if (loading) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#888' }}>Carregando...</p>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div style={styles.center}>
        <div style={styles.card404}>
          <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>404</h1>
          <p style={{ color: '#666', fontSize: '1.1rem' }}>Estabelecimento não encontrado</p>
          <p style={{ color: '#999', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Verifique o endereço e tente novamente.
          </p>
        </div>
      </div>
    );
  }

  /* ── Render: main page ─────────────────────────── */

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          {profile.logo_url && (
            <img
              src={profile.logo_url.startsWith('http') ? profile.logo_url : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${profile.logo_url}`}
              alt={`Logo ${profile.nome}`}
              style={styles.logo}
            />
          )}
          <div>
            <h1 style={styles.companyName}>{profile.nome}</h1>
            {profile.descricao && (
              <p style={styles.description}>{profile.descricao}</p>
            )}
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {/* WhatsApp button */}
        {whatsappLink && (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.whatsappBtn}
          >
            💬 Chamar no WhatsApp
          </a>
        )}

        {/* Location selector */}
        {locations.length > 1 && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Escolha a Unidade</h2>
            <div style={styles.locationsGrid}>
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  style={{
                    ...styles.locationCard,
                    ...(selectedLocation?.id === loc.id ? styles.locationCardSelected : {}),
                  }}
                  onClick={() => handleLocationChange(loc.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleLocationChange(loc.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>📍 {loc.endereco_rua}, {loc.endereco_numero}</span>
                    {loc.is_primary && <span style={styles.primaryBadge}>Principal</span>}
                  </div>
                  <p style={{ color: '#666', fontSize: '0.85rem', margin: '0.15rem 0' }}>
                    {loc.endereco_bairro} - {loc.endereco_cidade}/{loc.endereco_estado}
                  </p>
                  <p style={{ color: '#888', fontSize: '0.82rem', margin: '0.15rem 0' }}>
                    🕐 {loc.horario_abertura} - {loc.horario_fechamento}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Single location info */}
        {locations.length === 1 && selectedLocation && (
          <div style={styles.locationInfo}>
            <span>📍 {formatAddress(selectedLocation)}</span>
            <span style={{ marginLeft: '1rem', color: '#888' }}>🕐 {selectedLocation.horario_abertura} - {selectedLocation.horario_fechamento}</span>
          </div>
        )}

        {/* Services */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Nossos Serviços</h2>
          {services.length === 0 ? (
            <p style={{ color: '#888', fontStyle: 'italic' }}>Nenhum serviço disponível no momento.</p>
          ) : (
            <div style={styles.servicesGrid}>
              {services.map((svc) => (
                <div
                  key={svc.id}
                  style={{
                    ...styles.serviceCard,
                    ...(selectedService?.id === svc.id ? styles.serviceCardSelected : {}),
                  }}
                  onClick={() => handleSelectService(svc)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelectService(svc)}
                >
                  {svc.foto_url && (
                    <img src={svc.foto_url.startsWith('http') ? svc.foto_url : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${svc.foto_url}`} alt={svc.nome} style={styles.serviceImg} />
                  )}
                  <div style={styles.serviceInfo}>
                    <h3 style={styles.serviceName}>{svc.nome}</h3>
                    {svc.descricao && <p style={styles.serviceDesc}>{svc.descricao}</p>}
                    <span style={styles.serviceDuration}>⏱ {svc.duracao_minutos} min</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ff914d' }}>
                      {svc.valor != null ? `R$ ${Number(svc.valor).toFixed(2).replace('.', ',')}` : 'Sob consulta'}
                    </span>
                  </div>
                  <button
                    style={styles.bookBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectService(svc);
                    }}
                  >
                    Agendar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Booking flow */}
        {step !== 'idle' && (
          <section style={styles.bookingSection} id="booking">
            <h2 style={styles.sectionTitle}>Agendamento</h2>

            {error && <p style={styles.errorMsg}>{error}</p>}

            {/* Step indicator */}
            <div style={styles.steps}>
              <span style={step === 'date' || step === 'slots' || step === 'form' || step === 'success' ? styles.stepActive : styles.stepInactive}>
                1. Serviço
              </span>
              <span style={step === 'slots' || step === 'form' || step === 'success' ? styles.stepActive : styles.stepInactive}>
                2. Data
              </span>
              <span style={step === 'form' || step === 'success' ? styles.stepActive : styles.stepInactive}>
                3. Horário
              </span>
              <span style={step === 'success' ? styles.stepActive : styles.stepInactive}>
                4. Confirmar
              </span>
            </div>

            {/* Selected service & location summary */}
            {selectedService && (
              <div style={styles.selectedSummary}>
                <strong>{selectedService.nome}</strong> — {selectedService.duracao_minutos} min
                {selectedLocation && (
                  <div style={{ fontSize: '0.85rem', color: '#555', marginTop: '0.25rem' }}>
                    📍 {formatAddress(selectedLocation)}
                  </div>
                )}
              </div>
            )}

            {/* Date picker */}
            {(step === 'date' || step === 'slots' || step === 'form') && (
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Escolha a data:</label>
                <input
                  type="date"
                  min={todayStr()}
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  style={styles.input}
                />
              </div>
            )}

            {/* Slots */}
            {(step === 'slots' || step === 'form') && selectedDate && (
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Horários disponíveis:</label>
                {slotsLoading ? (
                  <p style={{ color: '#888' }}>Carregando horários...</p>
                ) : slots.length === 0 ? (
                  <p style={{ color: '#888', fontStyle: 'italic' }}>
                    Nenhum horário disponível nesta data.
                  </p>
                ) : (
                  <div style={styles.slotsGrid}>
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        style={{
                          ...styles.slotBtn,
                          ...(selectedSlot === slot ? styles.slotBtnSelected : {}),
                        }}
                        onClick={() => handleSelectSlot(slot)}
                        type="button"
                      >
                        {formatTime(slot)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Visitor form */}
            {step === 'form' && selectedSlot && (
              <form onSubmit={handleSubmit} style={styles.form}>
                <p style={{ fontSize: '0.9rem', color: '#555', marginBottom: '0.5rem' }}>
                  {formatDate(selectedSlot)} às {formatTime(selectedSlot)}
                </p>
                <label style={styles.label}>
                  Seu nome *
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    placeholder="Nome completo"
                    style={styles.input}
                  />
                </label>
                <label style={styles.label}>
                  Seu celular *
                  <input
                    type="tel"
                    value={celular}
                    onChange={(e) => setCelular(e.target.value)}
                    required
                    placeholder="+5511999999999"
                    style={styles.input}
                  />
                </label>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={styles.confirmBtn}
                  >
                    {submitting ? 'Agendando...' : 'Confirmar Agendamento'}
                  </button>
                  <button type="button" onClick={resetBooking} style={styles.cancelBtn}>
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {/* Success */}
            {step === 'success' && (
              <div style={styles.successBox}>
                <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✅</p>
                <h3 style={{ marginBottom: '0.5rem' }}>Agendamento confirmado!</h3>
                <p style={{ color: '#555', fontSize: '0.9rem' }}>
                  Você receberá a confirmação em breve. Obrigado!
                </p>
                <button onClick={resetBooking} style={{ ...styles.confirmBtn, marginTop: '1rem' }}>
                  Fazer outro agendamento
                </button>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <p>© {new Date().getFullYear()} {profile.nome}</p>
      </footer>
    </div>
  );
}


/* ── Styles ──────────────────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#f8f9fa',
  },
  center: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  card404: {
    textAlign: 'center' as const,
    background: '#fff',
    borderRadius: '12px',
    padding: '3rem 2rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    maxWidth: '400px',
  },
  header: {
    background: '#fff',
    borderBottom: '1px solid #e5e5e5',
    padding: '1.5rem 1rem',
  },
  headerInner: {
    maxWidth: '800px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  logo: {
    width: '64px',
    height: '64px',
    borderRadius: '12px',
    objectFit: 'cover' as const,
    flexShrink: 0,
  },
  companyName: {
    fontSize: '1.4rem',
    fontWeight: 700,
    margin: 0,
  },
  description: {
    color: '#666',
    fontSize: '0.95rem',
    marginTop: '0.25rem',
  },
  main: {
    flex: 1,
    maxWidth: '800px',
    margin: '0 auto',
    width: '100%',
    padding: '1.5rem 1rem',
  },
  whatsappBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: '#25d366',
    color: '#fff',
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '1rem',
    textDecoration: 'none',
    marginBottom: '1.5rem',
    transition: 'background 0.15s',
  },
  section: {
    marginBottom: '2rem',
  },
  sectionTitle: {
    fontSize: '1.15rem',
    fontWeight: 600,
    marginBottom: '1rem',
  },
  locationsGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  locationCard: {
    background: '#fff',
    borderRadius: '10px',
    padding: '0.75rem 1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    cursor: 'pointer',
    border: '2px solid transparent',
    transition: 'border-color 0.15s',
  },
  locationCardSelected: {
    borderColor: '#ff914d',
  },
  primaryBadge: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: '#fff',
    background: '#22c55e',
    padding: '0.1rem 0.5rem',
    borderRadius: '9999px',
  },
  locationInfo: {
    background: '#fff',
    borderRadius: '10px',
    padding: '0.75rem 1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    fontSize: '0.88rem',
    color: '#555',
    marginBottom: '1.5rem',
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
  },
  servicesGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  serviceCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    background: '#fff',
    borderRadius: '10px',
    padding: '1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    cursor: 'pointer',
    border: '2px solid transparent',
    transition: 'border-color 0.15s',
  },
  serviceCardSelected: {
    borderColor: '#ff914d',
  },
  serviceImg: {
    width: '56px',
    height: '56px',
    borderRadius: '8px',
    objectFit: 'cover' as const,
    flexShrink: 0,
  },
  serviceInfo: {
    flex: 1,
    minWidth: 0,
  },
  serviceName: {
    fontSize: '1rem',
    fontWeight: 600,
    margin: 0,
  },
  serviceDesc: {
    fontSize: '0.85rem',
    color: '#666',
    marginTop: '0.2rem',
  },
  serviceDuration: {
    fontSize: '0.8rem',
    color: '#888',
  },
  bookBtn: {
    background: '#ff914d',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '0.4rem 1rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  bookingSection: {
    background: '#fff',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    marginBottom: '2rem',
  },
  steps: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1.25rem',
    flexWrap: 'wrap' as const,
  },
  stepActive: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#ff914d',
    background: '#eff6ff',
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
  },
  stepInactive: {
    fontSize: '0.8rem',
    color: '#aaa',
    padding: '0.25rem 0.75rem',
  },
  selectedSummary: {
    background: '#f0f9ff',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    fontSize: '0.9rem',
    marginBottom: '1rem',
  },
  fieldGroup: {
    marginBottom: '1rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.3rem',
    fontSize: '0.9rem',
    fontWeight: 500,
    marginBottom: '0.75rem',
  },
  input: {
    padding: '0.5rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.95rem',
    fontFamily: 'inherit',
  },
  slotsGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
  },
  slotBtn: {
    padding: '0.5rem 1rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  slotBtnSelected: {
    background: '#ff914d',
    color: '#fff',
    borderColor: '#ff914d',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  confirmBtn: {
    background: '#ff914d',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '0.6rem 1.5rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  cancelBtn: {
    background: '#fff',
    color: '#555',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    padding: '0.6rem 1.5rem',
    fontSize: '0.95rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  successBox: {
    textAlign: 'center' as const,
    padding: '2rem 1rem',
  },
  errorMsg: {
    background: '#fef2f2',
    color: '#dc2626',
    padding: '0.75rem',
    borderRadius: '6px',
    fontSize: '0.9rem',
    marginBottom: '1rem',
  },
  footer: {
    textAlign: 'center' as const,
    padding: '1.5rem 1rem',
    color: '#999',
    fontSize: '0.85rem',
    borderTop: '1px solid #e5e5e5',
  },
};
