import type { Brand } from '@/contexts/BrandContext';

export const GUEST_STORAGE_SCOPE = 'guest';

export function hasUserScope(userId?: string | null) {
  return Boolean(userId && String(userId).trim());
}

export function normalizeStorageScopeId(userId?: string | null) {
  if (!hasUserScope(userId)) {
    return GUEST_STORAGE_SCOPE;
  }

  const normalized = String(userId)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || GUEST_STORAGE_SCOPE;
}

export function buildScopedBrandStorageKey(
  prefix: string,
  brand: Brand,
  userId?: string | null,
) {
  return `${prefix}_${brand}_${normalizeStorageScopeId(userId)}`;
}

export function getLegacyBrandStorageKey(prefix: string, brand: Brand) {
  return `${prefix}_${brand}`;
}

export function listScopedBrandStorageKeys(prefix: string, brand: Brand) {
  const legacyKey = getLegacyBrandStorageKey(prefix, brand);
  const scopedPrefix = `${prefix}_${brand}_`;
  const keys = new Set<string>([legacyKey]);

  if (typeof window === 'undefined') {
    return Array.from(keys);
  }

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (key && key.startsWith(scopedPrefix)) {
      keys.add(key);
    }
  }

  return Array.from(keys);
}

export function isStorageKeyForBrandPrefix(key: string | null | undefined, prefix: string, brand: Brand) {
  if (!key) {
    return false;
  }

  return key === getLegacyBrandStorageKey(prefix, brand) || key.startsWith(`${prefix}_${brand}_`);
}
