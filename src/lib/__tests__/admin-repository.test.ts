import { tenantRoles, TenantRole } from '../admin-repository';

describe('admin-repository', () => {
  describe('tenantRoles', () => {
    it('should contain all required roles', () => {
      expect(tenantRoles).toContain('owner');
      expect(tenantRoles).toContain('admin');
      expect(tenantRoles).toContain('operator');
      expect(tenantRoles).toContain('viewer');
    });

    it('should have exactly 4 roles', () => {
      expect(tenantRoles).toHaveLength(4);
    });

    it('should have roles in expected order', () => {
      expect(tenantRoles).toEqual(['owner', 'admin', 'operator', 'viewer']);
    });
  });

  describe('TenantRole type', () => {
    it('should accept valid roles', () => {
      const validRoles: TenantRole[] = ['owner', 'admin', 'operator', 'viewer'];
      expect(validRoles).toHaveLength(4);
    });
  });
});
