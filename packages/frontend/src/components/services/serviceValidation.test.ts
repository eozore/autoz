import { describe, it, expect } from 'vitest';
import {
  validateNome,
  validateDuracaoMinutos,
  validateValor,
  validateServiceField,
} from './serviceValidation';

describe('serviceValidation', () => {
  describe('validateNome', () => {
    it('returns error when empty', () => {
      const result = validateNome('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Nome é obrigatório');
    });

    it('returns error when whitespace only', () => {
      const result = validateNome('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Nome é obrigatório');
    });

    it('returns valid for non-empty string', () => {
      const result = validateNome('Troca de Óleo');
      expect(result.valid).toBe(true);
      expect(result.error).toBe('');
    });
  });

  describe('validateDuracaoMinutos', () => {
    it('returns error when empty', () => {
      const result = validateDuracaoMinutos('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Duração é obrigatória');
    });

    it('returns error when not a number', () => {
      const result = validateDuracaoMinutos('abc');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Duração é obrigatória');
    });

    it('returns error when less than 5', () => {
      const result = validateDuracaoMinutos('4');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Duração mínima: 5 minutos');
    });

    it('returns error when greater than 480', () => {
      const result = validateDuracaoMinutos('481');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Duração máxima: 480 minutos');
    });

    it('returns valid for exactly 5', () => {
      const result = validateDuracaoMinutos('5');
      expect(result.valid).toBe(true);
      expect(result.error).toBe('');
    });

    it('returns valid for exactly 480', () => {
      const result = validateDuracaoMinutos('480');
      expect(result.valid).toBe(true);
      expect(result.error).toBe('');
    });

    it('returns valid for typical duration', () => {
      const result = validateDuracaoMinutos('60');
      expect(result.valid).toBe(true);
      expect(result.error).toBe('');
    });
  });

  describe('validateValor', () => {
    it('returns valid when empty (optional field)', () => {
      const result = validateValor('');
      expect(result.valid).toBe(true);
      expect(result.error).toBe('');
    });

    it('returns valid for zero', () => {
      const result = validateValor('0');
      expect(result.valid).toBe(true);
      expect(result.error).toBe('');
    });

    it('returns valid for positive value', () => {
      const result = validateValor('150.50');
      expect(result.valid).toBe(true);
      expect(result.error).toBe('');
    });

    it('returns error for negative value', () => {
      const result = validateValor('-1');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Valor deve ser maior ou igual a zero');
    });

    it('returns error for non-numeric input', () => {
      const result = validateValor('abc');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Valor deve ser maior ou igual a zero');
    });
  });

  describe('validateServiceField', () => {
    it('delegates to validateNome for "nome" field', () => {
      expect(validateServiceField('nome', '').valid).toBe(false);
      expect(validateServiceField('nome', 'Test').valid).toBe(true);
    });

    it('delegates to validateDuracaoMinutos for "duracao_minutos" field', () => {
      expect(validateServiceField('duracao_minutos', '3').valid).toBe(false);
      expect(validateServiceField('duracao_minutos', '60').valid).toBe(true);
    });

    it('delegates to validateValor for "valor" field', () => {
      expect(validateServiceField('valor', '-5').valid).toBe(false);
      expect(validateServiceField('valor', '100').valid).toBe(true);
    });

    it('returns valid for unknown fields', () => {
      expect(validateServiceField('unknown', 'anything').valid).toBe(true);
    });
  });
});
