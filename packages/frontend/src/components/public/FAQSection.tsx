import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { Card } from '../../design-system/components/Card';
import { Badge } from '../../design-system/components/Badge';

/* ── Types ─────────────────────────────────────────── */

interface FAQ {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
}

interface PublicFAQsResponse {
  faqs: FAQ[];
  isFallback: boolean;
}

export interface FAQSectionProps {
  slug: string;
}

/* ── Component ─────────────────────────────────────── */

export function FAQSection({ slug }: FAQSectionProps) {
  const [data, setData] = useState<PublicFAQsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function fetchFAQs() {
      try {
        const response = await api.get<PublicFAQsResponse>(`/public/${slug}/faqs`);
        if (!cancelled) {
          setData(response);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchFAQs();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  /* ── Loading state ── */
  if (loading) {
    return (
      <section style={{ marginBottom: 'var(--ds-space-8)' }}>
        <div style={headerStyles}>
          <span style={{ fontSize: '1.25rem' }}>❓</span>
          <h2 style={titleStyles}>Perguntas Frequentes</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)' }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                background: 'var(--ds-color-bg-muted)',
                borderRadius: 'var(--ds-radius-lg)',
                height: '56px',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      </section>
    );
  }

  /* ── Error state ── */
  if (error || !data) {
    return null;
  }

  const { faqs, isFallback } = data;

  if (faqs.length === 0) {
    return null;
  }

  function toggleFAQ(index: number) {
    setActiveIndex((prev) => (prev === index ? null : index));
  }

  return (
    <section style={{ marginBottom: 'var(--ds-space-8)' }}>
      {/* Section Header */}
      <div style={{ ...headerStyles, marginBottom: 'var(--ds-space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-2)' }}>
          <span style={{ fontSize: '1.25rem' }}>❓</span>
          <h2 style={titleStyles}>Perguntas Frequentes</h2>
        </div>
        {isFallback && (
          <Badge variant="info" size="sm">
            Conteúdo padrão
          </Badge>
        )}
      </div>

      {/* FAQ Accordion */}
      <Card variant="outlined" padded>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {faqs.map((faq, index) => {
            const isOpen = activeIndex === index;
            const isLast = index === faqs.length - 1;

            return (
              <div
                key={faq.id}
                style={{
                  borderBottom: isLast ? 'none' : '1px solid var(--ds-color-border-light)',
                }}
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${faq.id}`}
                  style={questionButtonStyles}
                >
                  <span style={questionTextStyles}>{faq.question}</span>
                  <span
                    style={{
                      fontSize: 'var(--ds-font-size-sm)',
                      color: 'var(--ds-color-text-muted)',
                      transition: 'transform 0.2s ease',
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                    }}
                    aria-hidden="true"
                  >
                    ▼
                  </span>
                </button>
                {isOpen && (
                  <div
                    id={`faq-answer-${faq.id}`}
                    role="region"
                    style={answerStyles}
                  >
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}

/* ── Styles ────────────────────────────────────────── */

const headerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 'var(--ds-space-2)',
};

const titleStyles: React.CSSProperties = {
  fontSize: 'var(--ds-font-size-xl)',
  fontWeight: 'var(--ds-font-weight-extrabold)',
  color: 'var(--ds-color-text-primary)',
  margin: 0,
};

const questionButtonStyles: React.CSSProperties = {
  width: '100%',
  background: 'none',
  border: 'none',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 'var(--ds-space-4) 0',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'var(--ds-font-family)',
};

const questionTextStyles: React.CSSProperties = {
  fontSize: 'var(--ds-font-size-base)',
  fontWeight: 'var(--ds-font-weight-semibold)',
  color: 'var(--ds-color-text-primary)',
  paddingRight: 'var(--ds-space-4)',
};

const answerStyles: React.CSSProperties = {
  paddingBottom: 'var(--ds-space-4)',
  fontSize: 'var(--ds-font-size-sm)',
  color: 'var(--ds-color-text-secondary)',
  lineHeight: 'var(--ds-line-height-normal)',
};
