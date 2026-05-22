import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../design-system/components/EmptyState';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <EmptyState
      icon={<span>🔍</span>}
      title="Página não encontrada"
      description="A página que você procura não existe ou foi movida."
      actionLabel="Voltar ao Painel"
      onAction={() => navigate('/dashboard')}
    />
  );
}
