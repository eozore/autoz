import { describe, it, expect } from 'vitest';
import { shouldShowRealData, COLD_START_CONFIG } from '../services/cold-start.service';

describe('ColdStartService', () => {
  describe('shouldShowRealData', () => {
    it('returns false when completedCount is below threshold', () => {
      expect(shouldShowRealData(0, 5)).toBe(false);
      expect(shouldShowRealData(4, 5)).toBe(false);
    });

    it('returns true when completedCount equals threshold', () => {
      expect(shouldShowRealData(5, 5)).toBe(true);
      expect(shouldShowRealData(3, 3)).toBe(true);
      expect(shouldShowRealData(10, 10)).toBe(true);
    });

    it('returns true when completedCount exceeds threshold', () => {
      expect(shouldShowRealData(6, 5)).toBe(true);
      expect(shouldShowRealData(100, 10)).toBe(true);
    });
  });

  describe('COLD_START_CONFIG', () => {
    it('has correct threshold values', () => {
      expect(COLD_START_CONFIG.reviewThreshold).toBe(3);
      expect(COLD_START_CONFIG.liquidityThreshold).toBe(5);
      expect(COLD_START_CONFIG.demandThreshold).toBe(10);
    });
  });

  describe('threshold boundary checks', () => {
    it('review threshold: shows real data at exactly 3', () => {
      expect(shouldShowRealData(2, COLD_START_CONFIG.reviewThreshold)).toBe(false);
      expect(shouldShowRealData(3, COLD_START_CONFIG.reviewThreshold)).toBe(true);
    });

    it('liquidity threshold: shows real data at exactly 5', () => {
      expect(shouldShowRealData(4, COLD_START_CONFIG.liquidityThreshold)).toBe(false);
      expect(shouldShowRealData(5, COLD_START_CONFIG.liquidityThreshold)).toBe(true);
    });

    it('demand threshold: shows real data at exactly 10', () => {
      expect(shouldShowRealData(9, COLD_START_CONFIG.demandThreshold)).toBe(false);
      expect(shouldShowRealData(10, COLD_START_CONFIG.demandThreshold)).toBe(true);
    });
  });
});
