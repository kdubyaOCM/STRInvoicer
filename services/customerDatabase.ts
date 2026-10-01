import { PropertyManagerProfile, PropertyOwnerRecord } from '../types';

const STORAGE_KEY_MANAGER = 'str_property_manager_profile';
const STORAGE_KEY_OWNERS = 'str_property_owners_directory';
const STORAGE_KEY_ACTIVE_OWNER = 'str_last_active_owner_id';

// Default Manager fallback
const DEFAULT_MANAGER: PropertyManagerProfile = {
  managerName: 'Coastal Holiday Stays Pty Ltd',
  managerContact: 'accounts@coastalstays.com.au | (02) 9876 5432',
  managerBank: 'BSB: 062-000 | Account: 1234 5678\nAccount Name: Coastal Trust Account',
  defaultMgmtFeePercent: 20,
  defaultFeeBaseMode: 'gross_revenue',
  updatedAt: new Date().toISOString()
};

// Default initial owner
const DEFAULT_INITIAL_OWNER: PropertyOwnerRecord = {
  id: 'owner-default-1',
  name: 'John & Jane Smith',
  propertyName: 'Seaside Retreat Unit 4',
  contactEmail: 'smiths@example.com',
  mgmtFeePercent: 20,
  feeBaseMode: 'gross_revenue',
  initialOpeningBalanceCents: 0,
  startQuarterId: 'FY2020-21-Q1',
  endQuarterId: 'FY2024-25-Q4',
  notes: 'Primary holiday rental property',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// In-memory fallback (for Node/tests or restricted environments)
const memoryStore: Record<string, string> = {};

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch {
    // fallback
  }
  return memoryStore[key] ?? null;
}

function safeSetItem(key: string, value: string): void {
  memoryStore[key] = value;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // fallback
  }
}

/**
 * Resets storage (primarily for test setups)
 */
export function clearDatabaseStorage(): void {
  for (const k in memoryStore) {
    delete memoryStore[k];
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  } catch {
    // fallback
  }
}

/**
 * Retrieves the stored Property Manager profile (recorded once, shared globally).
 */
export function getManagerProfile(): PropertyManagerProfile {
  const raw = safeGetItem(STORAGE_KEY_MANAGER);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.managerName === 'string') {
        return { ...DEFAULT_MANAGER, ...parsed };
      }
    } catch {
      // fallback
    }
  }
  return DEFAULT_MANAGER;
}

/**
 * Saves/updates the Property Manager profile in localStorage.
 */
export function saveManagerProfile(updates: Partial<PropertyManagerProfile>): PropertyManagerProfile {
  const current = getManagerProfile();
  const updated: PropertyManagerProfile = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  safeSetItem(STORAGE_KEY_MANAGER, JSON.stringify(updated));
  return updated;
}

/**
 * Retrieves all registered Property Owners / Customers.
 */
export function getOwnersList(): PropertyOwnerRecord[] {
  const raw = safeGetItem(STORAGE_KEY_OWNERS);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // fallback
    }
  }
  // Initialize with default owner if empty
  const initial = [DEFAULT_INITIAL_OWNER];
  safeSetItem(STORAGE_KEY_OWNERS, JSON.stringify(initial));
  safeSetItem(STORAGE_KEY_ACTIVE_OWNER, DEFAULT_INITIAL_OWNER.id);
  return initial;
}

/**
 * Saves an updated list of owners to storage.
 */
function persistOwnersList(owners: PropertyOwnerRecord[]): void {
  safeSetItem(STORAGE_KEY_OWNERS, JSON.stringify(owners));
}

/**
 * Gets the ID of the last loaded/active customer.
 */
export function getLastActiveOwnerId(): string {
  const lastId = safeGetItem(STORAGE_KEY_ACTIVE_OWNER);
  const owners = getOwnersList();
  if (lastId && owners.some(o => o.id === lastId)) {
    return lastId;
  }
  const fallbackId = owners[0]?.id || DEFAULT_INITIAL_OWNER.id;
  safeSetItem(STORAGE_KEY_ACTIVE_OWNER, fallbackId);
  return fallbackId;
}

/**
 * Sets the active customer ID so the app defaults to this customer on next visit.
 */
export function setLastActiveOwnerId(id: string): void {
  safeSetItem(STORAGE_KEY_ACTIVE_OWNER, id);
}

/**
 * Retrieves the currently active Property Owner record.
 */
export function getActiveOwner(): PropertyOwnerRecord {
  const activeId = getLastActiveOwnerId();
  const owners = getOwnersList();
  const found = owners.find(o => o.id === activeId);
  return found || owners[0] || DEFAULT_INITIAL_OWNER;
}

/**
 * Saves or updates an owner in the directory.
 */
export function saveOwner(ownerData: Partial<PropertyOwnerRecord> & { id: string }): PropertyOwnerRecord {
  const owners = getOwnersList();
  const idx = owners.findIndex(o => o.id === ownerData.id);
  const now = new Date().toISOString();

  let savedRecord: PropertyOwnerRecord;

  if (idx !== -1) {
    savedRecord = {
      ...owners[idx],
      ...ownerData,
      updatedAt: now
    };
    owners[idx] = savedRecord;
  } else {
    savedRecord = {
      id: ownerData.id,
      name: ownerData.name || 'New Property Owner',
      propertyName: ownerData.propertyName || '',
      contactEmail: ownerData.contactEmail || '',
      mgmtFeePercent: ownerData.mgmtFeePercent ?? 20,
      feeBaseMode: ownerData.feeBaseMode || 'gross_revenue',
      initialOpeningBalanceCents: ownerData.initialOpeningBalanceCents ?? 0,
      startQuarterId: ownerData.startQuarterId || 'FY2020-21-Q1',
      endQuarterId: ownerData.endQuarterId || 'FY2024-25-Q4',
      notes: ownerData.notes || '',
      createdAt: now,
      updatedAt: now
    };
    owners.push(savedRecord);
  }

  persistOwnersList(owners);
  setLastActiveOwnerId(savedRecord.id);
  return savedRecord;
}

/**
 * Creates a brand new Property Owner record and sets them as active.
 */
export function createOwner(name: string, propertyName?: string): PropertyOwnerRecord {
  const id = `owner-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const manager = getManagerProfile();
  const newOwner: PropertyOwnerRecord = {
    id,
    name: name.trim() || 'New Property Owner',
    propertyName: propertyName?.trim() || '',
    mgmtFeePercent: manager.defaultMgmtFeePercent,
    feeBaseMode: manager.defaultFeeBaseMode,
    initialOpeningBalanceCents: 0,
    startQuarterId: 'FY2020-21-Q1',
    endQuarterId: 'FY2024-25-Q4',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const owners = getOwnersList();
  owners.push(newOwner);
  persistOwnersList(owners);
  setLastActiveOwnerId(id);
  return newOwner;
}

/**
 * Deletes a property owner by ID (cannot delete if it's the only one).
 */
export function deleteOwner(id: string): { success: boolean, newActiveId?: string } {
  let owners = getOwnersList();
  if (owners.length <= 1) {
    return { success: false };
  }

  owners = owners.filter(o => o.id !== id);
  persistOwnersList(owners);

  const currentActive = getLastActiveOwnerId();
  if (currentActive === id) {
    const newActiveId = owners[0].id;
    setLastActiveOwnerId(newActiveId);
    return { success: true, newActiveId };
  }

  return { success: true, newActiveId: currentActive };
}
