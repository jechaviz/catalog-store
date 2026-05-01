import type { Brand } from '@/contexts/BrandContext';
import type { Category } from '@/lib/dataFetcher';

const LOCAL_CATEGORY_STORAGE_PREFIX = 'catalog_local_categories';
const LOCAL_CATEGORY_STORAGE_KEY_PREFIXES = [
  LOCAL_CATEGORY_STORAGE_PREFIX,
  'catalog_local_category_overrides',
  'catalog_local_category',
  'categories_local',
  'category_local',
] as const;
const LEGACY_LOCAL_CATEGORY_STORAGE_KEYS = {
  adminManager: (brand: Brand) => `catalog-local-categories:${brand}`,
} as const;
const LOCAL_CATEGORY_ID_PREFIXES = {
  local: 'local-category-',
  draft: 'draft-category-',
  copy: 'copy-category-',
  custom: 'custom-category-',
} as const;
const LOCAL_CATEGORY_EVENT_NAMES = [
  'catalog-local-categories-changed',
  'catalog-local-category-changed',
] as const;

export const LOCAL_CATEGORY_EVENT_NAME = LOCAL_CATEGORY_EVENT_NAMES[0];

export type LocalCatalogCategoryIdKind = keyof typeof LOCAL_CATEGORY_ID_PREFIXES;
export type LocalCatalogCategoryChangeKind = 'none' | 'new' | 'edited' | 'deleted';

export interface LocalCategoryMetadata {
  sortOrder?: number;
  isHidden?: boolean;
}

export interface LocalCategory extends Category, LocalCategoryMetadata {}

export interface LocalCategoryOverrides {
  categories: LocalCategory[];
  deletedCategoryIds: string[];
  metadataById?: Record<string, LocalCategoryMetadata>;
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

function normalizeCategoryNumber(value: unknown) {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(numericValue) ? Math.trunc(numericValue) : null;
}

function normalizeCategoryBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }
  }

  if (typeof value !== 'string') {
    return null;
  }

  switch (value.trim().toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
    case 'si':
    case 'visible':
    case 'show':
    case 'shown':
    case 'active':
    case 'enabled':
      return true;
    case '0':
    case 'false':
    case 'no':
    case 'hidden':
    case 'hide':
    case 'deleted':
    case 'inactive':
    case 'disabled':
    case 'archived':
      return false;
    default:
      return null;
  }
}

function normalizeCategorySortOrder(value: unknown) {
  return normalizeCategoryNumber(value);
}

function normalizeCategoryVisibility(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const directVisibility =
    normalizeCategoryBoolean(candidate.visible) ??
    normalizeCategoryBoolean(candidate.isVisible) ??
    normalizeCategoryBoolean(candidate.visibility);

  if (directVisibility !== null) {
    return directVisibility;
  }

  const hiddenFlag =
    normalizeCategoryBoolean(candidate.hidden) ??
    normalizeCategoryBoolean(candidate.isHidden) ??
    normalizeCategoryBoolean(candidate.deleted);

  if (hiddenFlag !== null) {
    return !hiddenFlag;
  }

  const enabledFlag =
    normalizeCategoryBoolean(candidate.active) ??
    normalizeCategoryBoolean(candidate.enabled);

  if (enabledFlag !== null) {
    return enabledFlag;
  }

  const status = normalizeCategoryText(candidate.status).toLowerCase();

  if (status === 'visible' || status === 'active' || status === 'enabled') {
    return true;
  }

  if (
    status === 'hidden' ||
    status === 'inactive' ||
    status === 'disabled' ||
    status === 'archived' ||
    status === 'deleted'
  ) {
    return false;
  }

  return null;
}

function normalizeCategoryMetadata(
  value: unknown,
): { sortOrder?: number; isHidden?: boolean } {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const candidate = value as Record<string, unknown>;
  const sortOrder =
    normalizeCategorySortOrder(candidate.sortOrder) ??
    normalizeCategorySortOrder(candidate.order) ??
    normalizeCategorySortOrder(candidate.displayOrder) ??
    normalizeCategorySortOrder(candidate.position) ??
    normalizeCategorySortOrder(candidate.index) ??
    normalizeCategorySortOrder(candidate.rank) ??
    normalizeCategorySortOrder(candidate.sequence);
  const visibility = normalizeCategoryVisibility(candidate);
  const isHidden = visibility === null ? undefined : !visibility;

  return {
    ...(sortOrder !== null ? { sortOrder } : {}),
    ...(typeof isHidden === 'boolean' ? { isHidden } : {}),
  };
}

function finalizeCategoryMetadata(
  metadata: LocalCategoryMetadata | { sortOrder?: number; isHidden?: boolean },
) {
  const nextMetadata: LocalCategoryMetadata = {};

  if (metadata.sortOrder !== undefined) {
    nextMetadata.sortOrder = metadata.sortOrder;
  }

  if (metadata.isHidden === true) {
    nextMetadata.isHidden = true;
  }

  return nextMetadata;
}

function hasLocalCategoryMetadata(metadata: LocalCategoryMetadata | undefined) {
  return Boolean(metadata && (metadata.sortOrder !== undefined || metadata.isHidden === true));
}

function extractCategoryId(value: unknown) {
  if (typeof value === 'string') {
    return normalizeCategoryText(value);
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const candidate = value as Record<string, unknown>;

  return (
    normalizeCategoryText(candidate.id) ||
    normalizeCategoryText(candidate.categoryId) ||
    normalizeCategoryText(candidate.key) ||
    normalizeCategoryText(candidate.value)
  );
}

function dedupeCategoryStrings(values: string[]) {
  return Array.from(new Set(values));
}

function normalizeCategoryIdList(value: unknown, fallbackValue: string[] = []) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,;|]+/g)
      : [];

  const normalizedValues = rawValues
    .map((item) => extractCategoryId(item))
    .filter((item) => item.length > 0);

  if (normalizedValues.length > 0) {
    return dedupeCategoryStrings(normalizedValues);
  }

  return dedupeCategoryStrings(
    fallbackValue
      .map((item) => extractCategoryId(item))
      .filter((item) => item.length > 0),
  );
}

function normalizeCategoryBooleanEntries(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [] as Array<[string, boolean]>;
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([rawId, rawValue]) => {
    const categoryId = normalizeCategoryText(rawId);
    const normalizedValue = normalizeCategoryBoolean(rawValue);

    return categoryId && normalizedValue !== null
      ? [[categoryId, normalizedValue] as [string, boolean]]
      : [];
  });
}

function normalizeCategoryOrderEntries(value: unknown) {
  if (Array.isArray(value) || typeof value === 'string') {
    return normalizeCategoryIdList(value).map(
      (categoryId, index) => [categoryId, index] as [string, number],
    );
  }

  if (!value || typeof value !== 'object') {
    return [] as Array<[string, number]>;
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([rawId, rawValue]) => {
    const categoryId = normalizeCategoryText(rawId);
    const sortOrder = normalizeCategorySortOrder(rawValue);

    return categoryId && sortOrder !== null ? [[categoryId, sortOrder] as [string, number]] : [];
  });
}

function normalizeCategoryNameEntries(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [] as Array<[string, string]>;
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([rawId, rawValue]) => {
    const categoryId = normalizeCategoryText(rawId);
    const name = normalizeCategoryText(rawValue);

    return categoryId && name ? [[categoryId, name] as [string, string]] : [];
  });
}

function normalizeCategoryMetadataEntries(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [] as Array<[string, LocalCategoryMetadata]>;
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([rawId, rawValue]) => {
    const categoryId = normalizeCategoryText(rawId);
    const metadata = finalizeCategoryMetadata(normalizeCategoryMetadata(rawValue));

    return categoryId && hasLocalCategoryMetadata(metadata)
      ? [[categoryId, metadata] as [string, LocalCategoryMetadata]]
      : [];
  });
}

function normalizeCategoryRecord(value: unknown): LocalCategory | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const id =
    normalizeCategoryText(candidate.id) ||
    normalizeCategoryText(candidate.categoryId) ||
    normalizeCategoryText(candidate.key);
  const name =
    normalizeCategoryText(candidate.name) ||
    normalizeCategoryText(candidate.label) ||
    normalizeCategoryText(candidate.title);

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    ...finalizeCategoryMetadata(normalizeCategoryMetadata(candidate)),
  };
}

function normalizeCategoryCollection(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((category) => normalizeCategoryRecord(category))
      .filter((category): category is LocalCategory => category !== null);
  }

  if (!value || typeof value !== 'object') {
    return [] as LocalCategory[];
  }

  return Object.entries(value as Record<string, unknown>)
    .map(([entryKey, category]) => {
      if (typeof category === 'string') {
        return normalizeCategoryRecord({ id: entryKey, name: category });
      }

      if (category && typeof category === 'object') {
        return normalizeCategoryRecord({
          key: entryKey,
          ...(category as Record<string, unknown>),
        });
      }

      return null;
    })
    .filter((category): category is LocalCategory => category !== null);
}

function mergeLocalCategoryMetadata(
  currentMetadata: LocalCategoryMetadata | undefined,
  nextMetadata: LocalCategoryMetadata | { sortOrder?: number; isHidden?: boolean } | undefined,
) {
  if (!nextMetadata) {
    return currentMetadata ?? {};
  }

  return {
    ...(currentMetadata?.sortOrder !== undefined ? { sortOrder: currentMetadata.sortOrder } : {}),
    ...(nextMetadata.sortOrder !== undefined ? { sortOrder: nextMetadata.sortOrder } : {}),
    ...(currentMetadata?.isHidden !== undefined ? { isHidden: currentMetadata.isHidden } : {}),
    ...(nextMetadata.isHidden !== undefined ? { isHidden: nextMetadata.isHidden } : {}),
  } satisfies { sortOrder?: number; isHidden?: boolean };
}

function mergeLocalCategoryRecord(
  currentCategory: LocalCategory | undefined,
  nextCategory: LocalCategory,
) {
  return {
    id: nextCategory.id,
    name: nextCategory.name || currentCategory?.name || nextCategory.id,
    ...finalizeCategoryMetadata(
      mergeLocalCategoryMetadata(currentCategory, nextCategory),
    ),
  } satisfies LocalCategory;
}

function createEmptyLocalCategoryOverrides(): LocalCategoryOverrides {
  return {
    categories: [],
    deletedCategoryIds: [],
    metadataById: {},
  };
}

function getLocalCategoryStorageKeys(brand: Brand) {
  return [
    ...LOCAL_CATEGORY_STORAGE_KEY_PREFIXES.map((prefix) => `${prefix}_${brand}`),
    ...Object.values(LEGACY_LOCAL_CATEGORY_STORAGE_KEYS).map((getKey) => getKey(brand)),
  ];
}

function getPersistedLocalCategoryMetadataMap(overrides: LocalCategoryOverrides) {
  const metadataMap = new Map<string, { sortOrder?: number; isHidden?: boolean }>();

  const registerMetadata = (
    categoryId: string,
    metadata: LocalCategoryMetadata | { sortOrder?: number; isHidden?: boolean } | undefined,
  ) => {
    const normalizedId = normalizeCategoryText(categoryId);

    if (!normalizedId || !metadata) {
      return;
    }

    metadataMap.set(
      normalizedId,
      mergeLocalCategoryMetadata(metadataMap.get(normalizedId), metadata),
    );
  };

  overrides.categories.forEach((category) => {
    registerMetadata(category.id, category);
  });

  Object.entries(overrides.metadataById ?? {}).forEach(([categoryId, metadata]) => {
    registerMetadata(categoryId, metadata);
  });

  overrides.deletedCategoryIds.forEach((categoryId) => {
    registerMetadata(categoryId, { isHidden: true });
  });

  return Object.fromEntries(
    Array.from(metadataMap.entries()).flatMap(([categoryId, metadata]) => {
      const finalizedMetadata = finalizeCategoryMetadata(metadata);

      return hasLocalCategoryMetadata(finalizedMetadata)
        ? [[categoryId, finalizedMetadata] as [string, LocalCategoryMetadata]]
        : [];
    }),
  );
}

function hasStoredLocalCategoryChanges(overrides: LocalCategoryOverrides) {
  return (
    overrides.categories.length > 0 ||
    overrides.deletedCategoryIds.length > 0 ||
    Object.keys(overrides.metadataById ?? {}).length > 0
  );
}

function dispatchLocalCategoryChangeEvent(brand: Brand, storageKey: string) {
  LOCAL_CATEGORY_EVENT_NAMES.forEach((eventName) => {
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: { brand, storageKey },
      }),
    );
  });
}

function findCurrentVisibleCategoryIndex(
  categories: Category[],
  overrides: LocalCategoryOverrides,
  categoryId: string,
) {
  return getAppliedLocalCategories(categories, overrides).findIndex(
    (category) => category.id === categoryId,
  );
}

export function normalizeLocalCategoryOverrides(value: unknown): LocalCategoryOverrides {
  if (Array.isArray(value)) {
    const categoryMap = new Map<string, LocalCategory>();

    normalizeCategoryCollection(value).forEach((category) => {
      categoryMap.set(
        category.id,
        mergeLocalCategoryRecord(categoryMap.get(category.id), category),
      );
    });

    const categories = Array.from(categoryMap.values()).map((category) =>
      sanitizeLocalCategory(category),
    );
    const metadataById = getPersistedLocalCategoryMetadataMap({
      categories,
      deletedCategoryIds: [],
      metadataById: {},
    });

    return {
      categories,
      deletedCategoryIds: [],
      metadataById,
    };
  }

  const candidate =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;

  if (!candidate) {
    return createEmptyLocalCategoryOverrides();
  }

  const categoryMap = new Map<string, LocalCategory>();
  const metadataMap = new Map<string, { sortOrder?: number; isHidden?: boolean }>();
  const hiddenCategoryIds = new Set<string>();

  const registerCategory = (category: LocalCategory) => {
    categoryMap.set(
      category.id,
      mergeLocalCategoryRecord(categoryMap.get(category.id), category),
    );
  };

  const registerMetadata = (
    categoryId: string,
    metadata: LocalCategoryMetadata | { sortOrder?: number; isHidden?: boolean } | undefined,
  ) => {
    const normalizedId = normalizeCategoryText(categoryId);

    if (!normalizedId || !metadata) {
      return;
    }

    metadataMap.set(
      normalizedId,
      mergeLocalCategoryMetadata(metadataMap.get(normalizedId), metadata),
    );
  };

  [
    candidate.categories,
    candidate.localCategories,
    candidate.customCategories,
    candidate.items,
    candidate.overrides,
    candidate.list,
    candidate.entities,
  ].forEach((rawCollection) => {
    normalizeCategoryCollection(rawCollection).forEach(registerCategory);
  });

  [
    candidate.renamedCategories,
    candidate.categoryNames,
    candidate.namesById,
    candidate.nameOverrides,
  ].forEach((rawNames) => {
    normalizeCategoryNameEntries(rawNames).forEach(([categoryId, name]) => {
      registerCategory({ id: categoryId, name });
    });
  });

  [
    candidate.metadataById,
    candidate.categoryMetadata,
    candidate.metaById,
    candidate.categoryMeta,
    candidate.metadata,
    candidate.meta,
  ].forEach((rawMetadata) => {
    normalizeCategoryMetadataEntries(rawMetadata).forEach(([categoryId, metadata]) => {
      registerMetadata(categoryId, metadata);
    });
  });

  [
    candidate.sortOrders,
    candidate.categorySortOrders,
    candidate.sortOrderByCategoryId,
    candidate.orderByCategoryId,
    candidate.orderById,
    candidate.categoryOrder,
    candidate.categoryOrderIds,
    candidate.orderedCategoryIds,
    candidate.sortedCategoryIds,
    candidate.reorderedCategoryIds,
    candidate.categoryPositions,
  ].forEach((rawOrderState) => {
    normalizeCategoryOrderEntries(rawOrderState).forEach(([categoryId, sortOrder]) => {
      registerMetadata(categoryId, { sortOrder });
    });
  });

  [
    candidate.deletedCategoryIds,
    candidate.deletedIds,
    candidate.removedCategoryIds,
    candidate.hiddenCategoryIds,
    candidate.hiddenIds,
    candidate.invisibleCategoryIds,
  ].forEach((rawIds) => {
    normalizeCategoryIdList(rawIds).forEach((categoryId) => {
      hiddenCategoryIds.add(categoryId);
      registerMetadata(categoryId, { isHidden: true });
    });
  });

  [
    candidate.categoryVisibility,
    candidate.categoryVisibilityMap,
    candidate.visibilityByCategoryId,
    candidate.visibleByCategoryId,
    candidate.hiddenByCategoryId,
    candidate.isHiddenById,
  ].forEach((visibilityMap) => {
    normalizeCategoryBooleanEntries(visibilityMap).forEach(([categoryId, isVisible]) => {
      registerMetadata(categoryId, { isHidden: !isVisible });

      if (isVisible) {
        hiddenCategoryIds.delete(categoryId);
      } else {
        hiddenCategoryIds.add(categoryId);
      }
    });
  });

  const metadataById = Object.fromEntries(
    Array.from(metadataMap.entries()).flatMap(([categoryId, metadata]) => {
      const finalizedMetadata = finalizeCategoryMetadata(metadata);

      if (metadata.isHidden === false) {
        hiddenCategoryIds.delete(categoryId);
      } else if (metadata.isHidden === true) {
        hiddenCategoryIds.add(categoryId);
      }

      return hasLocalCategoryMetadata(finalizedMetadata)
        ? [[categoryId, finalizedMetadata] as [string, LocalCategoryMetadata]]
        : [];
    }),
  );

  const categories = Array.from(categoryMap.values()).map((category) =>
    sanitizeLocalCategory({
      ...category,
      ...(metadataById[category.id] ?? {}),
    }),
  );

  return {
    categories,
    deletedCategoryIds: Array.from(hiddenCategoryIds),
    metadataById,
  };
}

export function sanitizeLocalCategory(category: Category | LocalCategory): LocalCategory {
  return (
    normalizeCategoryRecord(category) ?? {
      ...category,
      id: normalizeCategoryText(category.id),
      name: normalizeCategoryText(category.name),
    }
  );
}

export function mergeLocalCategory(
  baseCategory: Category | LocalCategory,
  patch: Partial<LocalCategory>,
): LocalCategory {
  return (
    normalizeCategoryRecord({
      ...baseCategory,
      ...patch,
    }) ?? sanitizeLocalCategory(baseCategory)
  );
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

export function createLocalCategoryId(kind: LocalCatalogCategoryIdKind = 'local') {
  return formatLocalCategoryId(
    kind,
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
}

export function getLocalCategoryStorageKey(brand: Brand) {
  return `${LOCAL_CATEGORY_STORAGE_PREFIX}_${brand}`;
}

export function readLocalCategoryOverrides(brand: Brand) {
  if (!canUseCategoryStorage()) {
    return createEmptyLocalCategoryOverrides();
  }

  for (const storageKey of getLocalCategoryStorageKeys(brand)) {
    const rawValue = localStorage.getItem(storageKey);

    if (!rawValue) {
      continue;
    }

    const normalizedOverrides = normalizeLocalCategoryOverrides(
      safeParseJson<unknown>(rawValue, null),
    );

    if (hasStoredLocalCategoryChanges(normalizedOverrides)) {
      return normalizedOverrides;
    }
  }

  return createEmptyLocalCategoryOverrides();
}

export function getLocalCategoryMetadata(
  categoryId: string,
  overrides: LocalCategoryOverrides,
) {
  return getPersistedLocalCategoryMetadataMap(normalizeLocalCategoryOverrides(overrides))[
    normalizeCategoryText(categoryId)
  ] ?? {};
}

export function isLocalCategoryHidden(
  categoryId: string,
  overrides: LocalCategoryOverrides,
) {
  return getLocalCategoryMetadata(categoryId, overrides).isHidden === true;
}

export function isCustomCatalogCategoryId(categoryId: string) {
  return Object.values(LOCAL_CATEGORY_ID_PREFIXES).some((prefix) =>
    normalizeCategoryText(categoryId).startsWith(prefix),
  );
}

export function hasLocalCatalogCategoryOverride(
  categoryId: string,
  overrides: LocalCategoryOverrides,
) {
  const normalizedCategoryId = normalizeCategoryText(categoryId);

  if (!normalizedCategoryId) {
    return false;
  }

  return (
    overrides.categories.some((category) => category.id === normalizedCategoryId) ||
    hasLocalCategoryMetadata(getLocalCategoryMetadata(normalizedCategoryId, overrides))
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
    !isLocalCategoryHidden(categoryId, overrides)
  );
}

export function isEditedLocalCatalogCategory(
  categoryId: string,
  overrides: LocalCategoryOverrides,
) {
  if (isCustomCatalogCategoryId(categoryId) || isLocalCategoryHidden(categoryId, overrides)) {
    return false;
  }

  const metadata = getLocalCategoryMetadata(categoryId, overrides);

  return (
    overrides.categories.some((category) => category.id === categoryId) ||
    hasLocalCategoryMetadata(metadata)
  );
}

export function getLocalCatalogCategoryChangeKind(
  categoryId: string,
  overrides: LocalCategoryOverrides,
): LocalCatalogCategoryChangeKind {
  if (isLocalCategoryHidden(categoryId, overrides)) {
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

export function countLocalCategoryChanges(
  overrides: LocalCategoryOverrides,
  baseCategories: Category[] = [],
) {
  const normalizedOverrides = normalizeLocalCategoryOverrides(overrides);
  const baseCategoryMap = new Map(
    baseCategories.map((category) => {
      const normalizedCategory = sanitizeLocalCategory(category);
      return [normalizedCategory.id, normalizedCategory] as const;
    }),
  );
  const changedCategoryIds = new Set<string>();
  const metadataById = getPersistedLocalCategoryMetadataMap(normalizedOverrides);

  normalizedOverrides.categories.forEach((category) => {
    const baseCategory = baseCategoryMap.get(category.id);
    const metadata = metadataById[category.id] ?? {};

    if (
      !baseCategory ||
      isCustomCatalogCategoryId(category.id) ||
      baseCategory.name !== category.name ||
      metadata.sortOrder !== undefined ||
      metadata.isHidden === true
    ) {
      changedCategoryIds.add(category.id);
    }
  });

  Object.entries(metadataById).forEach(([categoryId, metadata]) => {
    if (metadata.sortOrder !== undefined || metadata.isHidden === true) {
      changedCategoryIds.add(categoryId);
    }
  });

  normalizedOverrides.deletedCategoryIds.forEach((categoryId) => {
    changedCategoryIds.add(categoryId);
  });

  return changedCategoryIds.size;
}

export function getLocalCategoryChangesCount(brand: Brand, baseCategories: Category[] = []) {
  return countLocalCategoryChanges(readLocalCategoryOverrides(brand), baseCategories);
}

export function saveLocalCategoryOverrides(brand: Brand, overrides: LocalCategoryOverrides) {
  const normalizedOverrides = normalizeLocalCategoryOverrides(overrides);
  const storageKey = getLocalCategoryStorageKey(brand);

  if (!canUseCategoryStorage()) {
    return normalizedOverrides;
  }

  getLocalCategoryStorageKeys(brand).forEach((key) => {
    if (key !== storageKey) {
      localStorage.removeItem(key);
    }
  });

  if (hasStoredLocalCategoryChanges(normalizedOverrides)) {
    localStorage.setItem(storageKey, JSON.stringify(normalizedOverrides));
  } else {
    localStorage.removeItem(storageKey);
  }

  dispatchLocalCategoryChangeEvent(brand, storageKey);
  return normalizedOverrides;
}

export function upsertLocalCategory(
  brand: Brand,
  category: Category | LocalCategory,
  metadata: LocalCategoryMetadata = {},
) {
  const currentOverrides = readLocalCategoryOverrides(brand);
  const nextCategory = sanitizeLocalCategory({
    ...category,
    ...metadata,
  });
  const currentCategoryIndex = currentOverrides.categories.findIndex(
    (existingCategory) => existingCategory.id === nextCategory.id,
  );
  const nextCategories =
    currentCategoryIndex >= 0
      ? currentOverrides.categories.map((existingCategory, index) =>
          index === currentCategoryIndex
            ? mergeLocalCategory(existingCategory, nextCategory)
            : existingCategory,
        )
      : [...currentOverrides.categories, nextCategory];
  const nextMetadataById = {
    ...getPersistedLocalCategoryMetadataMap(currentOverrides),
  };
  const nextCategoryMetadata = finalizeCategoryMetadata(
    mergeLocalCategoryMetadata(nextMetadataById[nextCategory.id], nextCategory),
  );

  if (hasLocalCategoryMetadata(nextCategoryMetadata)) {
    nextMetadataById[nextCategory.id] = nextCategoryMetadata;
  } else {
    delete nextMetadataById[nextCategory.id];
  }

  const nextDeletedCategoryIds =
    nextCategoryMetadata.isHidden === true
      ? normalizeCategoryIdList([...currentOverrides.deletedCategoryIds, nextCategory.id])
      : currentOverrides.deletedCategoryIds.filter((categoryId) => categoryId !== nextCategory.id);

  return saveLocalCategoryOverrides(brand, {
    categories: nextCategories,
    deletedCategoryIds: nextDeletedCategoryIds,
    metadataById: nextMetadataById,
  });
}

export function deleteLocalCategory(brand: Brand, categoryId: string) {
  const currentOverrides = readLocalCategoryOverrides(brand);
  const normalizedCategoryId = normalizeCategoryText(categoryId);
  const nextMetadataById = {
    ...getPersistedLocalCategoryMetadataMap(currentOverrides),
  };

  delete nextMetadataById[normalizedCategoryId];

  return saveLocalCategoryOverrides(brand, {
    categories: currentOverrides.categories.filter((category) => category.id !== normalizedCategoryId),
    deletedCategoryIds: currentOverrides.deletedCategoryIds.filter(
      (deletedCategoryId) => deletedCategoryId !== normalizedCategoryId,
    ),
    metadataById: nextMetadataById,
  });
}

export function setLocalCategoryHidden(
  brand: Brand,
  categoryId: string,
  isHidden: boolean,
) {
  const currentOverrides = readLocalCategoryOverrides(brand);
  const normalizedCategoryId = normalizeCategoryText(categoryId);
  const nextMetadataById = {
    ...getPersistedLocalCategoryMetadataMap(currentOverrides),
  };
  const nextMetadata = finalizeCategoryMetadata(
    mergeLocalCategoryMetadata(nextMetadataById[normalizedCategoryId], { isHidden }),
  );

  if (hasLocalCategoryMetadata(nextMetadata)) {
    nextMetadataById[normalizedCategoryId] = nextMetadata;
  } else {
    delete nextMetadataById[normalizedCategoryId];
  }

  return saveLocalCategoryOverrides(brand, {
    categories: currentOverrides.categories,
    deletedCategoryIds: isHidden
      ? normalizeCategoryIdList([...currentOverrides.deletedCategoryIds, normalizedCategoryId])
      : currentOverrides.deletedCategoryIds.filter(
          (deletedCategoryId) => deletedCategoryId !== normalizedCategoryId,
        ),
    metadataById: nextMetadataById,
  });
}

export function toggleLocalCategoryHidden(brand: Brand, categoryId: string) {
  const currentOverrides = readLocalCategoryOverrides(brand);

  return setLocalCategoryHidden(
    brand,
    categoryId,
    !isLocalCategoryHidden(categoryId, currentOverrides),
  );
}

export function getAppliedLocalCategories(
  categories: Category[],
  overrides: LocalCategoryOverrides,
  options: { includeHidden?: boolean } = {},
) {
  const normalizedOverrides = normalizeLocalCategoryOverrides(overrides);
  const metadataById = getPersistedLocalCategoryMetadataMap(normalizedOverrides);
  const categoryOverrideMap = new Map(
    normalizedOverrides.categories.map((category) => [category.id, category] as const),
  );
  const appliedCategories: Array<
    LocalCategory & { fallbackIndex: number; hasExplicitSortOrder: boolean }
  > = [];
  const seenCategoryIds = new Set<string>();

  categories.forEach((category, index) => {
    const normalizedCategory = sanitizeLocalCategory(category);
    const overrideCategory = categoryOverrideMap.get(normalizedCategory.id);
    const metadata = metadataById[normalizedCategory.id] ?? {};
    const sortOrder = metadata.sortOrder ?? overrideCategory?.sortOrder;
    const isHidden = metadata.isHidden ?? overrideCategory?.isHidden;

    appliedCategories.push({
      ...sanitizeLocalCategory({
        ...normalizedCategory,
        name: overrideCategory?.name ?? normalizedCategory.name,
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(isHidden === true ? { isHidden: true } : {}),
      }),
      fallbackIndex: index,
      hasExplicitSortOrder: sortOrder !== undefined,
    });
    seenCategoryIds.add(normalizedCategory.id);
  });

  normalizedOverrides.categories.forEach((category, index) => {
    if (seenCategoryIds.has(category.id)) {
      return;
    }

    const metadata = metadataById[category.id] ?? {};
    const sortOrder = metadata.sortOrder ?? category.sortOrder;
    const isHidden = metadata.isHidden ?? category.isHidden;

    appliedCategories.push({
      ...sanitizeLocalCategory({
        ...category,
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(isHidden === true ? { isHidden: true } : {}),
      }),
      fallbackIndex: categories.length + index,
      hasExplicitSortOrder: sortOrder !== undefined,
    });
  });

  const orderedCategories = [...appliedCategories]
    .sort((leftCategory, rightCategory) => {
      const leftOrder = leftCategory.sortOrder ?? leftCategory.fallbackIndex;
      const rightOrder = rightCategory.sortOrder ?? rightCategory.fallbackIndex;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      if (leftCategory.hasExplicitSortOrder !== rightCategory.hasExplicitSortOrder) {
        return leftCategory.hasExplicitSortOrder ? -1 : 1;
      }

      if (leftCategory.fallbackIndex !== rightCategory.fallbackIndex) {
        return leftCategory.fallbackIndex - rightCategory.fallbackIndex;
      }

      return leftCategory.id.localeCompare(rightCategory.id);
    })
    .filter((category) => options.includeHidden || category.isHidden !== true)
    .map(({ fallbackIndex, hasExplicitSortOrder, ...category }) => category);

  return orderedCategories;
}

export function applyLocalCategoryOverrides(
  categories: Category[],
  overrides: LocalCategoryOverrides,
) {
  return getAppliedLocalCategories(categories, overrides).map((category) => ({
    id: category.id,
    name: category.name,
  }));
}

export function reorderLocalCategoryOverrides(
  categories: Category[],
  overrides: LocalCategoryOverrides,
  categoryId: string,
  targetIndex: number,
) {
  const normalizedOverrides = normalizeLocalCategoryOverrides(overrides);
  const visibleCategories = getAppliedLocalCategories(categories, normalizedOverrides);
  const currentIndex = visibleCategories.findIndex((category) => category.id === categoryId);

  if (currentIndex < 0 || visibleCategories.length === 0) {
    return normalizedOverrides;
  }

  const clampedTargetIndex = Math.max(
    0,
    Math.min(targetIndex, visibleCategories.length - 1),
  );

  if (clampedTargetIndex === currentIndex) {
    return normalizedOverrides;
  }

  const reorderedCategories = [...visibleCategories];
  const [movedCategory] = reorderedCategories.splice(currentIndex, 1);

  reorderedCategories.splice(clampedTargetIndex, 0, movedCategory);

  const nextMetadataById = {
    ...getPersistedLocalCategoryMetadataMap(normalizedOverrides),
  };

  reorderedCategories.forEach((category, index) => {
    const nextMetadata = finalizeCategoryMetadata(
      mergeLocalCategoryMetadata(nextMetadataById[category.id], { sortOrder: index }),
    );

    if (hasLocalCategoryMetadata(nextMetadata)) {
      nextMetadataById[category.id] = nextMetadata;
    } else {
      delete nextMetadataById[category.id];
    }
  });

  return normalizeLocalCategoryOverrides({
    categories: normalizedOverrides.categories,
    deletedCategoryIds: normalizedOverrides.deletedCategoryIds,
    metadataById: nextMetadataById,
  });
}

export function moveLocalCategory(
  brand: Brand,
  categories: Category[],
  categoryId: string,
  targetIndex: number,
) {
  return saveLocalCategoryOverrides(
    brand,
    reorderLocalCategoryOverrides(
      categories,
      readLocalCategoryOverrides(brand),
      categoryId,
      targetIndex,
    ),
  );
}

export function moveLocalCategoryUp(brand: Brand, categories: Category[], categoryId: string) {
  const currentOverrides = readLocalCategoryOverrides(brand);
  const currentIndex = findCurrentVisibleCategoryIndex(categories, currentOverrides, categoryId);

  return currentIndex > 0
    ? saveLocalCategoryOverrides(
        brand,
        reorderLocalCategoryOverrides(
          categories,
          currentOverrides,
          categoryId,
          currentIndex - 1,
        ),
      )
    : currentOverrides;
}

export function moveLocalCategoryDown(
  brand: Brand,
  categories: Category[],
  categoryId: string,
) {
  const currentOverrides = readLocalCategoryOverrides(brand);
  const currentIndex = findCurrentVisibleCategoryIndex(categories, currentOverrides, categoryId);

  return currentIndex >= 0
    ? saveLocalCategoryOverrides(
        brand,
        reorderLocalCategoryOverrides(
          categories,
          currentOverrides,
          categoryId,
          currentIndex + 1,
        ),
      )
    : currentOverrides;
}

export function clearLocalCategoryOverrides(brand: Brand) {
  if (!canUseCategoryStorage()) {
    return;
  }

  const storageKey = getLocalCategoryStorageKey(brand);

  getLocalCategoryStorageKeys(brand).forEach((key) => {
    localStorage.removeItem(key);
  });

  dispatchLocalCategoryChangeEvent(brand, storageKey);
}

export function isLocalCategoryStorageKeyForBrand(
  key: string | null | undefined,
  brand: Brand,
) {
  return key ? getLocalCategoryStorageKeys(brand).includes(key) : false;
}
