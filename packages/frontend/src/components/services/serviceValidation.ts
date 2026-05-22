/**
 * Service form field validation logic.
 * Validates fields on blur with <300ms feedback.
 */

export interface ValidationResult {
  valid: boolean;
  error: string;
}

/**
 * Validates the 'nome' field.
 * Required — must not be empty or whitespace-only.
 */
export function validateNome(value: string): ValidationResult {
  if (!value.trim()) {
    return { valid: false, error: 'Nome é obrigatório' };
  }
  return { valid: true, error: '' };
}

/**
 * Validates the 'duracao_minutos' field.
 * Required, must be an integer >= 5 and <= 480.
 */
export function validateDuracaoMinutos(value: string): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, error: 'Duração é obrigatória' };
  }
  const num = parseInt(trimmed, 10);
  if (isNaN(num)) {
    return { valid: false, error: 'Duração é obrigatória' };
  }
  if (num < 5) {
    return { valid: false, error: 'Duração mínima: 5 minutos' };
  }
  if (num > 480) {
    return { valid: false, error: 'Duração máxima: 480 minutos' };
  }
  return { valid: true, error: '' };
}

/**
 * Validates the 'valor' field.
 * Optional — but if provided, must be >= 0.
 */
export function validateValor(value: string): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    // valor is optional
    return { valid: true, error: '' };
  }
  const num = parseFloat(trimmed);
  if (isNaN(num) || num < 0) {
    return { valid: false, error: 'Valor deve ser maior ou igual a zero' };
  }
  return { valid: true, error: '' };
}

/**
 * Validates a service form field by name.
 */
export function validateServiceField(field: string, value: string): ValidationResult {
  switch (field) {
    case 'nome':
      return validateNome(value);
    case 'duracao_minutos':
      return validateDuracaoMinutos(value);
    case 'valor':
      return validateValor(value);
    default:
      return { valid: true, error: '' };
  }
}
