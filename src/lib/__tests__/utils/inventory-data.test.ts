import { formatNumber } from '../../inventory-data';

describe('inventory-data utilities', () => {
  describe('formatNumber', () => {
    it('should format zero', () => {
      expect(formatNumber(0)).toBe('0');
    });

    it('should format single digit numbers', () => {
      expect(formatNumber(5)).toBe('5');
    });

    it('should format numbers with thousands separator', () => {
      const result = formatNumber(1000);
      // Brazilian locale uses . as thousands separator
      expect(result).toMatch(/1\.000/);
    });

    it('should format large numbers correctly', () => {
      const result = formatNumber(1234567);
      expect(result).toMatch(/1\.234\.567/);
    });

    it('should handle negative numbers', () => {
      const result = formatNumber(-1000);
      expect(result).toMatch(/-1\.000/);
    });
  });
});
