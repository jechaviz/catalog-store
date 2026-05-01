import { useEffect, useState } from 'react';
import {
  Heart,
  LayoutDashboard,
  LogOut,
  Package,
  Repeat,
  Search,
  Settings,
  ShoppingBag,
  User as UserIcon,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { LazyCatalogPdfGenerator } from '@/components/domain/catalog/LazyCatalogPdfGenerator';
import { Input } from '@/components/shared/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { useStorefrontSettings } from '@/hooks/useStorefrontSettings';
import type { Category, CatalogProduct } from '@/lib/dataFetcher';
import {
  isLikesStorageKeyForBrand,
  readBrandLikeIds,
} from '@/lib/storefrontStorage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/shared/ui/dropdown-menu';

interface NavbarProps {
  categories: Category[];
  activeCategory: string;
  onCategorySelect: (id: string) => void;
  onSearchChange: (query: string) => void;
  cartItemCount: number;
  onCartClick: () => void;
  products: CatalogProduct[];
}

const LOCAL_CATEGORY_STORAGE_PREFIXES = [
  'catalog_local_categories_',
  'catalog_local_category_overrides_',
  'catalog_local_category_',
  'categories_local_',
  'category_local_',
  'catalog-local-categories:',
] as const;

const LOCAL_CATEGORY_EVENT_NAMES = [
  'catalog-local-categories-changed',
  'catalog-local-category-changed',
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

interface LocalCategorySummary {
  visibleCustomCount: number;
  visibleEditedCount: number;
  hiddenCategoryIds: string[];
  hasCustomOrder: boolean;
}

function isLikelyLocalCategoryId(categoryId: string) {
  const normalizedCategoryId = categoryId.trim().toLowerCase();
  return LOCAL_CATEGORY_ID_PREFIXES.some((prefix) => normalizedCategoryId.startsWith(prefix));
}

function isLocalCategoryStorageKeyForBrand(key: string | null | undefined, brand: string) {
  if (!key) {
    return false;
  }

  return LOCAL_CATEGORY_STORAGE_PREFIXES.some(
    (prefix) => key === `${prefix}${brand}` || key.startsWith(`${prefix}${brand}_`),
  );
}

function createEmptyLocalCategorySummary(): LocalCategorySummary {
  return {
    visibleCustomCount: 0,
    visibleEditedCount: 0,
    hiddenCategoryIds: [],
    hasCustomOrder: false,
  };
}

function normalizeLocalCategoryText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLocalCategoryBoolean(value: unknown): boolean | null {
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

  const normalizedValue = value.trim().toLowerCase();

  if (
    normalizedValue === 'true' ||
    normalizedValue === '1' ||
    normalizedValue === 'yes' ||
    normalizedValue === 'visible' ||
    normalizedValue === 'show' ||
    normalizedValue === 'shown' ||
    normalizedValue === 'active'
  ) {
    return true;
  }

  if (
    normalizedValue === 'false' ||
    normalizedValue === '0' ||
    normalizedValue === 'no' ||
    normalizedValue === 'hidden' ||
    normalizedValue === 'hide' ||
    normalizedValue === 'deleted' ||
    normalizedValue === 'removed' ||
    normalizedValue === 'inactive'
  ) {
    return false;
  }

  return null;
}

function normalizeLocalCategoryIdList(value: unknown): string[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,;|]+/g)
      : [];

  return Array.from(
    new Set(
      rawValues
        .map((item) => normalizeLocalCategoryText(item))
        .filter((item) => item.length > 0),
    ),
  );
}

function hasLocalCategoryOrderValue(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  return typeof value === 'string' && value.trim().length > 0;
}

function createMutableLocalCategorySummary() {
  return {
    visibleCustomIds: new Set<string>(),
    visibleEditedIds: new Set<string>(),
    hiddenCategoryIds: new Set<string>(),
    hasCustomOrder: false,
  };
}

function markVisibleLocalCategoryId(
  categoryId: string,
  summary: ReturnType<typeof createMutableLocalCategorySummary>,
) {
  const normalizedCategoryId = normalizeLocalCategoryText(categoryId);

  if (!normalizedCategoryId) {
    return;
  }

  summary.hiddenCategoryIds.delete(normalizedCategoryId);
  summary.visibleCustomIds.delete(normalizedCategoryId);
  summary.visibleEditedIds.delete(normalizedCategoryId);

  if (isLikelyLocalCategoryId(normalizedCategoryId)) {
    summary.visibleCustomIds.add(normalizedCategoryId);
    return;
  }

  summary.visibleEditedIds.add(normalizedCategoryId);
}

function markHiddenLocalCategoryId(
  categoryId: string,
  summary: ReturnType<typeof createMutableLocalCategorySummary>,
) {
  const normalizedCategoryId = normalizeLocalCategoryText(categoryId);

  if (!normalizedCategoryId) {
    return;
  }

  summary.hiddenCategoryIds.add(normalizedCategoryId);
  summary.visibleCustomIds.delete(normalizedCategoryId);
  summary.visibleEditedIds.delete(normalizedCategoryId);
}

function applyLocalCategoryEntry(
  value: unknown,
  summary: ReturnType<typeof createMutableLocalCategorySummary>,
  fallbackId = '',
) {
  if (!value) {
    return;
  }

  if (typeof value !== 'object') {
    if (fallbackId) {
      markVisibleLocalCategoryId(fallbackId, summary);
    }
    return;
  }

  const candidate = value as Record<string, unknown>;
  const categoryId =
    normalizeLocalCategoryText(candidate.id) ||
    normalizeLocalCategoryText(candidate.categoryId) ||
    fallbackId;

  if (!categoryId) {
    return;
  }

  const visibleFlag = normalizeLocalCategoryBoolean(
    candidate.visible ?? candidate.isVisible ?? candidate.enabled,
  );
  const hiddenFlag = normalizeLocalCategoryBoolean(
    candidate.hidden ??
      candidate.isHidden ??
      candidate.deleted ??
      candidate.removed ??
      candidate.archived,
  );
  const visibilityState =
    typeof candidate.visibility === 'string' ? candidate.visibility.trim().toLowerCase() : '';
  const isHidden =
    hiddenFlag === true ||
    visibleFlag === false ||
    visibilityState === 'hidden' ||
    visibilityState === 'deleted' ||
    visibilityState === 'removed' ||
    visibilityState === 'collapsed' ||
    visibilityState === 'off';

  if (
    hasLocalCategoryOrderValue(
      candidate.order ??
        candidate.sortOrder ??
        candidate.position ??
        candidate.index ??
        candidate.rank,
    )
  ) {
    summary.hasCustomOrder = true;
  }

  if (isHidden) {
    markHiddenLocalCategoryId(categoryId, summary);
    return;
  }

  markVisibleLocalCategoryId(categoryId, summary);
}

function applyLocalCategoryEntries(
  value: unknown,
  summary: ReturnType<typeof createMutableLocalCategorySummary>,
) {
  if (Array.isArray(value)) {
    value.forEach((entry) => applyLocalCategoryEntry(entry, summary));
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  Object.entries(value as Record<string, unknown>).forEach(([categoryId, entry]) => {
    applyLocalCategoryEntry(entry, summary, normalizeLocalCategoryText(categoryId));
  });
}

function applyLocalCategoryVisibilityMap(
  value: unknown,
  summary: ReturnType<typeof createMutableLocalCategorySummary>,
  mode: 'visible' | 'hidden',
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return;
  }

  Object.entries(value as Record<string, unknown>).forEach(([categoryId, rawValue]) => {
    const visibilityFlag = normalizeLocalCategoryBoolean(rawValue);

    if (visibilityFlag === null) {
      return;
    }

    if (mode === 'hidden') {
      if (visibilityFlag) {
        markHiddenLocalCategoryId(categoryId, summary);
      } else {
        markVisibleLocalCategoryId(categoryId, summary);
      }
      return;
    }

    if (visibilityFlag) {
      markVisibleLocalCategoryId(categoryId, summary);
    } else {
      markHiddenLocalCategoryId(categoryId, summary);
    }
  });
}

function applyLocalCategoryOrder(
  value: unknown,
  summary: ReturnType<typeof createMutableLocalCategorySummary>,
) {
  if (normalizeLocalCategoryIdList(value).length > 1) {
    summary.hasCustomOrder = true;
    return;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return;
  }

  const hasOrderedMapEntries = Object.entries(value as Record<string, unknown>).some(
    ([categoryId, orderValue]) =>
      normalizeLocalCategoryText(categoryId).length > 0 && hasLocalCategoryOrderValue(orderValue),
  );

  if (hasOrderedMapEntries) {
    summary.hasCustomOrder = true;
  }
}

function mergeSerializedLocalCategorySummary(
  value: unknown,
  summary: ReturnType<typeof createMutableLocalCategorySummary>,
) {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    applyLocalCategoryEntries(value, summary);
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  const candidate = value as Record<string, unknown>;

  [
    candidate.categories,
    candidate.localCategories,
    candidate.customCategories,
    candidate.items,
    candidate.list,
    candidate.overrides,
    candidate.visibleCategories,
  ].forEach((entries) => applyLocalCategoryEntries(entries, summary));

  [
    candidate.entities,
    candidate.byId,
    candidate.categoriesById,
    candidate.categoryMap,
  ].forEach((entries) => applyLocalCategoryEntries(entries, summary));

  [
    candidate.deletedCategoryIds,
    candidate.hiddenCategoryIds,
    candidate.deletedIds,
    candidate.removedCategoryIds,
    candidate.removedIds,
    candidate.hiddenIds,
  ].forEach((hiddenIds) => {
    normalizeLocalCategoryIdList(hiddenIds).forEach((categoryId) => {
      markHiddenLocalCategoryId(categoryId, summary);
    });
  });

  [
    candidate.renamedCategories,
    candidate.editedCategories,
  ].forEach((editedCategories) => {
    if (!editedCategories || typeof editedCategories !== 'object' || Array.isArray(editedCategories)) {
      return;
    }

    Object.keys(editedCategories as Record<string, unknown>).forEach((categoryId) => {
      markVisibleLocalCategoryId(categoryId, summary);
    });
  });

  applyLocalCategoryVisibilityMap(
    candidate.categoryVisibility ?? candidate.visibilityById,
    summary,
    'visible',
  );
  applyLocalCategoryVisibilityMap(candidate.hiddenById, summary, 'hidden');

  [
    candidate.orderedCategoryIds,
    candidate.categoryOrder,
    candidate.sortedCategoryIds,
    candidate.order,
    candidate.positionsById,
  ].forEach((orderValue) => applyLocalCategoryOrder(orderValue, summary));
}

function getLocalCategoryStorageKeysForBrand(brand: string) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [];
  }

  const prioritizedKeys = LOCAL_CATEGORY_STORAGE_PREFIXES.map((prefix) => `${prefix}${brand}`);
  const matchingKeys = Object.keys(localStorage).filter((key) =>
    isLocalCategoryStorageKeyForBrand(key, brand),
  );

  return Array.from(new Set([...prioritizedKeys, ...matchingKeys])).filter(
    (key) => localStorage.getItem(key) !== null,
  );
}

function getLocalCategorySummaryForBrand(brand: string): LocalCategorySummary {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return createEmptyLocalCategorySummary();
  }

  const summary = createMutableLocalCategorySummary();

  getLocalCategoryStorageKeysForBrand(brand).forEach((key) => {
    const rawValue = localStorage.getItem(key);

    if (!rawValue) {
      return;
    }

    try {
      mergeSerializedLocalCategorySummary(JSON.parse(rawValue), summary);
    } catch {
      return;
    }
  });

  return {
    visibleCustomCount: summary.visibleCustomIds.size,
    visibleEditedCount: summary.visibleEditedIds.size,
    hiddenCategoryIds: Array.from(summary.hiddenCategoryIds),
    hasCustomOrder: summary.hasCustomOrder,
  };
}

function isCategoryHidden(category: Category, hiddenCategoryIds: Set<string>) {
  if (hiddenCategoryIds.has(category.id)) {
    return true;
  }

  const candidate = category as Category & {
    visible?: unknown;
    isVisible?: unknown;
    hidden?: unknown;
    isHidden?: unknown;
    visibility?: unknown;
  };
  const visibleFlag = normalizeLocalCategoryBoolean(candidate.visible ?? candidate.isVisible);
  const hiddenFlag = normalizeLocalCategoryBoolean(candidate.hidden ?? candidate.isHidden);
  const visibilityState =
    typeof candidate.visibility === 'string' ? candidate.visibility.trim().toLowerCase() : '';

  return (
    hiddenFlag === true ||
    visibleFlag === false ||
    visibilityState === 'hidden' ||
    visibilityState === 'deleted' ||
    visibilityState === 'removed' ||
    visibilityState === 'collapsed' ||
    visibilityState === 'off'
  );
}

function getLocalCategoryBadgeLabel(summary: {
  visibleCustomCount: number;
  visibleEditedCount: number;
  hiddenCount: number;
  hasCustomOrder: boolean;
}) {
  if (summary.hiddenCount > 0 && summary.hasCustomOrder) {
    return `Orden local + ${summary.hiddenCount} oculta${summary.hiddenCount === 1 ? '' : 's'}`;
  }

  if (summary.hiddenCount > 0) {
    return `${summary.hiddenCount} oculta${summary.hiddenCount === 1 ? '' : 's'}`;
  }

  if (summary.hasCustomOrder) {
    return 'Orden local';
  }

  if (summary.visibleCustomCount > 0) {
    return `${summary.visibleCustomCount} local${summary.visibleCustomCount === 1 ? '' : 'es'}`;
  }

  if (summary.visibleEditedCount > 0) {
    return `${summary.visibleEditedCount} ajustada${summary.visibleEditedCount === 1 ? '' : 's'}`;
  }

  return 'Locales activas';
}

function getLocalCategoryBadgeTitle(
  siteName: string,
  summary: {
    visibleCustomCount: number;
    visibleEditedCount: number;
    hiddenCount: number;
    hasCustomOrder: boolean;
  },
) {
  const details: string[] = [];

  if (summary.visibleCustomCount > 0) {
    details.push(
      `${summary.visibleCustomCount} categoria${summary.visibleCustomCount === 1 ? '' : 's'} local${summary.visibleCustomCount === 1 ? '' : 'es'} visible${summary.visibleCustomCount === 1 ? '' : 's'}`,
    );
  }

  if (summary.visibleEditedCount > 0) {
    details.push(
      `${summary.visibleEditedCount} ajustada${summary.visibleEditedCount === 1 ? '' : 's'}`,
    );
  }

  if (summary.hiddenCount > 0) {
    details.push(`${summary.hiddenCount} oculta${summary.hiddenCount === 1 ? '' : 's'}`);
  }

  if (summary.hasCustomOrder) {
    details.push('orden local aplicado');
  }

  if (details.length === 0) {
    return `La marca activa tiene categorias locales aplicadas en ${siteName}.`;
  }

  return `Categorias locales aplicadas en ${siteName}: ${details.join(', ')}.`;
}

export function Navbar({
  categories,
  activeCategory,
  onCategorySelect,
  onSearchChange,
  cartItemCount,
  onCartClick,
  products,
}: NavbarProps) {
  const { user, loginWithGoogle, logout, mockProfiles, switchMockProfile } = useAuth();
  const { brand, isNikken } = useBrand();
  const settings = useStorefrontSettings(brand);
  const [, setLocation] = useLocation();
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(true);
  const [hasLogoError, setHasLogoError] = useState(false);
  const [localCategorySummary, setLocalCategorySummary] = useState<LocalCategorySummary>(
    createEmptyLocalCategorySummary,
  );
  const homePath = isNikken ? '/nikken' : '/';
  const favoritesPath = isNikken ? '/nikken/account/favorites' : '/account/favorites';
  const mobileSearchInputId = `${brand}-navbar-mobile-search`;
  const isAdmin = user?.role === 'admin';
  const userId = user?.id ?? null;
  const profileName = user?.name || user?.email || 'Mi cuenta';
  const profileInitial = profileName.trim().charAt(0).toUpperCase() || '?';
  const profileRoleLabel = isAdmin ? 'Admin' : 'Cliente';
  const logoImageUrl = settings.logoImageUrl.trim();
  const shouldShowLogo = Boolean(logoImageUrl) && !hasLogoError;
  const brandInitial = settings.siteName.trim().charAt(0).toUpperCase() || brand.charAt(0).toUpperCase();

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

  useEffect(() => {
    setHasLogoError(false);
  }, [logoImageUrl, brand]);

  useEffect(() => {
    const syncLocalCategorySummary = () => {
      try {
        setLocalCategorySummary(getLocalCategorySummaryForBrand(brand));
      } catch {
        setLocalCategorySummary(createEmptyLocalCategorySummary());
      }
    };

    const handleLocalCategoriesChanged = (event: Event) => {
      const detail = (
        event as CustomEvent<{ brand?: string; storageKey?: string }>
      ).detail;

      if (
        !detail?.brand ||
        detail.brand === brand ||
        isLocalCategoryStorageKeyForBrand(detail.storageKey, brand)
      ) {
        syncLocalCategorySummary();
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (!event.key || isLocalCategoryStorageKeyForBrand(event.key, brand)) {
        syncLocalCategorySummary();
      }
    };

    syncLocalCategorySummary();
    LOCAL_CATEGORY_EVENT_NAMES.forEach((eventName) => {
      window.addEventListener(eventName, handleLocalCategoriesChanged as EventListener);
    });
    window.addEventListener('storage', handleStorageChange);

    return () => {
      LOCAL_CATEGORY_EVENT_NAMES.forEach((eventName) => {
        window.removeEventListener(eventName, handleLocalCategoriesChanged as EventListener);
      });
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [brand]);

  const hiddenLocalCategoryIds = new Set(localCategorySummary.hiddenCategoryIds);
  const visibleCategories = categories.filter(
    (category) => !isCategoryHidden(category, hiddenLocalCategoryIds),
  );
  const hiddenCategoriesInView = Math.max(categories.length - visibleCategories.length, 0);
  const localCategoriesInView = visibleCategories.filter((category) =>
    isLikelyLocalCategoryId(category.id),
  ).length;
  const effectiveLocalCategorySummary = {
    visibleCustomCount: Math.max(localCategorySummary.visibleCustomCount, localCategoriesInView),
    visibleEditedCount: localCategorySummary.visibleEditedCount,
    hiddenCount: Math.max(localCategorySummary.hiddenCategoryIds.length, hiddenCategoriesInView),
    hasCustomOrder: localCategorySummary.hasCustomOrder,
  };
  const hasLocalCategoriesApplied =
    effectiveLocalCategorySummary.visibleCustomCount > 0 ||
    effectiveLocalCategorySummary.visibleEditedCount > 0 ||
    effectiveLocalCategorySummary.hiddenCount > 0 ||
    effectiveLocalCategorySummary.hasCustomOrder;
  const localCategoryBadgeLabel = getLocalCategoryBadgeLabel(effectiveLocalCategorySummary);
  const localCategoryBadgeTitle = getLocalCategoryBadgeTitle(
    settings.siteName,
    effectiveLocalCategorySummary,
  );

  const handleLogout = () => {
    logout();
    onCategorySelect('');
    onSearchChange('');
    setLocation(homePath);
  };

  const handleMobileSearchToggle = () => {
    setIsMobileSearchOpen((current) => {
      const next = !current;

      if (next) {
        window.setTimeout(() => {
          const input = document.getElementById(mobileSearchInputId);

          if (input instanceof HTMLInputElement) {
            input.focus();
          }
        }, 0);
      }

      return next;
    });
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-primary/10 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div
          className="flex items-center flex-shrink-0 cursor-pointer min-w-0"
          onClick={() => {
            setLocation(homePath);
            onCategorySelect('');
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/10 via-white to-secondary/15 shadow-sm">
              {shouldShowLogo ? (
                <img
                  src={logoImageUrl}
                  alt={`Logo de ${settings.siteName}`}
                  className="h-full w-full object-cover"
                  onError={() => setHasLogoError(true)}
                />
              ) : (
                <span className="text-sm sm:text-base font-bold text-primary" aria-hidden="true">
                  {brandInitial}
                </span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="display text-lg sm:text-2xl md:text-3xl font-bold text-primary tracking-tight truncate">
                {settings.siteName}
              </h1>
              <span className="hidden sm:block text-secondary text-[10px] uppercase tracking-[0.15em] font-bold mt-1 truncate">
                {settings.slogan}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-md hidden md:flex relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder={
              isNikken
                ? 'Buscar agua, descanso, nutricion...'
                : 'Buscar perfumes, cremas, maquillaje...'
            }
            onChange={(event) => onSearchChange(event.target.value)}
            className="w-full pl-9 rounded-full bg-secondary/10 border-transparent focus-visible:ring-primary/20 focus-visible:bg-white transition-all text-sm body"
          />
        </div>

        {isNikken && (
          <nav className="hidden lg:flex items-center gap-6 ml-8 mr-auto">
            {isAdmin && (
              <button
                onClick={() => setLocation('/nikken/admin')}
                className="text-sm font-bold text-slate-500 hover:text-primary transition-colors uppercase tracking-wider"
              >
                Admin
              </button>
            )}
            <button
              onClick={() => setLocation('/nikken/account/orders')}
              className="text-sm font-bold text-slate-500 hover:text-primary transition-colors uppercase tracking-wider"
            >
              Mis pedidos
            </button>
          </nav>
        )}

        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          {products.length > 0 && <LazyCatalogPdfGenerator products={products} />}
          <button
            onClick={handleMobileSearchToggle}
            className="md:hidden p-2 text-foreground/80 hover:text-primary rounded-full hover:bg-primary/10 transition-colors"
            title={isMobileSearchOpen ? 'Ocultar busqueda' : 'Mostrar busqueda'}
            aria-label={isMobileSearchOpen ? 'Ocultar busqueda' : 'Mostrar busqueda'}
            aria-expanded={isMobileSearchOpen}
            aria-controls={mobileSearchInputId}
          >
            <Search className="w-5 h-5" />
          </button>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full border border-primary/10 bg-white/80 py-1 pl-1 pr-2 text-foreground/80 hover:text-primary hover:bg-primary/10 transition-colors relative max-w-[11rem]"
                  title="Mi cuenta"
                >
                  <div className="w-7 h-7 rounded-full overflow-hidden border border-primary/30 shrink-0">
                    {user.avatar ? (
                      <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-secondary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {profileInitial}
                      </div>
                    )}
                  </div>
                  <div className="hidden sm:flex min-w-0 flex-col items-start text-left">
                    <span className="max-w-full truncate text-xs font-bold text-slate-800">
                      {profileName}
                    </span>
                    <span className="max-w-full truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {profileRoleLabel}
                    </span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 rounded-2xl p-2 shadow-2xl border-primary/5"
              >
                <DropdownMenuLabel className="px-3 py-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Mi cuenta
                  </p>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-secondary/10">
                      {user.avatar ? (
                        <img src={user.avatar} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-primary">{profileInitial}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{profileName}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                      {profileRoleLabel}
                    </span>
                    {mockProfiles.length > 1 ? (
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {mockProfiles.length} perfiles
                      </span>
                    ) : null}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-primary/5" />
                {mockProfiles.length > 1 && (
                  <>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="rounded-xl gap-3 px-3 py-2 focus:bg-primary/5">
                        <Repeat className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-slate-700">Cambiar perfil</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-60 rounded-2xl p-2">
                        <DropdownMenuLabel className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Perfiles mock
                        </DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={user.id}>
                          {mockProfiles.map((profile) => {
                            const isActiveProfile = profile.id === user.id;
                            const displayName = profile.name || profile.email;

                            return (
                              <DropdownMenuRadioItem
                                key={profile.id}
                                value={profile.id}
                                onSelect={() => switchMockProfile(profile.id)}
                                className="rounded-xl gap-3 px-3 py-2 cursor-pointer focus:bg-primary/5"
                              >
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-secondary/10">
                                    {profile.avatar ? (
                                      <img
                                        src={profile.avatar}
                                        alt={displayName}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <span className="text-xs font-bold text-primary">
                                        {displayName.trim().charAt(0).toUpperCase() || '?'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-slate-800">
                                      {displayName}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {profile.email}
                                    </p>
                                  </div>
                                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                                    {profile.role === 'admin' ? 'Admin' : 'Cliente'}
                                  </span>
                                  {isActiveProfile ? (
                                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                                      Activo
                                    </span>
                                  ) : null}
                                </div>
                              </DropdownMenuRadioItem>
                            );
                          })}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator className="bg-primary/5" />
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => setLocation(isNikken ? '/nikken/profile' : '/profile')}
                  className="rounded-xl mt-1 gap-3 px-3 py-2 cursor-pointer focus:bg-primary/5"
                >
                  <UserIcon className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-slate-700">Mi perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLocation(isNikken ? '/nikken/account/orders' : '/account/orders')}
                  className="rounded-xl gap-3 px-3 py-2 cursor-pointer focus:bg-primary/5"
                >
                  <Package className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-slate-700">Mis pedidos</span>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator className="bg-primary/5" />
                    <DropdownMenuItem
                      onClick={() => setLocation(isNikken ? '/nikken/admin' : '/admin')}
                      className="rounded-xl gap-3 px-3 py-2 cursor-pointer focus:bg-primary/5"
                    >
                      <LayoutDashboard className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-slate-700">Admin panel</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setLocation(isNikken ? '/nikken/admin/settings' : '/admin/settings')}
                      className="rounded-xl gap-3 px-3 py-2 cursor-pointer focus:bg-primary/5"
                    >
                      <Settings className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-slate-700">Configuracion</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="bg-primary/5" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="rounded-xl gap-3 px-3 py-2 text-rose-600 focus:bg-rose-50 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="font-bold">Cerrar sesion</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="p-2 text-foreground/80 hover:text-primary rounded-full hover:bg-primary/10 transition-colors relative"
              title="Iniciar sesion"
            >
              <UserIcon className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={() => setLocation(favoritesPath)}
            className="p-2 text-foreground/80 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors relative"
            title="Mis favoritos"
          >
            <Heart className="w-5 h-5" />
            {favoriteCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center border border-white shadow-sm">
                {favoriteCount > 99 ? '99+' : favoriteCount}
              </span>
            )}
          </button>
          <button
            onClick={onCartClick}
            className="p-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-transform hover:scale-105 shadow-md flex items-center justify-center relative"
            title="Mi pedido"
          >
            <ShoppingBag className="w-5 h-5" />
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white shadow-sm">
                {cartItemCount > 9 ? '9+' : cartItemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <nav className="border-t border-primary/5 bg-white/50">
        <div className="container mx-auto px-4 overflow-x-auto custom-scrollbar flex items-center py-2 md:py-3 gap-2 md:gap-6">
          <button
            onClick={() => onCategorySelect('')}
            className={`whitespace-nowrap heading text-sm md:text-base font-bold transition-colors py-1 px-3 md:px-0 rounded-full md:rounded-none md:border-b-2 ${
              activeCategory === ''
                ? 'bg-primary text-white md:bg-transparent md:text-primary md:border-primary'
                : 'text-foreground/70 hover:text-primary md:border-transparent md:hover:border-primary/50'
            }`}
          >
            Todos
          </button>
          {hasLocalCategoriesApplied ? (
            <span
              className="shrink-0 inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700"
              title={localCategoryBadgeTitle}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
              <span>{localCategoryBadgeLabel}</span>
            </span>
          ) : null}
          {visibleCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => onCategorySelect(category.id)}
              title={category.name}
              className={`inline-flex max-w-[11rem] shrink-0 items-center gap-2 whitespace-nowrap heading text-sm md:max-w-[14rem] md:text-base font-bold transition-colors py-1 px-3 md:px-0 rounded-full md:rounded-none md:border-b-2 ${
                activeCategory === category.id
                  ? 'bg-primary text-white md:bg-transparent md:text-primary md:border-primary'
                  : 'text-foreground/70 hover:text-primary md:border-transparent md:hover:border-primary/50'
              }`}
            >
              <span className="block truncate">{category.name}</span>
              {isLikelyLocalCategoryId(category.id) ? (
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    activeCategory === category.id
                      ? 'bg-white/90 md:bg-primary'
                      : 'bg-amber-500/80'
                  }`}
                  aria-hidden="true"
                />
              ) : null}
            </button>
          ))}
        </div>
      </nav>

      <div
        className={`container mx-auto px-4 md:hidden overflow-hidden transition-all duration-200 ${
          isMobileSearchOpen ? 'max-h-24 pb-3 opacity-100' : 'max-h-0 pb-0 opacity-0 pointer-events-none'
        }`}
      >
        <Input
          id={mobileSearchInputId}
          placeholder={
            isNikken
              ? 'Buscar agua, descanso, nutricion...'
              : 'Buscar perfumes, cremas, maquillaje...'
          }
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full rounded-2xl bg-secondary/10 border-transparent focus-visible:ring-primary/20 text-sm body"
        />
      </div>
    </header>
  );
}
