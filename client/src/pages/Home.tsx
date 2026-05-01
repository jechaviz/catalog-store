import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { fetchCatalogData, type CatalogData, type CatalogProduct } from '@/lib/dataFetcher';
import { Navbar } from '@/components/app/layout/Navbar';
import { ProductCard } from '@/components/domain/product/ProductCard';
import { ThemeSelector } from '@/components/shared/ui/ThemeSelector';
import { LazyCatalogPdfGenerator } from '@/components/domain/catalog/LazyCatalogPdfGenerator';
import { Footer } from '@/components/app/layout/Footer';
import { useCart } from '@/hooks/useCart';
import { useStorefrontSettings } from '@/hooks/useStorefrontSettings';
import { useTheme } from '@/hooks/useTheme';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { useLocation } from 'wouter';
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

export default function Home() {
  const [data, setData] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryStatusMessage, setCategoryStatusMessage] = useState<string | null>(null);

  const [, setLocation] = useLocation();

  const { user } = useAuth();
  const { theme } = useTheme();
  const { brand, isNikken } = useBrand();
  const storefrontSettings = useStorefrontSettings(brand);
  const cart = useCart();
  const userId = user?.id ?? null;
  const activeProfileLabel = user?.name?.trim() || user?.email || 'tu perfil activo';
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [hasHeroImageError, setHasHeroImageError] = useState(false);
  const activeCategoryRef = useRef('');

  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [quickBuyProduct, setQuickBuyProduct] = useState<CatalogProduct | null>(null);

  useEffect(() => {
    activeCategoryRef.current = activeCategory;
  }, [activeCategory]);

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

    const loadData = async () => {
      try {
        setLoading(true);
        const catalogInfo = await fetchCatalogData(brand);

        if (!isMounted) {
          return;
        }

        const overrides = readLocalCatalogOverrides(brand);
        const categorySummary = getLocalCategorySummary(brand);
        setLocalCatalogSummary(getLocalCatalogSummary(brand));
        const nextCatalogInfo = catalogInfo
          ? {
              ...catalogInfo,
              products: applyLocalCatalogOverrides(catalogInfo.products, overrides),
            }
          : null;

        setData(nextCatalogInfo);
        setHasLocalCatalogOverrides(
          overrides.products.length > 0 || overrides.deletedProductIds.length > 0,
        );
        setLocalCategorySummary(categorySummary);
        setHasLocalCategoryOverrides(hasLocalCategoryChanges(categorySummary));

        if (!nextCatalogInfo) {
          setActiveCategory('');
          setCategoryStatusMessage(null);
          setSelectedProduct(null);
          setQuickBuyProduct(null);
          return;
        }

        const currentActiveCategory = activeCategoryRef.current;
        const activeCategoryStillExists =
          !currentActiveCategory ||
          nextCatalogInfo.categories.some((category) => category.id === currentActiveCategory);

        if (!activeCategoryStillExists) {
          setActiveCategory('');
          setCategoryStatusMessage(
            'La categoria que estabas viendo se oculto o ya no esta disponible. Te mostramos el catalogo actual.',
          );
        } else if (!currentActiveCategory) {
          setCategoryStatusMessage(null);
        }

        const productsById = new Map(
          nextCatalogInfo.products.map((product) => [product.id, product]),
        );
        setSelectedProduct((currentProduct) =>
          currentProduct ? productsById.get(currentProduct.id) ?? null : null,
        );
        setQuickBuyProduct((currentProduct) =>
          currentProduct ? productsById.get(currentProduct.id) ?? null : null,
        );
      } catch (error) {
        console.error('Error loading storefront data:', error);

        if (!isMounted) {
          return;
        }

        syncLocalCatalogState();
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const handleLocalProductsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ brand?: string; storageKey?: string }>).detail;

      if (detail?.brand === brand || isLocalCatalogStorageKeyForBrand(detail?.storageKey, brand)) {
        void loadData();
      }
    };

    const handleLocalCategoriesChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ brand?: string; storageKey?: string }>).detail;

      if (detail?.brand === brand || isLocalCategoryStorageKeyForBrand(detail?.storageKey, brand)) {
        void loadData();
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (
        isLocalCatalogStorageKeyForBrand(event.key, brand) ||
        isLocalCategoryStorageKeyForBrand(event.key, brand)
      ) {
        void loadData();
      }
    };

    void loadData();
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

  useEffect(() => {
    setActiveCategory('');
    setCategoryStatusMessage(null);
  }, [brand]);

  useEffect(() => {
    setHasHeroImageError(false);
  }, [brand, storefrontSettings.heroImageUrl]);

  useEffect(() => {
    const syncFavoriteCount = () => {
      try {
        setFavoriteCount(readBrandLikeIds(brand, userId).length);
      } catch {
        setFavoriteCount(0);
      }
    };

    const handleLikesChanged = (event: Event) => {
      const storageKey = (event as CustomEvent<{ storageKey?: string }>).detail?.storageKey;

      if (!storageKey || isLikesStorageKeyForBrand(storageKey, brand)) {
        syncFavoriteCount();
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (!event.key || isLikesStorageKeyForBrand(event.key, brand)) {
        syncFavoriteCount();
      }
    };

    syncFavoriteCount();
    window.addEventListener('catalog-likes-changed', handleLikesChanged as EventListener);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('catalog-likes-changed', handleLikesChanged as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [brand, userId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background/50">
        <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
        <h2 className="heading animate-pulse text-xl font-bold text-primary">
          Cargando catalogo...
        </h2>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background/50 p-6 text-center">
        <h2 className="heading mb-4 text-3xl font-bold text-red-500">Ups! Algo salio mal</h2>
        <p className="body max-w-md text-muted-foreground">
          No pudimos conectar con el servidor de Odoo y los datos de respaldo no estan
          disponibles. Por favor, revisa la configuracion en tu archivo .env.
        </p>
      </div>
    );
  }

  const filteredProducts = data.products.filter((product) => {
    const matchesCategory = activeCategory === '' || product.categoryId === activeCategory;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      product.name.toLowerCase().includes(searchLower) ||
      product.brand.toLowerCase().includes(searchLower) ||
      product.subBrand.toLowerCase().includes(searchLower) ||
      product.description.toLowerCase().includes(searchLower);

    const matchesTheme =
      isNikken || searchQuery !== '' || product.gender === theme || product.gender === 'unisex';

    return matchesCategory && matchesSearch && matchesTheme;
  });

  const heroEyebrow = storefrontSettings.heroEyebrow.trim();
  const heroTitle = storefrontSettings.siteName.trim();
  const heroSlogan = storefrontSettings.slogan.trim();
  const heroDescription = storefrontSettings.heroDescription.trim();
  const heroImageUrl = storefrontSettings.heroImageUrl.trim();
  const shouldShowHeroImage = Boolean(heroImageUrl) && !hasHeroImageError;
  const localCategorySummaryText = formatLocalCategorySummary(localCategorySummary);
  const handleCategorySelect = (categoryId: string) => {
    setCategoryStatusMessage(null);
    setActiveCategory(categoryId);
  };

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20 transition-colors duration-500">
      <Navbar
        categories={data.categories}
        activeCategory={activeCategory}
        onCategorySelect={handleCategorySelect}
        onSearchChange={setSearchQuery}
        cartItemCount={cart.itemCount}
        onCartClick={() => cart.setIsDrawerOpen(true)}
        products={data.products}
      />

      <main className="container relative mx-auto min-h-[80vh] px-4 py-8 md:py-12">
        {!searchQuery && !activeCategory ? (
          <div className="mx-auto mb-12 max-w-6xl md:mb-16">
            <div className="grid gap-8 overflow-hidden rounded-[2.5rem] border border-primary/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),rgba(255,255,255,0.82)_45%,rgba(249,115,22,0.08)_100%)] p-6 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)] transition-colors duration-500 md:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] md:p-10 lg:p-12">
              <div className="flex flex-col justify-center">
                <div className="mb-6 flex flex-wrap items-center gap-3">
                  <div className="rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary transition-colors duration-500">
                    {heroEyebrow || (isNikken ? 'Tecnologia Japonesa' : 'Coleccion 2026')}
                  </div>
                  {!isNikken ? <ThemeSelector /> : null}
                  {data.products ? <LazyCatalogPdfGenerator products={data.products} /> : null}
                </div>

                <h2 className="display text-4xl font-black leading-tight text-foreground transition-colors duration-500 md:text-5xl lg:text-6xl">
                  {heroTitle}
                </h2>
                <p className="mt-4 max-w-2xl text-lg font-semibold uppercase tracking-[0.2em] text-primary/80 transition-colors duration-500">
                  {heroSlogan}
                </p>
                <p className="body mt-5 max-w-2xl text-lg leading-8 text-muted-foreground transition-colors duration-500">
                  {heroDescription}
                </p>

                <div className="mt-8 inline-flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl border border-primary/10 bg-background/80 px-4 py-3 text-sm text-muted-foreground shadow-sm transition-colors duration-500">
                  <span className="font-semibold text-foreground/90">{activeProfileLabel}</span>
                  <span className="hidden text-primary/50 sm:inline">|</span>
                  <span>
                    {favoriteCount} favorito{favoriteCount !== 1 ? 's' : ''} guardado
                    {favoriteCount !== 1 ? 's' : ''} en {heroTitle}
                  </span>
                  <span className="hidden text-primary/50 md:inline">|</span>
                  <span className="hidden md:inline">
                    Tus likes y guardados se aplican a este perfil activo.
                  </span>
                  {hasLocalCatalogOverrides ? (
                    <>
                      <span className="hidden text-primary/50 md:inline">|</span>
                      <span className="text-primary/80">
                        {localCatalogSummary.customProductsCount > 0
                          ? `${localCatalogSummary.customProductsCount} producto${localCatalogSummary.customProductsCount === 1 ? '' : 's'} nuevo${localCatalogSummary.customProductsCount === 1 ? '' : 's'}`
                          : `${localCatalogSummary.editedProductsCount} editado${localCatalogSummary.editedProductsCount === 1 ? '' : 's'} local${localCatalogSummary.editedProductsCount === 1 ? '' : 'es'}`}
                      </span>
                    </>
                  ) : null}
                  {hasLocalCategoryOverrides ? (
                    <>
                      <span className="hidden text-primary/50 md:inline">|</span>
                      <span className="text-primary/70">{localCategorySummaryText}</span>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="relative flex min-h-[260px] items-center justify-center">
                <div className="absolute inset-8 rounded-[2rem] bg-gradient-to-br from-primary/15 via-transparent to-secondary/20 blur-2xl" />
                <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-[2rem] border border-white/60 bg-white/85 p-4 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-primary/70">
                        {heroEyebrow || heroTitle}
                      </p>
                      <p className="mt-2 text-lg font-bold text-slate-900">{heroTitle}</p>
                    </div>
                    <div className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                      {isNikken ? 'Wellness' : 'Catalogo'}
                    </div>
                  </div>

                  {shouldShowHeroImage ? (
                    <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary/5 via-white to-secondary/10">
                      <img
                        src={heroImageUrl}
                        alt={heroTitle}
                        className="h-[280px] w-full object-cover md:h-[360px]"
                        onError={() => setHasHeroImageError(true)}
                      />
                    </div>
                  ) : (
                    <div className="flex h-[280px] flex-col justify-end rounded-[1.75rem] bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.16),transparent_35%),linear-gradient(160deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9),rgba(241,245,249,0.86))] p-6 md:h-[360px]">
                      <div className="max-w-xs rounded-[1.5rem] border border-primary/10 bg-white/80 p-5 shadow-sm backdrop-blur">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary/70">
                          Seleccion activa
                        </p>
                        <p className="mt-3 text-2xl font-black text-slate-900">{heroTitle}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {heroDescription}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h3 className="heading border-l-4 border-primary pl-4 text-2xl font-bold text-foreground/90 transition-colors duration-500">
              {activeCategory
                ? data.categories.find((category) => category.id === activeCategory)?.name
                : searchQuery
                  ? `Resultados para "${searchQuery}"`
                  : 'Productos Para Ti'}
            </h3>
            <p className="ml-4 mt-2 text-sm font-semibold text-muted-foreground">
              {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''}{' '}
              encontrado{filteredProducts.length !== 1 ? 's' : ''}
            </p>
            <p className="ml-4 mt-1 text-xs text-muted-foreground/90">
              Perfil activo:{' '}
              <span className="font-semibold text-foreground/80">{activeProfileLabel}</span>
            </p>
            {categoryStatusMessage ? (
              <p className="ml-4 mt-1 text-xs text-amber-700">{categoryStatusMessage}</p>
            ) : null}
            {hasLocalCatalogOverrides ? (
              <p className="ml-4 mt-1 text-xs text-primary/80">
                Vista actualizada con {localCatalogSummary.customProductsCount} nuevo{localCatalogSummary.customProductsCount === 1 ? '' : 's'}, {localCatalogSummary.editedProductsCount} editado{localCatalogSummary.editedProductsCount === 1 ? '' : 's'} y {localCatalogSummary.deletedProductsCount} oculto{localCatalogSummary.deletedProductsCount === 1 ? '' : 's'} localmente.
              </p>
            ) : null}
            {hasLocalCategoryOverrides ? (
              <p className="ml-4 mt-1 text-xs text-primary/70">
                Categorias locales: {localCategorySummaryText}.
              </p>
            ) : null}
          </div>

          {!isNikken && (searchQuery || activeCategory) ? (
            <div className="hidden sm:block">
              <ThemeSelector />
            </div>
          ) : null}
        </div>

        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onViewDetail={setSelectedProduct}
                onQuickBuy={setQuickBuyProduct}
                onAddToCart={(currentProduct) => cart.addItem(currentProduct, 1)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 transition-colors duration-500">
              <span className="text-4xl">?</span>
            </div>
            <h3 className="heading mb-2 text-2xl font-bold text-foreground transition-colors duration-500">
              No encontramos lo que buscas
            </h3>
            <p className="body max-w-md text-muted-foreground transition-colors duration-500">
              {isNikken
                ? 'Intenta con un termino diferente o explora nuestras categorias de bienestar.'
                : 'Intenta con un termino diferente o ajusta tus preferencias de genero en el menu.'}
            </p>
          </div>
        )}
      </main>

      {cart.isDrawerOpen ? (
        <Suspense fallback={null}>
          <CartDrawer
            isOpen={cart.isDrawerOpen}
            onClose={() => cart.setIsDrawerOpen(false)}
            onProceedToCheckout={() => {
              cart.setIsDrawerOpen(false);
              setLocation(isNikken ? '/nikken/checkout' : '/checkout');
            }}
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

      {quickBuyProduct ? (
        <Suspense fallback={null}>
          <ContactFormModal
            product={quickBuyProduct}
            isOpen={!!quickBuyProduct}
            onClose={() => setQuickBuyProduct(null)}
          />
        </Suspense>
      ) : null}

      <Footer />
    </div>
  );
}
