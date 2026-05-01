import type { Brand } from '@/contexts/BrandContext';
import type { CatalogProduct } from '@/lib/dataFetcher';

const LOCAL_CATALOG_STORAGE_PREFIX = 'catalog_local_products';

export interface LocalCatalogOverrides {
  products: CatalogProduct[];
  deletedProductIds: string[];
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

function normalizeLocalCatalogOverrides(value: Partial<LocalCatalogOverrides> | null | undefined) {
  return {
    products: Array.isArray(value?.products) ? value.products : [],
    deletedProductIds: Array.isArray(value?.deletedProductIds)
      ? value.deletedProductIds.filter((candidate): candidate is string => typeof candidate === 'string')
      : [],
  } satisfies LocalCatalogOverrides;
}

export function getLocalCatalogStorageKey(brand: Brand) {
  return `${LOCAL_CATALOG_STORAGE_PREFIX}_${brand}`;
}

export function readLocalCatalogOverrides(brand: Brand) {
  const parsedValue = safeParseJson<Partial<LocalCatalogOverrides>>(
    localStorage.getItem(getLocalCatalogStorageKey(brand)),
    {},
  );

  return normalizeLocalCatalogOverrides(parsedValue);
}

export function isCustomCatalogProductId(productId: string) {
  return productId.startsWith('draft-') || productId.startsWith('copy-');
}

export function getLocalCatalogChangesCount(brand: Brand) {
  const overrides = readLocalCatalogOverrides(brand);
  return overrides.products.length + overrides.deletedProductIds.length;
}

export function saveLocalCatalogOverrides(brand: Brand, overrides: LocalCatalogOverrides) {
  const normalizedOverrides = normalizeLocalCatalogOverrides(overrides);
  const storageKey = getLocalCatalogStorageKey(brand);

  localStorage.setItem(storageKey, JSON.stringify(normalizedOverrides));
  window.dispatchEvent(
    new CustomEvent('catalog-local-products-changed', {
      detail: { brand, storageKey },
    }),
  );

  return normalizedOverrides;
}

export function upsertLocalCatalogProduct(brand: Brand, product: CatalogProduct) {
  const currentOverrides = readLocalCatalogOverrides(brand);
  const nextProducts = [
    product,
    ...currentOverrides.products.filter((existingProduct) => existingProduct.id !== product.id),
  ];
  const nextDeletedProductIds = currentOverrides.deletedProductIds.filter(
    (productId) => productId !== product.id,
  );

  return saveLocalCatalogOverrides(brand, {
    products: nextProducts,
    deletedProductIds: nextDeletedProductIds,
  });
}

export function deleteLocalCatalogProduct(brand: Brand, productId: string) {
  const currentOverrides = readLocalCatalogOverrides(brand);
  const nextDeletedProductIds = currentOverrides.deletedProductIds.includes(productId)
    ? currentOverrides.deletedProductIds
    : [...currentOverrides.deletedProductIds, productId];

  return saveLocalCatalogOverrides(brand, {
    products: currentOverrides.products.filter((product) => product.id !== productId),
    deletedProductIds: nextDeletedProductIds,
  });
}

export function clearLocalCatalogOverrides(brand: Brand) {
  localStorage.removeItem(getLocalCatalogStorageKey(brand));
  window.dispatchEvent(
    new CustomEvent('catalog-local-products-changed', {
      detail: { brand, storageKey: getLocalCatalogStorageKey(brand) },
    }),
  );
}

export function applyLocalCatalogOverrides(
  products: CatalogProduct[],
  overrides: LocalCatalogOverrides,
) {
  const productMap = new Map(products.map((product) => [product.id, product]));

  overrides.products.forEach((product) => {
    productMap.set(product.id, product);
  });

  return Array.from(productMap.values()).filter(
    (product) => !overrides.deletedProductIds.includes(product.id),
  );
}

export function isLocalCatalogStorageKeyForBrand(key: string | null | undefined, brand: Brand) {
  return key === getLocalCatalogStorageKey(brand);
}
