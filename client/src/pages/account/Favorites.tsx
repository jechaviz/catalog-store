import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  ArrowRight,
  Heart,
  Loader2,
  ShoppingBag,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { Navbar } from '@/components/app/layout/Navbar';
import { Footer } from '@/components/app/layout/Footer';
import { ProductCard } from '@/components/domain/product/ProductCard';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent } from '@/components/shared/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { useCart } from '@/hooks/useCart';
import { useStorefrontSettings } from '@/hooks/useStorefrontSettings';
import { fetchCatalogData, type CatalogData, type CatalogProduct } from '@/lib/dataFetcher';
import {
  applyLocalCatalogOverrides,
  isCustomCatalogProductId,
  isLocalCatalogStorageKeyForBrand,
  readLocalCatalogOverrides,
} from '@/lib/adminCatalogStorage';
import {
  isLikesStorageKeyForBrand,
  readBrandLikeIds,
  toggleBrandLikeId,
} from '@/lib/storefrontStorage';

const ProductDetail = lazy(() =>
  import('@/components/domain/product/ProductDetail').then((module) => ({
    default: module.ProductDetail,
  })),
);

const CartDrawer = lazy(() =>
  import('@/components/domain/cart/CartDrawer').then((module) => ({
    default: module.CartDrawer,
  })),
);

const ContactFormModal = lazy(() =>
  import('@/components/shared/ui/ContactFormModal').then((module) => ({
    default: module.ContactFormModal,
  })),
);

type LocalCatalogSummary = {
  customProductsCount: number;
  editedProductsCount: number;
  deletedProductsCount: number;
};

type LocalCategorySummary = {
  activeCategoriesCount: number;
  deletedCategoriesCount: number;
  renamedCategoriesCount: number;
  hasCustomOrder: boolean;
};

const LOCAL_CATEGORY_EVENT_NAMES = [
  'catalog-local-categories-changed',
  'catalog-local-category-changed',
] as const;
const LOCAL_CATEGORY_STORAGE_PREFIXES = [
  'catalog_local_categories_',
  'catalog_local_category_',
  'catalog-local-categories:',
  'catalog-local-category:',
  'categories_local_',
  'category_local_',
] as const;
const LOCAL_CATEGORY_ID_PREFIXES = [
  'local-category-',
  'draft-category-',
  'copy-category-',
  'custom-category-',
  'local-',
  'draft-',
  'copy-',
  'custom-',
] as const;
const LOCAL_CATEGORY_COLLECTION_KEYS = ['overrides', 'items', 'list'] as const;
const LOCAL_CATEGORY_FALLBACK_COLLECTION_KEYS = ['categories'] as const;
const LOCAL_CATEGORY_HIDDEN_KEYS = [
  'deletedCategoryIds',
  'deletedIds',
  'removedCategoryIds',
  'hiddenCategoryIds',
  'hiddenIds',
] as const;
const LOCAL_CATEGORY_RENAMED_KEYS = [
  'renamedCategories',
  'renamedById',
  'namesById',
  'displayNames',
  'labelsById',
] as const;
const LOCAL_CATEGORY_ORDER_KEYS = [
  'orderedCategoryIds',
  'categoryOrder',
  'categoryOrderById',
  'orderById',
  'positions',
  'positionById',
  'sortOrder',
  'sortById',
  'displayOrder',
  'displayOrderById',
] as const;

type LocalCategorySummaryAccumulator = {
  activeCategoryIds: Set<string>;
  hiddenCategoryIds: Set<string>;
  renamedCategoryIds: Set<string>;
  anonymousActiveCount: number;
  anonymousHiddenCount: number;
  anonymousRenamedCount: number;
  hasCustomOrder: boolean;
};

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

function countArrayEntries(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined).length : 0;
}

function countObjectEntries(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value as Record<string, unknown>).length
    : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isLikelyLocalCategoryId(categoryId: string | null) {
  if (!categoryId) {
    return false;
  }

  const normalizedCategoryId = categoryId.trim().toLowerCase();
  return LOCAL_CATEGORY_ID_PREFIXES.some((prefix) => normalizedCategoryId.startsWith(prefix));
}

function getCategoryEntryId(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    return normalizedValue || null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const candidateId = [value.id, value.categoryId, value.category_id, value.key, value.value].find(
    (candidate) => typeof candidate === 'string' && candidate.trim().length > 0,
  );

  return typeof candidateId === 'string' ? candidateId.trim() : null;
}

function hasBooleanFlag(
  record: Record<string, unknown>,
  keys: readonly string[],
  expectedValue: boolean,
) {
  return keys.some(
    (key) => key in record && typeof record[key] === 'boolean' && record[key] === expectedValue,
  );
}

function isHiddenCategoryEntry(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasBooleanFlag(value, ['hidden', 'isHidden', 'deleted', 'isDeleted', 'removed', 'isRemoved'], true) ||
    hasBooleanFlag(value, ['visible', 'isVisible'], false)
  );
}

function isCustomCategoryEntry(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }

  const categoryId = getCategoryEntryId(value);
  const source = typeof value.source === 'string' ? value.source.trim().toLowerCase() : '';

  return (
    isLikelyLocalCategoryId(categoryId) ||
    hasBooleanFlag(value, ['custom', 'isCustom', 'local', 'isLocal', 'createdLocally', 'isNew'], true) ||
    source === 'local' ||
    source === 'custom'
  );
}

function isRenamedCategoryEntry(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.renamedTo === 'string' && value.renamedTo.trim().length > 0) {
    return true;
  }

  const nextName = typeof value.name === 'string' ? value.name.trim() : '';
  const previousName = [value.originalName, value.previousName, value.baseName, value.defaultName].find(
    (candidate) => typeof candidate === 'string' && candidate.trim().length > 0,
  );

  return typeof previousName === 'string' && nextName.length > 0 && previousName.trim() !== nextName;
}

function hasCustomOrderEntry(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }

  return ['order', 'position', 'sortOrder', 'displayOrder', 'rank', 'index'].some(
    (key) => key in value && (typeof value[key] === 'number' || typeof value[key] === 'string'),
  );
}

function createLocalCategorySummaryAccumulator(): LocalCategorySummaryAccumulator {
  return {
    activeCategoryIds: new Set<string>(),
    hiddenCategoryIds: new Set<string>(),
    renamedCategoryIds: new Set<string>(),
    anonymousActiveCount: 0,
    anonymousHiddenCount: 0,
    anonymousRenamedCount: 0,
    hasCustomOrder: false,
  };
}

function addActiveCategory(summary: LocalCategorySummaryAccumulator, categoryId: string | null) {
  if (categoryId) {
    summary.activeCategoryIds.add(categoryId);
    return;
  }

  summary.anonymousActiveCount += 1;
}

function addHiddenCategory(summary: LocalCategorySummaryAccumulator, categoryId: string | null) {
  if (categoryId) {
    summary.hiddenCategoryIds.add(categoryId);
    return;
  }

  summary.anonymousHiddenCount += 1;
}

function addRenamedCategory(summary: LocalCategorySummaryAccumulator, categoryId: string | null) {
  if (categoryId) {
    summary.renamedCategoryIds.add(categoryId);
    return;
  }

  summary.anonymousRenamedCount += 1;
}

function summarizeExplicitCategoryCollection(
  value: unknown,
  summary: LocalCategorySummaryAccumulator,
) {
  if (!Array.isArray(value)) {
    return;
  }

  for (const entry of value) {
    const categoryId = getCategoryEntryId(entry);

    if (hasCustomOrderEntry(entry)) {
      summary.hasCustomOrder = true;
    }

    if (isHiddenCategoryEntry(entry)) {
      addHiddenCategory(summary, categoryId);
      continue;
    }

    addActiveCategory(summary, categoryId);

    if (isRenamedCategoryEntry(entry)) {
      addRenamedCategory(summary, categoryId);
    }
  }
}

function summarizeGenericCategoryCollection(
  value: unknown,
  summary: LocalCategorySummaryAccumulator,
) {
  if (!Array.isArray(value)) {
    return;
  }

  for (const entry of value) {
    const categoryId = getCategoryEntryId(entry);

    if (hasCustomOrderEntry(entry)) {
      summary.hasCustomOrder = true;
    }

    if (isHiddenCategoryEntry(entry)) {
      addHiddenCategory(summary, categoryId);
      continue;
    }

    if (isRenamedCategoryEntry(entry)) {
      addRenamedCategory(summary, categoryId);
    }

    if (isCustomCategoryEntry(entry)) {
      addActiveCategory(summary, categoryId);
      continue;
    }

    if (!isRecord(entry)) {
      addActiveCategory(summary, categoryId);
      continue;
    }

    const hasOnlyLegacyShape =
      typeof entry.name === 'string' &&
      !hasBooleanFlag(entry, ['visible', 'isVisible'], false) &&
      !hasBooleanFlag(entry, ['hidden', 'isHidden', 'deleted', 'isDeleted', 'removed', 'isRemoved'], true) &&
      !hasCustomOrderEntry(entry);

    if (hasOnlyLegacyShape) {
      addActiveCategory(summary, categoryId);
    }
  }
}

function summarizeRenamedCategoryMap(value: unknown, summary: LocalCategorySummaryAccumulator) {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      addRenamedCategory(summary, getCategoryEntryId(entry));
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const categoryId of Object.keys(value)) {
    addRenamedCategory(summary, categoryId.trim() || null);
  }
}

function summarizeHiddenCategoryIds(value: unknown, summary: LocalCategorySummaryAccumulator) {
  if (!Array.isArray(value)) {
    return;
  }

  for (const entry of value) {
    addHiddenCategory(summary, getCategoryEntryId(entry));
  }
}

function registerCustomOrder(value: unknown, summary: LocalCategorySummaryAccumulator) {
  if (
    countArrayEntries(value) > 0 ||
    countObjectEntries(value) > 0 ||
    (typeof value === 'string' && value.trim().length > 0)
  ) {
    summary.hasCustomOrder = true;
  }
}

function finalizeLocalCategorySummary(
  summary: LocalCategorySummaryAccumulator,
): LocalCategorySummary {
  const activeCategoryIds = Array.from(summary.activeCategoryIds).filter(
    (categoryId) => !summary.hiddenCategoryIds.has(categoryId),
  );
  const renamedCategoryIds = Array.from(summary.renamedCategoryIds).filter(
    (categoryId) => !summary.hiddenCategoryIds.has(categoryId),
  );

  return {
    activeCategoriesCount: activeCategoryIds.length + summary.anonymousActiveCount,
    deletedCategoriesCount: summary.hiddenCategoryIds.size + summary.anonymousHiddenCount,
    renamedCategoriesCount: renamedCategoryIds.length + summary.anonymousRenamedCount,
    hasCustomOrder: summary.hasCustomOrder,
  };
}

function parseLocalCategorySummary(rawValue: string | null): LocalCategorySummary {
  const parsedValue = safeParseJson<unknown>(rawValue, null);
  const summary = createLocalCategorySummaryAccumulator();

  if (Array.isArray(parsedValue)) {
    summarizeGenericCategoryCollection(parsedValue, summary);
    return finalizeLocalCategorySummary(summary);
  }

  if (!isRecord(parsedValue)) {
    return finalizeLocalCategorySummary(summary);
  }

  summarizeExplicitCategoryCollection(parsedValue.customCategories, summary);
  summarizeExplicitCategoryCollection(parsedValue.addedCategories, summary);
  summarizeExplicitCategoryCollection(parsedValue.createdCategories, summary);

  LOCAL_CATEGORY_RENAMED_KEYS.forEach((key) => {
    summarizeRenamedCategoryMap(parsedValue[key], summary);
  });
  LOCAL_CATEGORY_HIDDEN_KEYS.forEach((key) => {
    summarizeHiddenCategoryIds(parsedValue[key], summary);
  });
  LOCAL_CATEGORY_ORDER_KEYS.forEach((key) => {
    registerCustomOrder(parsedValue[key], summary);
  });
  LOCAL_CATEGORY_COLLECTION_KEYS.forEach((key) => {
    summarizeGenericCategoryCollection(parsedValue[key], summary);
  });

  const hasExplicitShape =
    'customCategories' in parsedValue ||
    'addedCategories' in parsedValue ||
    'createdCategories' in parsedValue ||
    LOCAL_CATEGORY_RENAMED_KEYS.some((key) => key in parsedValue) ||
    LOCAL_CATEGORY_HIDDEN_KEYS.some((key) => key in parsedValue) ||
    LOCAL_CATEGORY_ORDER_KEYS.some((key) => key in parsedValue) ||
    LOCAL_CATEGORY_COLLECTION_KEYS.some((key) => key in parsedValue);

  if (!hasExplicitShape) {
    LOCAL_CATEGORY_FALLBACK_COLLECTION_KEYS.forEach((key) => {
      summarizeGenericCategoryCollection(parsedValue[key], summary);
    });
  }

  return finalizeLocalCategorySummary(summary);
}

function hasLocalCategoryChanges(summary: LocalCategorySummary) {
  return (
    summary.activeCategoriesCount > 0 ||
    summary.deletedCategoriesCount > 0 ||
    summary.renamedCategoriesCount > 0 ||
    summary.hasCustomOrder
  );
}

function formatLocalCategorySummary(summary: LocalCategorySummary) {
  const parts: string[] = [];

  if (summary.activeCategoriesCount > 0) {
    parts.push(
      `${summary.activeCategoriesCount} categoria${summary.activeCategoriesCount === 1 ? '' : 's'} local${summary.activeCategoriesCount === 1 ? '' : 'es'}`,
    );
  }

  if (summary.renamedCategoriesCount > 0) {
    parts.push(
      `${summary.renamedCategoriesCount} renombrada${summary.renamedCategoriesCount === 1 ? '' : 's'}`,
    );
  }

  if (summary.deletedCategoriesCount > 0) {
    parts.push(
      `${summary.deletedCategoriesCount} oculta${summary.deletedCategoriesCount === 1 ? '' : 's'}`,
    );
  }

  if (summary.hasCustomOrder) {
    parts.push('orden local aplicado');
  }

  return parts.join(', ');
}

function getLocalCategorySummary(brand: 'natura' | 'nikken'): LocalCategorySummary {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return {
      activeCategoriesCount: 0,
      deletedCategoriesCount: 0,
      renamedCategoriesCount: 0,
      hasCustomOrder: false,
    };
  }

  return Object.keys(localStorage)
    .filter((storageKey) => isLocalCategoryStorageKeyForBrand(storageKey, brand))
    .reduce<LocalCategorySummary>(
      (summary, storageKey) => {
        const partialSummary = parseLocalCategorySummary(localStorage.getItem(storageKey));

        return {
          activeCategoriesCount: summary.activeCategoriesCount + partialSummary.activeCategoriesCount,
          deletedCategoriesCount:
            summary.deletedCategoriesCount + partialSummary.deletedCategoriesCount,
          renamedCategoriesCount:
            summary.renamedCategoriesCount + partialSummary.renamedCategoriesCount,
          hasCustomOrder: summary.hasCustomOrder || partialSummary.hasCustomOrder,
        };
      },
      {
        activeCategoriesCount: 0,
        deletedCategoriesCount: 0,
        renamedCategoriesCount: 0,
        hasCustomOrder: false,
      },
    );
}

function isLocalCategoryStorageKeyForBrand(
  key: string | null | undefined,
  brand: 'natura' | 'nikken',
) {
  if (!key) {
    return false;
  }

  const normalizedKey = key.toLowerCase();
  const normalizedBrand = brand.toLowerCase();

  return (
    LOCAL_CATEGORY_STORAGE_PREFIXES.some(
      (prefix) =>
        normalizedKey === `${prefix}${normalizedBrand}` ||
        normalizedKey.startsWith(`${prefix}${normalizedBrand}_`) ||
        normalizedKey.startsWith(`${prefix}${normalizedBrand}:`),
    ) ||
    (normalizedKey.includes(brand) &&
      normalizedKey.includes('local') &&
      normalizedKey.includes('categor'))
  );
}

function getLocalCatalogSummary(brand: 'natura' | 'nikken'): LocalCatalogSummary {
  const overrides = readLocalCatalogOverrides(brand);
  const customProductsCount = overrides.products.filter((product) =>
    isCustomCatalogProductId(product.id),
  ).length;

  return {
    customProductsCount,
    editedProductsCount: Math.max(overrides.products.length - customProductsCount, 0),
    deletedProductsCount: overrides.deletedProductIds.length,
  };
}

export default function Favorites() {
  const { user } = useAuth();
  const { brand, isNikken } = useBrand();
  const storefrontSettings = useStorefrontSettings(brand);
  const cart = useCart();
  const [, setLocation] = useLocation();

  const [data, setData] = useState<CatalogData | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [hasLocalCatalogOverrides, setHasLocalCatalogOverrides] = useState(false);
  const [localCatalogSummary, setLocalCatalogSummary] = useState<LocalCatalogSummary>({
    customProductsCount: 0,
    editedProductsCount: 0,
    deletedProductsCount: 0,
  });
  const [hasLocalCategoryOverrides, setHasLocalCategoryOverrides] = useState(false);
  const [localCategorySummary, setLocalCategorySummary] = useState<LocalCategorySummary>({
    activeCategoriesCount: 0,
    deletedCategoriesCount: 0,
    renamedCategoriesCount: 0,
    hasCustomOrder: false,
  });
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [quickBuyProduct, setQuickBuyProduct] = useState<CatalogProduct | null>(null);

  const brandLabel = isNikken ? 'Nikken' : 'Natura';
  const homePath = isNikken ? '/nikken' : '/';
  const accountBasePath = isNikken ? '/nikken/account' : '/account';
  const checkoutPath = isNikken ? '/nikken/checkout' : '/checkout';
  const userId = user?.id ?? null;
  const activeProfileLabel = user?.name?.trim() || user?.email || 'Perfil activo';

  useEffect(() => {
    const syncFavoriteIds = () => {
      setFavoriteIds(readBrandLikeIds(brand, userId));
    };

    const handleLikesChanged = (event: Event) => {
      const storageKey = (event as CustomEvent<{ storageKey?: string }>).detail?.storageKey;

      if (!storageKey || isLikesStorageKeyForBrand(storageKey, brand)) {
        syncFavoriteIds();
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (!event.key || isLikesStorageKeyForBrand(event.key, brand)) {
        syncFavoriteIds();
      }
    };

    syncFavoriteIds();
    window.addEventListener('catalog-likes-changed', handleLikesChanged as EventListener);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('catalog-likes-changed', handleLikesChanged as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [brand, userId]);

  useEffect(() => {
    let isMounted = true;

    const syncLocalCatalogState = () => {
      try {
        const overrides = readLocalCatalogOverrides(brand);
        const categorySummary = getLocalCategorySummary(brand);
        setLocalCatalogSummary(getLocalCatalogSummary(brand));
        setHasLocalCatalogOverrides(
          overrides.products.length > 0 || overrides.deletedProductIds.length > 0,
        );
        setLocalCategorySummary(categorySummary);
        setHasLocalCategoryOverrides(hasLocalCategoryChanges(categorySummary));
      } catch {
        setHasLocalCatalogOverrides(false);
        setLocalCatalogSummary({
          customProductsCount: 0,
          editedProductsCount: 0,
          deletedProductsCount: 0,
        });
        setHasLocalCategoryOverrides(false);
        setLocalCategorySummary({
          activeCategoriesCount: 0,
          deletedCategoriesCount: 0,
          renamedCategoriesCount: 0,
          hasCustomOrder: false,
        });
      }
    };

    const loadCatalog = async () => {
      try {
        setLoading(true);
        setHasLoadError(false);
        const catalogData = await fetchCatalogData(brand);

        if (!isMounted) {
          return;
        }

        const overrides = readLocalCatalogOverrides(brand);
        const categorySummary = getLocalCategorySummary(brand);
        setLocalCatalogSummary(getLocalCatalogSummary(brand));
        const nextCatalogData = catalogData
          ? {
              ...catalogData,
              products: applyLocalCatalogOverrides(catalogData.products, overrides),
            }
          : null;

        setData(nextCatalogData);
        setHasLoadError(!nextCatalogData);
        setHasLocalCatalogOverrides(
          overrides.products.length > 0 || overrides.deletedProductIds.length > 0,
        );
        setLocalCategorySummary(categorySummary);
        setHasLocalCategoryOverrides(hasLocalCategoryChanges(categorySummary));

        if (!nextCatalogData) {
          setSelectedProduct(null);
          setQuickBuyProduct(null);
          return;
        }

        const productsById = new Map(
          nextCatalogData.products.map((product) => [product.id, product]),
        );
        setSelectedProduct((currentProduct) =>
          currentProduct ? productsById.get(currentProduct.id) ?? null : null,
        );
        setQuickBuyProduct((currentProduct) =>
          currentProduct ? productsById.get(currentProduct.id) ?? null : null,
        );
      } catch (error) {
        console.error('Error loading favorites catalog:', error);

        if (!isMounted) {
          return;
        }

        setData(null);
        setHasLoadError(true);
        syncLocalCatalogState();
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    setSelectedProduct(null);

    const handleLocalProductsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ brand?: string; storageKey?: string }>).detail;

      if (detail?.brand === brand || isLocalCatalogStorageKeyForBrand(detail?.storageKey, brand)) {
        void loadCatalog();
      }
    };

    const handleLocalCategoriesChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ brand?: string; storageKey?: string }>).detail;

      if (detail?.brand === brand || isLocalCategoryStorageKeyForBrand(detail?.storageKey, brand)) {
        void loadCatalog();
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (
        isLocalCatalogStorageKeyForBrand(event.key, brand) ||
        isLocalCategoryStorageKeyForBrand(event.key, brand)
      ) {
        void loadCatalog();
      }
    };

    void loadCatalog();
    window.addEventListener(
      'catalog-local-products-changed',
      handleLocalProductsChanged as EventListener,
    );
    LOCAL_CATEGORY_EVENT_NAMES.forEach((eventName) => {
      window.addEventListener(eventName, handleLocalCategoriesChanged as EventListener);
    });
    window.addEventListener('storage', handleStorageChange);

    return () => {
      isMounted = false;
      window.removeEventListener(
        'catalog-local-products-changed',
        handleLocalProductsChanged as EventListener,
      );
      LOCAL_CATEGORY_EVENT_NAMES.forEach((eventName) => {
        window.removeEventListener(eventName, handleLocalCategoriesChanged as EventListener);
      });
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [brand]);

  const favoriteProducts = useMemo(() => {
    if (!data) {
      return [];
    }

    const productsById = new Map(data.products.map((product) => [product.id, product]));
    return favoriteIds
      .map((id) => productsById.get(id))
      .filter((product): product is CatalogProduct => Boolean(product));
  }, [data, favoriteIds]);

  const missingFavoritesCount = Math.max(favoriteIds.length - favoriteProducts.length, 0);

  const heroCopy = isNikken
    ? 'Guarda tus sistemas y esenciales de bienestar para retomarlos cuando quieras.'
    : 'Reune tus productos y rutinas favoritas para comprar con mas calma cuando te convenga.';
  const localCategorySummaryText = formatLocalCategorySummary(localCategorySummary);
  const hasHiddenLocalCategories = localCategorySummary.deletedCategoriesCount > 0;

  return (
    <div className={`min-h-screen flex flex-col bg-slate-50 ${isNikken ? 'theme-nikken' : ''}`}>
      <Navbar
        categories={[]}
        activeCategory=""
        onCategorySelect={() => {}}
        onSearchChange={() => {}}
        cartItemCount={cart.itemCount}
        onCartClick={() => cart.setIsDrawerOpen(true)}
        products={[]}
      />

      <main className="container max-w-6xl flex-1 px-4 py-12">
        <section className="mb-10">
          <div className="rounded-[2rem] border border-primary/10 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
                  <Heart className="h-3.5 w-3.5" />
                  Favoritos {brandLabel}
                </div>
                <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <UserIcon className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-slate-900">{activeProfileLabel}</span>
                  <span className="hidden text-slate-300 sm:inline">|</span>
                  <span>Esta lista pertenece al perfil activo.</span>
                  {hasLocalCatalogOverrides ? (
                    <>
                      <span className="hidden text-slate-300 sm:inline">|</span>
                      <span className="text-primary">Catalogo local activo</span>
                    </>
                  ) : null}
                  {hasLocalCategoryOverrides ? (
                    <>
                      <span className="hidden text-slate-300 sm:inline">|</span>
                      <span className="text-primary/80">{localCategorySummaryText}</span>
                    </>
                  ) : null}
                </div>
                <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  Tu lista guardada por marca activa
                </h1>
                <p className="mt-3 text-base leading-relaxed text-slate-500 sm:text-lg">
                  {heroCopy}
                </p>
                <p className="mt-4 text-sm font-medium text-slate-600">
                  Toca el corazon en cualquier tarjeta para quitar productos de esta lista y usa el
                  carrito para cerrar tu compra mas rapido.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <Button
                  variant="outline"
                  className="rounded-xl border-slate-200 text-slate-700"
                  onClick={() => cart.setIsDrawerOpen(true)}
                >
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  Ver carrito ({cart.itemCount})
                </Button>
                <Link href={homePath}>
                  <Button className="rounded-xl px-6">
                    Explorar {brandLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
            <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
            <h2 className="text-xl font-bold text-slate-900">Cargando tus favoritos...</h2>
            <p className="mt-2 text-slate-500">
              Estamos consultando el catalogo activo de {brandLabel}.
            </p>
          </div>
        ) : hasLoadError || !data ? (
          <Card className="overflow-hidden border-none shadow-sm">
            <CardContent className="p-10 text-center sm:p-12">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <Heart className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                No pudimos cargar tus favoritos
              </h2>
              <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-slate-500">
                Ocurrio un problema al leer el catalogo de {brandLabel}. Puedes volver al inicio e
                intentarlo de nuevo sin perder tu lista guardada.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href={homePath}>
                  <Button className="rounded-xl px-6">Volver al catalogo</Button>
                </Link>
                <Link href={`${accountBasePath}/orders`}>
                  <Button
                    variant="ghost"
                    className="rounded-xl px-6 text-slate-600 hover:text-slate-900"
                  >
                    Ver pedidos
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : favoriteIds.length === 0 ? (
          <Card className="overflow-hidden border-none shadow-sm">
            <CardContent className="p-10 text-center sm:p-12">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Heart className="h-7 w-7 fill-current" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                Aun no tienes favoritos de {brandLabel}
              </h2>
              <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-slate-500">
                Cuando marques productos con el corazon en el catalogo de {brandLabel}, apareceran
                aqui para que los compares, los agregues al carrito o los retomes despues.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href={homePath}>
                  <Button className="rounded-xl px-6">Descubrir productos</Button>
                </Link>
                <Link href={`${accountBasePath}/orders`}>
                  <Button
                    variant="ghost"
                    className="rounded-xl px-6 text-slate-600 hover:text-slate-900"
                  >
                    Ir a mis pedidos
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : favoriteProducts.length === 0 ? (
          <Card className="overflow-hidden border-none shadow-sm">
            <CardContent className="p-10 text-center sm:p-12">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                Tus favoritos no estan visibles ahora
              </h2>
              <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-slate-500">
                Tu lista guardada tiene {favoriteIds.length} referencia
                {favoriteIds.length === 1 ? '' : 's'}, pero ningun producto coincide con el
                catalogo activo de {brandLabel}
                {hasHiddenLocalCategories
                  ? '. Hay categorias ocultas en esta marca, asi que algunos favoritos pueden reaparecer cuando vuelvan a mostrarse.'
                  : '. Explora la tienda para guardar nuevos favoritos vigentes.'}
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href={homePath}>
                  <Button className="rounded-xl px-6">Explorar catalogo actual</Button>
                </Link>
                <Link href={`${accountBasePath}/returns`}>
                  <Button
                    variant="ghost"
                    className="rounded-xl px-6 text-slate-600 hover:text-slate-900"
                  >
                    Centro de devoluciones
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {favoriteProducts.length} favorito{favoriteProducts.length === 1 ? '' : 's'} listo
                  {favoriteProducts.length === 1 ? '' : 's'} para comprar
                </h2>
                <p className="mt-2 text-slate-500">
                  Vista filtrada por la marca activa. Puedes abrir el detalle, quitar productos o
                  agregarlos directo al carrito.
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Mostrando lo guardado por{' '}
                  <span className="font-semibold text-slate-700">{activeProfileLabel}</span>.
                </p>
                {hasLocalCatalogOverrides ? (
                  <p className="mt-1 text-sm text-primary/80">
                    Esta vista incluye {localCatalogSummary.customProductsCount} nuevo{localCatalogSummary.customProductsCount === 1 ? '' : 's'}, {localCatalogSummary.editedProductsCount} editado{localCatalogSummary.editedProductsCount === 1 ? '' : 's'} y {localCatalogSummary.deletedProductsCount} oculto{localCatalogSummary.deletedProductsCount === 1 ? '' : 's'} del catalogo local.
                  </p>
                ) : null}
                {hasLocalCategoryOverrides ? (
                  <p className="mt-1 text-sm text-primary/70">
                    Categorias locales: {localCategorySummaryText}.
                  </p>
                ) : null}
              </div>
              {missingFavoritesCount > 0 ? (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {missingFavoritesCount} favorito{missingFavoritesCount === 1 ? '' : 's'} no
                  aparece{missingFavoritesCount === 1 ? '' : 'n'} en el catalogo actual de{' '}
                  {brandLabel}
                  {hasHiddenLocalCategories ? ' o quedo dentro de categorias ocultas.' : '.'}
                </div>
              ) : null}
            </section>

            <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-3 xl:grid-cols-4">
              {favoriteProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onViewDetail={setSelectedProduct}
                  onQuickBuy={setQuickBuyProduct}
                  onAddToCart={(currentProduct) => cart.addItem(currentProduct, 1)}
                />
              ))}
            </section>
          </>
        )}
      </main>

      {cart.isDrawerOpen ? (
        <Suspense fallback={null}>
          <CartDrawer
            isOpen={cart.isDrawerOpen}
            onClose={() => cart.setIsDrawerOpen(false)}
            onProceedToCheckout={() => {
              cart.setIsDrawerOpen(false);
              setLocation(checkoutPath);
            }}
          />
        </Suspense>
      ) : null}

      {quickBuyProduct ? (
        <Suspense fallback={null}>
          <ContactFormModal
            product={quickBuyProduct}
            isOpen={!!quickBuyProduct}
            onClose={() => setQuickBuyProduct(null)}
            sellerPhone={storefrontSettings.sellerPhone}
          />
        </Suspense>
      ) : null}

      {selectedProduct ? (
        <Suspense fallback={null}>
          <ProductDetail
            product={selectedProduct}
            isOpen={!!selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onBuy={(product) => {
              cart.addItem(product, 1);
              setSelectedProduct(null);
            }}
            isLiked={readBrandLikeIds(brand, userId).includes(selectedProduct.id)}
            onToggleLike={() => {
              toggleBrandLikeId(brand, selectedProduct.id, userId);
              setSelectedProduct({ ...selectedProduct });
            }}
          />
        </Suspense>
      ) : null}

      <Footer />
    </div>
  );
}
