import type { Brand } from '@/contexts/BrandContext';
import type { CatalogProduct } from '@/lib/dataFetcher';
import {
  buildScopedBrandStorageKey,
  getLegacyBrandStorageKey,
  hasUserScope,
  isStorageKeyForBrandPrefix,
  normalizeStorageScopeId,
} from '@/lib/storageScope';

const CART_STORAGE_PREFIX = 'catalog_cart';
const LIKES_STORAGE_PREFIX = 'catalog_likes';
const LEGACY_NATURA_CART_KEY = 'natura_cart';
const LEGACY_NATURA_LIKES_KEY = 'natura_likes';
export const LIKES_CHANGED_EVENT = 'catalog-likes-changed';
export const CART_CHANGED_EVENT = 'catalog-cart-changed';
export type StorefrontStorageChangeSource = 'local' | 'remote';

export interface StoredCartItem {
  product: CatalogProduct;
  quantity: number;
}

type WriteIdsOptions = {
  brand?: Brand;
  userId?: string | null;
  source?: StorefrontStorageChangeSource;
  suppressEvent?: boolean;
};

type WriteCartOptions = {
  userId?: string | null;
  source?: StorefrontStorageChangeSource;
  originId?: string;
  suppressEvent?: boolean;
};

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

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function serializeForStorage(value: unknown) {
  return JSON.stringify(value);
}

function inferScopeIdFromStorageKey(prefix: string, brand: Brand, storageKey: string) {
  const scopedPrefix = `${prefix}_${brand}_`;

  if (storageKey.startsWith(scopedPrefix)) {
    const scopedSuffix = storageKey.slice(scopedPrefix.length).trim();
    return scopedSuffix || normalizeStorageScopeId();
  }

  if (
    storageKey === getLegacyBrandStorageKey(prefix, brand) ||
    (prefix === CART_STORAGE_PREFIX && brand === 'natura' && storageKey === LEGACY_NATURA_CART_KEY) ||
    (prefix === LIKES_STORAGE_PREFIX && brand === 'natura' && storageKey === LEGACY_NATURA_LIKES_KEY)
  ) {
    return normalizeStorageScopeId();
  }

  return undefined;
}

function dispatchLikesChanged(storageKey: string, options: WriteIdsOptions = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(LIKES_CHANGED_EVENT, {
    detail: {
      storageKey,
      brand: options.brand,
      scopeId:
        options.userId === undefined && !options.brand
          ? undefined
          : options.brand && options.userId === undefined
          ? inferScopeIdFromStorageKey(LIKES_STORAGE_PREFIX, options.brand, storageKey)
          : normalizeStorageScopeId(options.userId),
      source: options.source || 'local',
    },
  }));
}

function dispatchCartChanged(brand: Brand, storageKey: string, options: WriteCartOptions = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT, {
    detail: {
      storageKey,
      brand,
      scopeId:
        options.userId === undefined
          ? inferScopeIdFromStorageKey(CART_STORAGE_PREFIX, brand, storageKey)
          : normalizeStorageScopeId(options.userId),
      source: options.source || 'local',
      originId: options.originId,
    },
  }));
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
  if (!canUseBrowserStorage()) {
    return [];
  }

  const parsed = safeParseJson<unknown[]>(localStorage.getItem(storageKey), []);
  return parsed.filter((value): value is string => typeof value === 'string');
}

export function writeStoredIds(storageKey: string, ids: string[], options: WriteIdsOptions = {}) {
  if (!canUseBrowserStorage()) {
    return [];
  }

  const normalizedIds = Array.from(
    new Set(ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)),
  );
  const currentSerialized = serializeForStorage(
    Array.from(new Set(readStoredIds(storageKey))),
  );
  const nextSerialized = serializeForStorage(normalizedIds);

  if (currentSerialized === nextSerialized) {
    return normalizedIds;
  }

  localStorage.setItem(storageKey, nextSerialized);
  if (!options.suppressEvent) {
    dispatchLikesChanged(storageKey, options);
  }

  return normalizedIds;
}

function hydrateGuestLikesFromLegacy(brand: Brand) {
  if (!canUseBrowserStorage()) {
    return [];
  }

  const guestStorageKey = getLikesStorageKey(brand);
  const legacyScopedKey = getLegacyBrandLikesStorageKey(brand);
  const legacyScopedIds = readStoredIds(legacyScopedKey);

  if (legacyScopedIds.length > 0 || localStorage.getItem(legacyScopedKey)) {
    writeStoredIds(guestStorageKey, legacyScopedIds, { brand });
    return legacyScopedIds;
  }

  if (brand === 'natura') {
    const legacyIds = readStoredIds(getLegacyLikesStorageKey());
    if (legacyIds.length > 0) {
      writeStoredIds(guestStorageKey, legacyIds, { brand });
    }
    return legacyIds;
  }

  return [];
}

export function readBrandLikeIds(brand: Brand, userId?: string | null) {
  if (!canUseBrowserStorage()) {
    return [];
  }

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

  return writeStoredIds(storageKey, nextIds);
}

export function toggleBrandLikeId(brand: Brand, id: string, userId?: string | null) {
  const storageKey = getLikesStorageKey(brand, userId);

  if (!hasUserScope(userId) && !localStorage.getItem(storageKey)) {
    hydrateGuestLikesFromLegacy(brand);
  }

  const currentIds = readStoredIds(storageKey);
  const nextIds = currentIds.includes(id)
    ? currentIds.filter(currentId => currentId !== id)
    : [...currentIds, id];

  return writeStoredIds(storageKey, nextIds, {
    brand,
    userId,
  });
}

export function replaceBrandLikeIds(
  brand: Brand,
  ids: string[],
  userId?: string | null,
  options: WriteIdsOptions = {},
) {
  const storageKey = getLikesStorageKey(brand, userId);
  return writeStoredIds(storageKey, ids, {
    ...options,
    brand,
    userId,
  });
}

export function getBrandLikesRemotePayload(brand: Brand, userId?: string | null) {
  return {
    brand,
    scopeId: normalizeStorageScopeId(userId),
    likes: readBrandLikeIds(brand, userId),
  };
}

export function hydrateLikesFromRemoteSnapshot(
  brand: Brand,
  payload: unknown,
  userId?: string | null,
) {
  const likes = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { likes?: unknown[] }).likes)
      ? (payload as { likes: unknown[] }).likes
      : [];

  return replaceBrandLikeIds(
    brand,
    likes.filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    userId,
    { source: 'remote' },
  );
}

export function writeStoredCartItems(
  storageKey: string,
  brand: Brand,
  items: StoredCartItem[],
  options: WriteCartOptions = {},
) {
  if (!canUseBrowserStorage()) {
    return [];
  }

  const normalizedItems = items.filter((item): item is StoredCartItem => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    return (
      typeof item.quantity === 'number' &&
      item.quantity > 0 &&
      !!item.product &&
      typeof item.product.id === 'string' &&
      typeof item.product.brand === 'string' &&
      isProductForBrand(item.product, brand)
    );
  });

  const currentSerialized = serializeForStorage(readStoredCartItems(storageKey, brand));
  const nextSerialized = serializeForStorage(normalizedItems);

  if (currentSerialized === nextSerialized) {
    return normalizedItems;
  }

  localStorage.setItem(storageKey, nextSerialized);

  if (!options.suppressEvent) {
    dispatchCartChanged(brand, storageKey, options);
  }

  return normalizedItems;
}

export function readStoredCartItems(storageKey: string, brand: Brand) {
  if (!canUseBrowserStorage()) {
    return [];
  }

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

export function readBrandCartItems(brand: Brand, userId?: string | null) {
  const storageKey = getCartStorageKey(brand, userId);
  const scopedItems = readStoredCartItems(storageKey, brand);

  if (scopedItems.length > 0 || !canUseBrowserStorage() || localStorage.getItem(storageKey) !== null) {
    return scopedItems;
  }

  if (hasUserScope(userId)) {
    return [];
  }

  const guestStorageKey = getCartStorageKey(brand);
  const legacyBrandKey = getLegacyBrandCartStorageKey(brand);
  const guestItems = guestStorageKey === storageKey ? scopedItems : readStoredCartItems(guestStorageKey, brand);
  const legacyBrandItems = readStoredCartItems(legacyBrandKey, brand);
  const naturaLegacyItems = brand === 'natura'
    ? readStoredCartItems(getLegacyCartStorageKey(), brand)
    : [];

  return guestItems.length > 0
    ? guestItems
    : legacyBrandItems.length > 0
      ? legacyBrandItems
      : naturaLegacyItems;
}

export function replaceBrandCartItems(
  brand: Brand,
  items: StoredCartItem[],
  userId?: string | null,
  options: WriteCartOptions = {},
) {
  const storageKey = getCartStorageKey(brand, userId);
  return writeStoredCartItems(storageKey, brand, items, {
    ...options,
    userId,
  });
}

export function getBrandCartRemotePayload(brand: Brand, userId?: string | null) {
  return {
    brand,
    scopeId: normalizeStorageScopeId(userId),
    cart: readBrandCartItems(brand, userId),
  };
}

export function hydrateCartFromRemoteSnapshot(
  brand: Brand,
  payload: unknown,
  userId?: string | null,
) {
  const cart = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { cart?: unknown[] }).cart)
      ? (payload as { cart: unknown[] }).cart
      : [];

  return replaceBrandCartItems(
    brand,
    cart.filter((item): item is StoredCartItem => {
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
    }),
    userId,
    { source: 'remote' },
  );
}
