import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getManagerProfile, 
  saveManagerProfile, 
  getOwnersList, 
  getActiveOwner, 
  saveOwner, 
  createOwner, 
  deleteOwner, 
  setLastActiveOwnerId, 
  getLastActiveOwnerId,
  clearDatabaseStorage
} from '../customerDatabase';

describe('Customer Database & Multi-Owner Management', () => {
  beforeEach(() => {
    clearDatabaseStorage();
  });

  describe('Property Manager Profile (Record Once, Global)', () => {
    it('retrieves default property manager profile on first load', () => {
      const manager = getManagerProfile();
      expect(manager.managerName).toBeDefined();
      expect(manager.managerBank).toBeDefined();
      expect(manager.defaultMgmtFeePercent).toBe(20);
    });

    it('records property manager information once and updates persistently', () => {
      const updated = saveManagerProfile({
        managerName: 'Apex Holiday Management Pty Ltd',
        managerContact: 'admin@apexstays.com.au',
        managerBank: 'BSB: 999-000 Acc: 11223344'
      });

      expect(updated.managerName).toBe('Apex Holiday Management Pty Ltd');
      expect(updated.managerContact).toBe('admin@apexstays.com.au');

      // Verify second retrieval returns the updated profile
      const retrieved = getManagerProfile();
      expect(retrieved.managerName).toBe('Apex Holiday Management Pty Ltd');
      expect(retrieved.managerBank).toBe('BSB: 999-000 Acc: 11223344');
    });
  });

  describe('Property Owners Directory & Active Customer Persistence', () => {
    it('initializes with a default customer and sets them as active', () => {
      const owners = getOwnersList();
      expect(owners.length).toBeGreaterThanOrEqual(1);

      const activeOwner = getActiveOwner();
      expect(activeOwner.id).toBe(owners[0].id);
      expect(activeOwner.name).toBe(owners[0].name);
    });

    it('creates multiple property owners and defaults to the last loaded/created customer', () => {
      const owner1 = createOwner('Alice Walker', 'Beach Villa #1');
      expect(getLastActiveOwnerId()).toBe(owner1.id);
      expect(getActiveOwner().name).toBe('Alice Walker');

      const owner2 = createOwner('Bob Martin', 'Mountain Cabin #5');
      expect(getLastActiveOwnerId()).toBe(owner2.id);
      expect(getActiveOwner().name).toBe('Bob Martin');

      const allOwners = getOwnersList();
      expect(allOwners.some(o => o.id === owner1.id)).toBe(true);
      expect(allOwners.some(o => o.id === owner2.id)).toBe(true);
    });

    it('allows manually switching back to another customer', () => {
      const owner1 = createOwner('Alice Walker', 'Beach Villa #1');
      const owner2 = createOwner('Bob Martin', 'Mountain Cabin #5');

      // Currently active is Bob
      expect(getActiveOwner().id).toBe(owner2.id);

      // Manually select Alice
      setLastActiveOwnerId(owner1.id);
      expect(getActiveOwner().id).toBe(owner1.id);
      expect(getActiveOwner().name).toBe('Alice Walker');
    });

    it('updates active customer details and retains them', () => {
      const owner = createOwner('Charlie Day', 'Unit 12');
      const updated = saveOwner({
        id: owner.id,
        name: 'Charlie Day & Partners',
        propertyName: 'Luxury Penthouse 12',
        initialOpeningBalanceCents: 50000 // $500.00
      });

      expect(updated.name).toBe('Charlie Day & Partners');
      expect(updated.propertyName).toBe('Luxury Penthouse 12');
      expect(updated.initialOpeningBalanceCents).toBe(50000);

      const retrieved = getActiveOwner();
      expect(retrieved.name).toBe('Charlie Day & Partners');
      expect(retrieved.initialOpeningBalanceCents).toBe(50000);
    });

    it('prevents deleting the last remaining customer', () => {
      const list = getOwnersList();
      // Delete until only 1 remains
      while (list.length > 1) {
        deleteOwner(list.pop()!.id);
      }

      const onlyOwner = getOwnersList()[0];
      const result = deleteOwner(onlyOwner.id);
      expect(result.success).toBe(false);
      expect(getOwnersList().length).toBe(1);
    });
  });
});
