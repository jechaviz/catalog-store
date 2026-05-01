import type { Brand } from '@/contexts/BrandContext';
import type { CatalogProduct } from '@/lib/dataFetcher';

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

export function getCartStorageKey(brand: Brand) {
  return `catalog_cart_${brand}`;
}

export function getLikesStorageKey(brand: Brand) {
  return `catalog_likes_${brand}`;
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

export function readBrandLikeIds(brand: Brand) {
  const storageKey = getLikesStorageKey(brand);
  const scopedIds = readStoredIds(storageKey);

  if (scopedIds.length > 0 || localStorage.getItem(storageKey)) {
    return scopedIds;
  }

  if (brand === 'natura') {
    const legacyIds = readStoredIds(getLegacyLikesStorageKey());
    if (legacyIds.length > 0) {
      writeStoredIds(storageKey, legacyIds);
    }
    return legacyIds;
  }

  return [];
}

export function toggleStoredId(storageKey: string, id: string) {
  const currentIds = readStoredIds(storageKey);
  const nextIds = currentIds.includes(id)
    ? currentIds.filter(currentId => currentId !== id)
    : [...currentIds, id];

  writeStoredIds(storageKey, nextIds);
  return nextIds;
}

export function toggleBrandLikeId(brand: Brand, id: string) {
  const storageKey = getLikesStorageKey(brand);

  if (brand === 'natura' && !localStorage.getItem(storageKey)) {
    const legacyIds = readStoredIds(getLegacyLikesStorageKey());
    if (legacyIds.length > 0) {
      writeStoredIds(storageKey, legacyIds);
    }
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
