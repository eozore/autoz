import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { Card } from '../../design-system/components/Card';
import { Badge } from '../../design-system/components/Badge';

/* ── Types ─────────────────────────────────────────── */

interface Review {
  id: string;
  rating: number;
  comment: string;
  customerName: string;
  vehicleDescription: string;
  createdAt: string;
  isPlaceholder: boolean;
}

interface PublicReviewsResponse {
  reviews: Review[];
  aggregateRating: number | null;
  totalCount: number;
  isPlaceholder: boolean;
}

interface ReviewSectionProps {
  slug: string;
}

/* ── Helpers ───────────────────────────────────────── */

function StarRating({ rating, size = '0.9rem' }: { rating: number; size?: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: '2px' }} aria-label={`${rating} de 5 estrelas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          style={{ color: i < rating ? '#f59e0b' : 'var(--ds-color-text-muted)', fontSize: size }}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </span>
  );
}

function formatRelativeDate(isoDate: string): string {
  const now = new Date();
  const date = new Date(isoDate);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Há 1 dia';
  if (diffDays < 7) return `Há ${diffDays} dias`;
  if (diffDays < 14) return 'Há 1 semana';
  if (diffDays < 30) return `Há ${Math.floor(diffDays / 7)} semanas`;
  if (diffDays < 60) return 'Há 1 mês';
  return `Há ${Math.floor(diffDays / 30)} meses`;
}

/* ── Component ─────────────────────────────────────── */

export function ReviewSection({ slug }: ReviewSectionProps) {
  const [data, setData] = useState<PublicReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function fetchReviews() {
      try {
        const response = await api.get<PublicReviewsResponse>(`/public/${slug}/reviews`);
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

    fetchReviews();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  /* ── Loading state ── */
  if (loading) {
    return (
      <section style={{ marginBottom: 'var(--ds-space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-2)', marginBottom: 'var(--ds-space-5)' }}>
          <span style={{ fontSize: '1.25rem' }}>⭐</span>
          <h2 style={{
            fontSize: 'var(--ds-font-size-xl)',
            fontWeight: 'var(--ds-font-weight-extrabold)',
            color: 'var(--ds-color-text-primary)',
            margin: 0,
          }}>
            Avaliações
          </h2>
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--ds-space-4)',
        }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                background: 'var(--ds-color-bg-muted)',
                borderRadius: 'var(--ds-radius-lg)',
                height: '120px',
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
    return (
      <section style={{ marginBottom: 'var(--ds-space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-2)', marginBottom: 'var(--ds-space-5)' }}>
          <span style={{ fontSize: '1.25rem' }}>⭐</span>
          <h2 style={{
            fontSize: 'var(--ds-font-size-xl)',
            fontWeight: 'var(--ds-font-weight-extrabold)',
            color: 'var(--ds-color-text-primary)',
            margin: 0,
          }}>
            Avaliações
          </h2>
        </div>
        <Card variant="outlined">
          <p style={{
            textAlign: 'center',
            color: 'var(--ds-color-text-secondary)',
            fontSize: 'var(--ds-font-size-sm)',
            margin: 0,
            padding: 'var(--ds-space-4)',
          }}>
            Não foi possível carregar as avaliações no momento.
          </p>
        </Card>
      </section>
    );
  }

  const { reviews, aggregateRating, totalCount, isPlaceholder } = data;

  // Don't show the section if there are no reviews
  if (reviews.length === 0) {
    return null;
  }

  return (
    <section style={{ marginBottom: 'var(--ds-space-8)' }}>
      {/* Section Header with Aggregate Rating */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 'var(--ds-space-3)',
        marginBottom: 'var(--ds-space-5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-2)' }}>
          <span style={{ fontSize: '1.25rem' }}>⭐</span>
          <h2 style={{
            fontSize: 'var(--ds-font-size-xl)',
            fontWeight: 'var(--ds-font-weight-extrabold)',
            color: 'var(--ds-color-text-primary)',
            margin: 0,
          }}>
            Avaliações
          </h2>
        </div>

        {aggregateRating !== null && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--ds-space-2)',
          }}>
            <span style={{
              fontSize: 'var(--ds-font-size-2xl)',
              fontWeight: 'var(--ds-font-weight-bold)',
              color: 'var(--ds-color-text-primary)',
            }}>
              {aggregateRating.toFixed(1)}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <StarRating rating={Math.round(aggregateRating)} size="1rem" />
              <span style={{
                fontSize: 'var(--ds-font-size-xs)',
                color: 'var(--ds-color-text-muted)',
              }}>
                {totalCount} {totalCount === 1 ? 'avaliação' : 'avaliações'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Placeholder indicator */}
      {isPlaceholder && (
        <div style={{ marginBottom: 'var(--ds-space-4)' }}>
          <Badge variant="info" size="sm">
            Exemplos de avaliações
          </Badge>
        </div>
      )}

      {/* Reviews List */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ds-space-4)',
      }}>
        {reviews.map((review) => (
          <Card key={review.id} variant="default" padded>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 'var(--ds-space-2)',
            }}>
              <div>
                <strong style={{
                  display: 'block',
                  fontSize: 'var(--ds-font-size-sm)',
                  fontWeight: 'var(--ds-font-weight-semibold)',
                  color: 'var(--ds-color-text-primary)',
                }}>
                  {review.customerName}
                </strong>
                <span style={{
                  fontSize: 'var(--ds-font-size-xs)',
                  color: 'var(--ds-color-text-secondary)',
                }}>
                  {review.vehicleDescription}
                </span>
              </div>
              <span style={{
                fontSize: 'var(--ds-font-size-xs)',
                color: 'var(--ds-color-text-muted)',
              }}>
                {formatRelativeDate(review.createdAt)}
              </span>
            </div>

            <div style={{ marginBottom: 'var(--ds-space-2)' }}>
              <StarRating rating={review.rating} />
            </div>

            <p style={{
              fontSize: 'var(--ds-font-size-sm)',
              color: 'var(--ds-color-text-secondary)',
              lineHeight: 'var(--ds-line-height-normal)',
              margin: 0,
            }}>
              &ldquo;{review.comment}&rdquo;
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}
