import type { Brand } from '@/contexts/BrandContext';
import type { Category } from '@/lib/dataFetcher';

const LOCAL_CATEGORY_STORAGE_PREFIX = 'catalog_local_categories';
const LOCAL_CATEGORY_ID_PREFIXES = {
  draft: 'draft-category-',
  copy: 'copy-category-',
} as const;

export const LOCAL_CATEGORY_EVENT_NAME = 'catalog-local-categories-changed';

export type LocalCatalogCategoryIdKind = keyof typeof LOCAL_CATEGORY_ID_PREFIXES;
export type LocalCatalogCategoryChangeKind = 'none' | 'new' | 'edited' | 'deleted';

export interface LocalCategoryOverrides {
  categories: Category[];
  deletedCategoryIds: string[];
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

function canUseCategoryStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function normalizeCategoryText(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function dedupeCategoryStrings(values: string[]) {
  return Array.from(new Set(values));
}

function normalizeCategoryRecord(value: unknown): Category | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<Category>;
  const id = normalizeCategoryText(candidate.id);
  const name = normalizeCategoryText(candidate.name);

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
  };
}

function normalizeCategoryIdList(value: unknown, fallbackValue: string[] = []) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,;|]+/g)
      : [];

  const normalizedValues = rawValues
    .map((item) => normalizeCategoryText(item))
    .filter((item) => item.length > 0);

  if (normalizedValues.length > 0) {
    return dedupeCategoryStrings(normalizedValues);
  }

  return dedupeCategoryStrings(
    fallbackValue
      .map((item) => normalizeCategoryText(item))
      .filter((item) => item.length > 0),
  );
}

export function sanitizeLocalCategory(category: Category): Category {
  return normalizeCategoryRecord(category) ?? category;
}

export function mergeLocalCategory(baseCategory: Category, patch: Partial<Category>): Category {
  return normalizeCategoryRecord({
    ...baseCategory,
    ...patch,
  }) ?? sanitizeLocalCategory(baseCategory);
}

export function formatLocalCategoryId(
  kind: LocalCatalogCategoryIdKind,
  uniquePart: string | number,
) {
  const normalizedUniquePart = normalizeCategoryText(String(uniquePart))
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${LOCAL_CATEGORY_ID_PREFIXES[kind]}${normalizedUniquePart || 'item'}`;
}

export function createLocalCategoryId(kind: LocalCatalogCategoryIdKind = 'draft') {
  return formatLocalCategoryId(
    kind,
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
}

function normalizeLocalCategoryOverrides(
  value: Partial<LocalCategoryOverrides> | null | undefined,
) {
  return {
    categories: Array.isArray(value?.categories)
      ? value.categories
          .map((category) => normalizeCategoryRecord(category))
          .filter((category): category is Category => category !== null)
      : [],
    deletedCategoryIds: normalizeCategoryIdList(value?.deletedCategoryIds),
  } satisfies LocalCategoryOverrides;
}

export function getLocalCategoryStorageKey(brand: Brand) {
  return `${LOCAL_CATEGORY_STORAGE_PREFIX}_${brand}`;
}

export function readLocalCategoryOverrides(brand: Brand) {
  if (!canUseCategoryStorage()) {
    return normalizeLocalCategoryOverrides({});
  }

  const parsedValue = safeParseJson<Partial<LocalCategoryOverrides>>(
    localStorage.getItem(getLocalCategoryStorageKey(brand)),
    {},
  );

  return normalizeLocalCategoryOverrides(parsedValue);
}

export function isCustomCatalogCategoryId(categoryId: string) {
  return Object.values(LOCAL_CATEGORY_ID_PREFIXES).some((prefix) =>
    categoryId.startsWith(prefix),
  );
}

export function hasLocalCatalogCategoryOverride(
  categoryId: string,
  overrides: LocalCategoryOverrides,
) {
  return (
    overrides.categories.some((category) => category.id === categoryId) ||
    overrides.deletedCategoryIds.includes(categoryId)
  );
}

export function isNewLocalCatalogCategory(
  categoryId: string,
  overrides?: LocalCategoryOverrides,
) {
  if (!isCustomCatalogCategoryId(categoryId)) {
    return false;
  }

  if (!overrides) {
    return true;
  }

  return (
    overrides.categories.some((category) => category.id === categoryId) &&
    !overrides.deletedCategoryIds.includes(categoryId)
  );
}

export function isEditedLocalCatalogCategory(
  categoryId: string,
  overrides: LocalCategoryOverrides,
) {
  return (
    !isCustomCatalogCategoryId(categoryId) &&
    overrides.categories.some((category) => category.id === categoryId) &&
    !overrides.deletedCategoryIds.includes(categoryId)
  );
}

export function getLocalCatalogCategoryChangeKind(
  categoryId: string,
  overrides: LocalCategoryOverrides,
): LocalCatalogCategoryChangeKind {
  if (overrides.deletedCategoryIds.includes(categoryId)) {
    return 'deleted';
  }

  if (isNewLocalCatalogCategory(categoryId, overrides)) {
    return 'new';
  }

  if (isEditedLocalCatalogCategory(categoryId, overrides)) {
    return 'edited';
  }

  return 'none';
}

export function getLocalCategoryChangesCount(brand: Brand) {
  const overrides = readLocalCategoryOverrides(brand);
  return overrides.categories.length + overrides.deletedCategoryIds.length;
}

export function saveLocalCategoryOverrides(brand: Brand, overrides: LocalCategoryOverrides) {
  const normalizedOverrides = normalizeLocalCategoryOverrides(overrides);
  const storageKey = getLocalCategoryStorageKey(brand);

  if (!canUseCategoryStorage()) {
    return normalizedOverrides;
  }

  localStorage.setItem(storageKey, JSON.stringify(normalizedOverrides));
  window.dispatchEvent(
    new CustomEvent(LOCAL_CATEGORY_EVENT_NAME, {
      detail: { brand, storageKey },
    }),
  );

  return normalizedOverrides;
}

export function upsertLocalCategory(brand: Brand, category: Category) {
  const currentOverrides = readLocalCategoryOverrides(brand);
  const nextCategory = sanitizeLocalCategory(category);
  const nextCategories = [
    nextCategory,
    ...currentOverrides.categories.filter((existingCategory) => existingCategory.id !== nextCategory.id),
  ];
  const nextDeletedCategoryIds = currentOverrides.deletedCategoryIds.filter(
    (categoryId) => categoryId !== nextCategory.id,
  );

  return saveLocalCategoryOverrides(brand, {
    categories: nextCategories,
    deletedCategoryIds: nextDeletedCategoryIds,
  });
}

export function deleteLocalCategory(brand: Brand, categoryId: string) {
  const currentOverrides = readLocalCategoryOverrides(brand);
  const nextDeletedCategoryIds = currentOverrides.deletedCategoryIds.includes(categoryId)
    ? currentOverrides.deletedCategoryIds
    : [...currentOverrides.deletedCategoryIds, categoryId];

  return saveLocalCategoryOverrides(brand, {
    categories: currentOverrides.categories.filter((category) => category.id !== categoryId),
    deletedCategoryIds: nextDeletedCategoryIds,
  });
}

export function clearLocalCategoryOverrides(brand: Brand) {
  if (!canUseCategoryStorage()) {
    return;
  }

  localStorage.removeItem(getLocalCategoryStorageKey(brand));
  window.dispatchEvent(
    new CustomEvent(LOCAL_CATEGORY_EVENT_NAME, {
      detail: { brand, storageKey: getLocalCategoryStorageKey(brand) },
    }),
  );
}

export function applyLocalCategoryOverrides(
  categories: Category[],
  overrides: LocalCategoryOverrides,
) {
  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  overrides.categories.forEach((category) => {
    categoryMap.set(category.id, sanitizeLocalCategory(category));
  });

  return Array.from(categoryMap.values()).filter(
    (category) => !overrides.deletedCategoryIds.includes(category.id),
  );
}

export function isLocalCategoryStorageKeyForBrand(
  key: string | null | undefined,
  brand: Brand,
) {
  return key === getLocalCategoryStorageKey(brand);
}
