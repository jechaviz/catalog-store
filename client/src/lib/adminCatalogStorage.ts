import type { Brand } from '@/contexts/BrandContext';
import type { CatalogProduct } from '@/lib/dataFetcher';

const LOCAL_CATALOG_STORAGE_PREFIX = 'catalog_local_products';
const LOCAL_CATALOG_ID_PREFIXES = {
  draft: 'draft-',
  copy: 'copy-',
} as const;

export const LOCAL_CATALOG_EVENT_NAME = 'catalog-local-products-changed';

export type LocalCatalogProductIdKind = keyof typeof LOCAL_CATALOG_ID_PREFIXES;
export type LocalCatalogProductChangeKind = 'none' | 'new' | 'edited' | 'deleted';

export interface LocalCatalogOverrides {
  products: CatalogProduct[];
  deletedProductIds: string[];
}

export type LocalCatalogOverridesSnapshot =
  | LocalCatalogOverrides
  | Partial<LocalCatalogOverrides>
  | CatalogProduct[]
  | Record<string, unknown>
  | null
  | undefined;

export interface LocalCatalogRemoteSyncPayload {
  brand: Brand;
  overrides: LocalCatalogOverrides;
}

export interface LocalCatalogProductRemoteSyncPayload extends LocalCatalogRemoteSyncPayload {
  action: 'upsert' | 'delete';
  product?: CatalogProduct;
  productId?: string;
}

export interface LocalCatalogRemoteSyncOptions<TResult = void> {
  persist: (payload: LocalCatalogRemoteSyncPayload) => Promise<TResult>;
  getSnapshot?: (
    result: TResult,
    payload: LocalCatalogRemoteSyncPayload,
  ) => LocalCatalogOverridesSnapshot;
}

export interface LocalCatalogProductRemoteSyncOptions<TResult = void> {
  persist: (payload: LocalCatalogProductRemoteSyncPayload) => Promise<TResult>;
  getSnapshot?: (
    result: TResult,
    payload: LocalCatalogProductRemoteSyncPayload,
  ) => LocalCatalogOverridesSnapshot;
}

export interface LocalCatalogRemoteSyncResult<TResult = void> {
  overrides: LocalCatalogOverrides;
  remoteResult: TResult;
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

function canUseCatalogStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function normalizeCatalogText(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function normalizeCatalogPrice(value: unknown, fallbackValue = 0) {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : fallbackValue;
}

function normalizeCatalogGender(
  value: unknown,
  fallbackValue: CatalogProduct['gender'] = 'unisex',
): CatalogProduct['gender'] {
  return value === 'female' || value === 'male' || value === 'unisex'
    ? value
    : fallbackValue;
}

function dedupeCatalogStrings(values: string[]) {
  return Array.from(new Set(values));
}

function dedupeCatalogProducts(products: CatalogProduct[]) {
  const productMap = new Map<string, CatalogProduct>();

  products.forEach((product) => {
    productMap.set(product.id, product);
  });

  return Array.from(productMap.values());
}

function normalizeCatalogProductCollection(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((product) => normalizeCatalogProductRecord(product))
      .filter((product): product is CatalogProduct => product !== null);
  }

  return [];
}

function normalizeCatalogProductRecord(value: unknown): CatalogProduct | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<CatalogProduct>;
  const id = normalizeCatalogText(candidate.id);
  const name = normalizeCatalogText(candidate.name);

  if (!id || !name) {
    return null;
  }

  const paymentLink = normalizeCatalogText(candidate.paymentLink);

  const normalizedProduct: CatalogProduct = {
    id,
    name,
    brand: normalizeCatalogText(candidate.brand),
    subBrand: normalizeCatalogText(candidate.subBrand),
    categoryId: normalizeCatalogText(candidate.categoryId) || 'uncategorized',
    gender: normalizeCatalogGender(candidate.gender),
    description: normalizeCatalogText(candidate.description),
    benefits: normalizeCatalogBenefits(candidate.benefits),
    price: normalizeCatalogPrice(candidate.price),
    imageUrl: normalizeCatalogText(candidate.imageUrl),
    inStock: typeof candidate.inStock === 'boolean' ? candidate.inStock : true,
    deliveryTime: normalizeCatalogText(candidate.deliveryTime),
    deliveryMethods: normalizeCatalogDeliveryMethods(candidate.deliveryMethods),
  };

  if (paymentLink) {
    normalizedProduct.paymentLink = paymentLink;
  }

  return normalizedProduct;
}

export function normalizeCatalogStringList(value: unknown, fallbackValue: string[] = []) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,;|]+/g)
      : [];
  const normalizedValues = rawValues
    .map((item) => normalizeCatalogText(item))
    .filter((item) => item.length > 0);

  if (normalizedValues.length > 0) {
    return dedupeCatalogStrings(normalizedValues);
  }

  return dedupeCatalogStrings(
    fallbackValue
      .map((item) => normalizeCatalogText(item))
      .filter((item) => item.length > 0),
  );
}

export function normalizeCatalogBenefits(value: unknown, fallbackValue: string[] = []) {
  return normalizeCatalogStringList(value, fallbackValue);
}

export function normalizeCatalogDeliveryMethods(value: unknown, fallbackValue: string[] = []) {
  return normalizeCatalogStringList(value, fallbackValue);
}

export function sanitizeLocalCatalogProduct(product: CatalogProduct): CatalogProduct {
  return (
    normalizeCatalogProductRecord(product) ?? {
      ...product,
      benefits: normalizeCatalogBenefits(product.benefits),
      deliveryMethods: normalizeCatalogDeliveryMethods(product.deliveryMethods),
    }
  );
}

export function mergeLocalCatalogProduct(
  baseProduct: CatalogProduct,
  patch: Partial<CatalogProduct>,
): CatalogProduct {
  return (
    normalizeCatalogProductRecord({
      ...baseProduct,
      ...patch,
      benefits: patch.benefits ?? baseProduct.benefits,
      deliveryMethods: patch.deliveryMethods ?? baseProduct.deliveryMethods,
    }) ?? sanitizeLocalCatalogProduct(baseProduct)
  );
}

export function formatLocalCatalogProductId(
  kind: LocalCatalogProductIdKind,
  uniquePart: string | number,
) {
  const normalizedUniquePart = normalizeCatalogText(String(uniquePart))
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${LOCAL_CATALOG_ID_PREFIXES[kind]}${normalizedUniquePart || 'item'}`;
}

export function createLocalCatalogProductId(kind: LocalCatalogProductIdKind = 'draft') {
  return formatLocalCatalogProductId(
    kind,
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
}

function normalizeLocalCatalogOverrides(value: unknown) {
  const candidate =
    Array.isArray(value) || (value && typeof value === 'object')
      ? (value as Record<string, unknown>)
      : undefined;

  if (!candidate) {
    return {
      products: [],
      deletedProductIds: [],
    } satisfies LocalCatalogOverrides;
  }

  const products = [
    candidate.products,
    candidate.localProducts,
    candidate.customProducts,
    candidate.items,
    candidate.overrides,
  ].flatMap((rawCollection) => normalizeCatalogProductCollection(rawCollection));

  const deletedProductIds = [
    candidate.deletedProductIds,
    candidate.deletedIds,
    candidate.removedProductIds,
    candidate.hiddenProductIds,
  ].flatMap((rawIds) => normalizeCatalogStringList(rawIds));

  return {
    products: dedupeCatalogProducts(products),
    deletedProductIds: dedupeCatalogStrings(deletedProductIds),
  } satisfies LocalCatalogOverrides;
}

function dispatchLocalCatalogChangeEvent(brand: Brand, storageKey: string) {
  window.dispatchEvent(
    new CustomEvent(LOCAL_CATALOG_EVENT_NAME, {
      detail: { brand, storageKey },
    }),
  );
}

function applyLocalCatalogRemoteSnapshot(
  brand: Brand,
  snapshot: LocalCatalogOverridesSnapshot,
  fallbackOverrides: LocalCatalogOverrides,
) {
  if (snapshot === undefined) {
    return fallbackOverrides;
  }

  return hydrateLocalCatalogOverridesFromSnapshot(brand, snapshot);
}

export function getLocalCatalogStorageKey(brand: Brand) {
  return `${LOCAL_CATALOG_STORAGE_PREFIX}_${brand}`;
}

export function readLocalCatalogOverrides(brand: Brand) {
  if (!canUseCatalogStorage()) {
    return normalizeLocalCatalogOverrides({});
  }

  const parsedValue = safeParseJson<Partial<LocalCatalogOverrides>>(
    localStorage.getItem(getLocalCatalogStorageKey(brand)),
    {},
  );

  return normalizeLocalCatalogOverrides(parsedValue);
}

export function isCustomCatalogProductId(productId: string) {
  return Object.values(LOCAL_CATALOG_ID_PREFIXES).some((prefix) => productId.startsWith(prefix));
}

export function hasLocalCatalogProductOverride(
  productId: string,
  overrides: LocalCatalogOverrides,
) {
  return (
    overrides.products.some((product) => product.id === productId) ||
    overrides.deletedProductIds.includes(productId)
  );
}

export function isNewLocalCatalogProduct(
  productId: string,
  overrides?: LocalCatalogOverrides,
) {
  if (!isCustomCatalogProductId(productId)) {
    return false;
  }

  if (!overrides) {
    return true;
  }

  return (
    overrides.products.some((product) => product.id === productId) &&
    !overrides.deletedProductIds.includes(productId)
  );
}

export function isEditedLocalCatalogProduct(
  productId: string,
  overrides: LocalCatalogOverrides,
) {
  return (
    !isCustomCatalogProductId(productId) &&
    overrides.products.some((product) => product.id === productId) &&
    !overrides.deletedProductIds.includes(productId)
  );
}

export function getLocalCatalogProductChangeKind(
  productId: string,
  overrides: LocalCatalogOverrides,
): LocalCatalogProductChangeKind {
  if (overrides.deletedProductIds.includes(productId)) {
    return 'deleted';
  }

  if (isNewLocalCatalogProduct(productId, overrides)) {
    return 'new';
  }

  if (isEditedLocalCatalogProduct(productId, overrides)) {
    return 'edited';
  }

  return 'none';
}

export function getLocalCatalogChangesCount(brand: Brand) {
  const overrides = readLocalCatalogOverrides(brand);
  return overrides.products.length + overrides.deletedProductIds.length;
}

export function saveLocalCatalogOverrides(brand: Brand, overrides: LocalCatalogOverrides) {
  const normalizedOverrides = normalizeLocalCatalogOverrides(overrides);
  const storageKey = getLocalCatalogStorageKey(brand);

  if (!canUseCatalogStorage()) {
    return normalizedOverrides;
  }

  localStorage.setItem(storageKey, JSON.stringify(normalizedOverrides));
  dispatchLocalCatalogChangeEvent(brand, storageKey);

  return normalizedOverrides;
}

export function hydrateLocalCatalogOverridesFromSnapshot(
  brand: Brand,
  snapshot: LocalCatalogOverridesSnapshot,
) {
  if (snapshot === null) {
    clearLocalCatalogOverrides(brand);
    return normalizeLocalCatalogOverrides({});
  }

  if (Array.isArray(snapshot)) {
    return saveLocalCatalogOverrides(brand, {
      products: normalizeCatalogProductCollection(snapshot),
      deletedProductIds: [],
    });
  }

  return saveLocalCatalogOverrides(brand, normalizeLocalCatalogOverrides(snapshot));
}

export async function syncLocalCatalogOverrides<TResult = void>(
  brand: Brand,
  overrides: LocalCatalogOverrides,
  options: LocalCatalogRemoteSyncOptions<TResult>,
): Promise<LocalCatalogRemoteSyncResult<TResult>> {
  const nextOverrides = saveLocalCatalogOverrides(brand, overrides);
  const payload: LocalCatalogRemoteSyncPayload = {
    brand,
    overrides: nextOverrides,
  };
  const remoteResult = await options.persist(payload);

  return {
    overrides: applyLocalCatalogRemoteSnapshot(
      brand,
      options.getSnapshot?.(remoteResult, payload),
      nextOverrides,
    ),
    remoteResult,
  };
}

export function upsertLocalCatalogProduct(brand: Brand, product: CatalogProduct) {
  const currentOverrides = readLocalCatalogOverrides(brand);
  const nextProduct = sanitizeLocalCatalogProduct(product);
  const nextProducts = [
    nextProduct,
    ...currentOverrides.products.filter((existingProduct) => existingProduct.id !== nextProduct.id),
  ];
  const nextDeletedProductIds = currentOverrides.deletedProductIds.filter(
    (productId) => productId !== nextProduct.id,
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

export async function upsertLocalCatalogProductAndSync<TResult = void>(
  brand: Brand,
  product: CatalogProduct,
  options: LocalCatalogProductRemoteSyncOptions<TResult>,
): Promise<LocalCatalogRemoteSyncResult<TResult>> {
  const nextProduct = sanitizeLocalCatalogProduct(product);
  const nextOverrides = upsertLocalCatalogProduct(brand, nextProduct);
  const payload: LocalCatalogProductRemoteSyncPayload = {
    action: 'upsert',
    brand,
    overrides: nextOverrides,
    product: nextProduct,
  };
  const remoteResult = await options.persist(payload);

  return {
    overrides: applyLocalCatalogRemoteSnapshot(
      brand,
      options.getSnapshot?.(remoteResult, payload),
      nextOverrides,
    ),
    remoteResult,
  };
}

export async function deleteLocalCatalogProductAndSync<TResult = void>(
  brand: Brand,
  productId: string,
  options: LocalCatalogProductRemoteSyncOptions<TResult>,
): Promise<LocalCatalogRemoteSyncResult<TResult>> {
  const normalizedProductId = normalizeCatalogText(productId);
  const nextOverrides = deleteLocalCatalogProduct(brand, normalizedProductId);
  const payload: LocalCatalogProductRemoteSyncPayload = {
    action: 'delete',
    brand,
    overrides: nextOverrides,
    productId: normalizedProductId,
  };
  const remoteResult = await options.persist(payload);

  return {
    overrides: applyLocalCatalogRemoteSnapshot(
      brand,
      options.getSnapshot?.(remoteResult, payload),
      nextOverrides,
    ),
    remoteResult,
  };
}

export function clearLocalCatalogOverrides(brand: Brand) {
  if (!canUseCatalogStorage()) {
    return;
  }

  const storageKey = getLocalCatalogStorageKey(brand);

  localStorage.removeItem(storageKey);
  dispatchLocalCatalogChangeEvent(brand, storageKey);
}

export function applyLocalCatalogOverrides(
  products: CatalogProduct[],
  overrides: LocalCatalogOverrides,
) {
  const productMap = new Map(products.map((product) => [product.id, product]));

  overrides.products.forEach((product) => {
    productMap.set(product.id, sanitizeLocalCatalogProduct(product));
  });

  return Array.from(productMap.values()).filter(
    (product) => !overrides.deletedProductIds.includes(product.id),
  );
}

export function isLocalCatalogStorageKeyForBrand(key: string | null | undefined, brand: Brand) {
  return key === getLocalCatalogStorageKey(brand);
}
