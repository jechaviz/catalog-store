import type { Brand } from '@/contexts/BrandContext';
import type { CatalogProduct } from '@/lib/dataFetcher';
import {
  buildScopedBrandStorageKey,
  getLegacyBrandStorageKey,
  hasUserScope,
  isStorageKeyForBrandPrefix,
} from '@/lib/storageScope';

const CART_STORAGE_PREFIX = 'catalog_cart';
const LIKES_STORAGE_PREFIX = 'catalog_likes';
const LEGACY_NATURA_CART_KEY = 'natura_cart';
const LEGACY_NATURA_LIKES_KEY = 'natura_likes';

interface StoredCartItem {
  product: CatalogProduct;
  quantity: number;
}

function normalizeBrandLabel(brand: Brand | string) {
  return String(brand).trim().toLowerCase();
}

function safeParseJson<T>(rawValue: string | null, fallbackValue: T): T {
  if (!rawValue) {
    return fallbackValue;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallbackValue;
  }
}

export function getCartStorageKey(brand: Brand, userId?: string | null) {
  return buildScopedBrandStorageKey(CART_STORAGE_PREFIX, brand, userId);
}

export function getLikesStorageKey(brand: Brand, userId?: string | null) {
  return buildScopedBrandStorageKey(LIKES_STORAGE_PREFIX, brand, userId);
}

export function getLegacyBrandCartStorageKey(brand: Brand) {
  return getLegacyBrandStorageKey(CART_STORAGE_PREFIX, brand);
}

export function getLegacyBrandLikesStorageKey(brand: Brand) {
  return getLegacyBrandStorageKey(LIKES_STORAGE_PREFIX, brand);
}

export function isLikesStorageKeyForBrand(key: string | null | undefined, brand: Brand) {
  return (
    isStorageKeyForBrandPrefix(key, LIKES_STORAGE_PREFIX, brand) ||
    (brand === 'natura' && key === LEGACY_NATURA_LIKES_KEY)
  );
}

export function isCartStorageKeyForBrand(key: string | null | undefined, brand: Brand) {
  return (
    isStorageKeyForBrandPrefix(key, CART_STORAGE_PREFIX, brand) ||
    (brand === 'natura' && key === LEGACY_NATURA_CART_KEY)
  );
}

export function getLegacyCartStorageKey() {
  return LEGACY_NATURA_CART_KEY;
}

export function getLegacyLikesStorageKey() {
  return LEGACY_NATURA_LIKES_KEY;
}

export function getProductFallbackImage(brand: Brand | string) {
  return normalizeBrandLabel(brand) === 'nikken'
    ? '/assets/nikken/products/4934.jpg'
    : '/crema_manos.png';
}

export function isProductForBrand(product: Pick<CatalogProduct, 'brand'>, brand: Brand) {
  return normalizeBrandLabel(product.brand) === brand;
}

export function readStoredIds(storageKey: string) {
  const parsed = safeParseJson<unknown[]>(localStorage.getItem(storageKey), []);
  return parsed.filter((value): value is string => typeof value === 'string');
}

export function writeStoredIds(storageKey: string, ids: string[]) {
  localStorage.setItem(storageKey, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent('catalog-likes-changed', { detail: { storageKey } }));
}

function hydrateGuestLikesFromLegacy(brand: Brand) {
  const guestStorageKey = getLikesStorageKey(brand);
  const legacyScopedKey = getLegacyBrandLikesStorageKey(brand);
  const legacyScopedIds = readStoredIds(legacyScopedKey);

  if (legacyScopedIds.length > 0 || localStorage.getItem(legacyScopedKey)) {
    writeStoredIds(guestStorageKey, legacyScopedIds);
    return legacyScopedIds;
  }

  if (brand === 'natura') {
    const legacyIds = readStoredIds(getLegacyLikesStorageKey());
    if (legacyIds.length > 0) {
      writeStoredIds(guestStorageKey, legacyIds);
    }
    return legacyIds;
  }

  return [];
}

export function readBrandLikeIds(brand: Brand, userId?: string | null) {
  const storageKey = getLikesStorageKey(brand, userId);
  const scopedIds = readStoredIds(storageKey);

  if (scopedIds.length > 0 || localStorage.getItem(storageKey)) {
    return scopedIds;
  }

  if (hasUserScope(userId)) {
    return [];
  }

  return hydrateGuestLikesFromLegacy(brand);
}

export function toggleStoredId(storageKey: string, id: string) {
  const currentIds = readStoredIds(storageKey);
  const nextIds = currentIds.includes(id)
    ? currentIds.filter(currentId => currentId !== id)
    : [...currentIds, id];

  writeStoredIds(storageKey, nextIds);
  return nextIds;
}

export function toggleBrandLikeId(brand: Brand, id: string, userId?: string | null) {
  const storageKey = getLikesStorageKey(brand, userId);

  if (!hasUserScope(userId) && !localStorage.getItem(storageKey)) {
    hydrateGuestLikesFromLegacy(brand);
  }

  return toggleStoredId(storageKey, id);
}

export function readStoredCartItems(storageKey: string, brand: Brand) {
  const parsed = safeParseJson<unknown[]>(localStorage.getItem(storageKey), []);

  return parsed.filter((item): item is StoredCartItem => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const candidate = item as Partial<StoredCartItem>;
    return (
      typeof candidate.quantity === 'number' &&
      candidate.quantity > 0 &&
      !!candidate.product &&
      typeof candidate.product.id === 'string' &&
      typeof candidate.product.brand === 'string' &&
      isProductForBrand(candidate.product, brand)
    );
  });
}
