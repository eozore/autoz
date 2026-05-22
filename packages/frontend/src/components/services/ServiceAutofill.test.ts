import { describe, it, expect } from 'vitest';
import { matchTemplates, SERVICE_TEMPLATES } from './ServiceAutofill';

describe('matchTemplates', () => {
  it('returns empty array for input shorter than 2 characters', () => {
    expect(matchTemplates('')).toEqual([]);
    expect(matchTemplates('a')).toEqual([]);
  });

  it('returns empty array for null/undefined-like input', () => {
    expect(matchTemplates('')).toEqual([]);
  });

  it('matches by normalized substring (case-insensitive)', () => {
    const results = matchTemplates('troca');
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.some((t) => t.nome === 'Troca de Óleo e Filtro')).toBe(true);
    expect(results.some((t) => t.nome === 'Troca de Pastilhas de Freio')).toBe(true);
  });

  it('matches with accent-insensitive search', () => {
    // "oleo" without accent should match "Óleo"
    const results = matchTemplates('oleo');
    expect(results.some((t) => t.nome === 'Troca de Óleo e Filtro')).toBe(true);
  });

  it('matches by individual word in input', () => {
    // "revisao completa" should match "Revisão Completa"
    const results = matchTemplates('revisao');
    expect(results.some((t) => t.nome === 'Revisão Completa')).toBe(true);
  });

  it('matches "diagnostico" to "Diagnóstico Eletrônico"', () => {
    const results = matchTemplates('diagnostico');
    expect(results.some((t) => t.nome === 'Diagnóstico Eletrônico')).toBe(true);
  });

  it('returns empty array when no templates match', () => {
    const results = matchTemplates('xyz123');
    expect(results).toEqual([]);
  });

  it('matches partial words', () => {
    const results = matchTemplates('alinham');
    expect(results.some((t) => t.nome === 'Alinhamento e Balanceamento')).toBe(true);
  });

  it('returns correct template data with nome, duracao_minutos, and valor', () => {
    const results = matchTemplates('polimento');
    expect(results.length).toBe(1);
    expect(results[0]).toEqual({
      nome: 'Polimento e Cristalização',
      duracao_minutos: 180,
      valor: 350,
    });
  });

  it('has 8 templates in the SERVICE_TEMPLATES array', () => {
    expect(SERVICE_TEMPLATES).toHaveLength(8);
  });
});
