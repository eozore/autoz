/**
 * Calcula o intervalo padrão de ±30 dias a partir da data atual.
 * Usado como filtro padrão quando start/end não são fornecidos.
 */
export function getDefaultDateRange(): { start: Date; end: Date } {
  const now = new Date();

  const start = new Date(now);
  start.setDate(start.getDate() - 30);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setDate(end.getDate() + 30);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}
