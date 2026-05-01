import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/app/admin/AdminLayout';
import StatCard from '@/components/app/admin/StatCard';
import {
  Users,
  ShoppingBag,
  TrendingUp,
  AlertCircle,
  Package,
  CheckCircle2,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/shared/ui/card";
import { useBrand } from '@/contexts/BrandContext';
import {
  getOrderStatusClasses,
  getOrderStatusLabel,
  isOrdersStorageKeyForBrand,
  listAllOrdersByBrand,
  listOrderStorageKeysForBrand,
  type StoredOrderRecord,
} from '@/lib/orderStorage';
import {
  getLocalCatalogChangesCount,
  isCustomCatalogProductId,
  isLocalCatalogStorageKeyForBrand,
  readLocalCatalogOverrides,
} from '@/lib/adminCatalogStorage';

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const headerDateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const detailedDateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

type DashboardActivity = {
  icon: LucideIcon;
  color: string;
  bg: string;
  title: string;
  time: string;
};

type LocalCatalogStatus = {
  changesCount: number;
  customProductsCount: number;
  editedProductsCount: number;
  deletedProductsCount: number;
};

type LocalCategoryStatus = {
  touchedCategoriesCount: number;
  localCategoriesCount: number;
  deletedCategoriesCount: number;
  uncategorizedProductsCount: number;
};

type StoredLocalCategory = {
  id: string;
  name: string;
};

type StoredLocalCategoryOverrides = {
  categories: StoredLocalCategory[];
  deletedCategoryIds: string[];
};

const LOCAL_CATEGORY_STORAGE_PREFIXES = ['catalog_local_categories', 'catalog_local_category'] as const;

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0);
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatHeaderDate(date: Date) {
  return capitalize(headerDateFormatter.format(date));
}

function parseStoredDate(rawDate: string) {
  const parsedDate = new Date(rawDate);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatRelativeTime(rawDate: string) {
  const parsedDate = parseStoredDate(rawDate);

  if (!parsedDate) {
    return 'Sin fecha';
  }

  const diffMs = Date.now() - parsedDate.getTime();

  if (diffMs < 0) {
    return detailedDateFormatter.format(parsedDate);
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) {
    return 'Hace unos segundos';
  }

  if (diffMinutes < 60) {
    return `Hace ${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `Hace ${diffHours} h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return 'Ayer';
  }

  if (diffDays < 7) {
    return `Hace ${diffDays} dias`;
  }

  return detailedDateFormatter.format(parsedDate);
}

function brandLabel(brand: string) {
  return brand === 'nikken' ? 'Nikken' : 'Natura';
}

function isBetweenDates(date: Date | null, start: Date, end: Date) {
  return Boolean(date && date >= start && date < end);
}

function normalizeStorageText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function safeParseStorageJson<T>(rawValue: string | null, fallbackValue: T): T {
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

function normalizeLocalCategoryRecord(value: unknown): StoredLocalCategory | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<StoredLocalCategory>;
  const id = normalizeStorageText(candidate.id);
  const name = normalizeStorageText(candidate.name);

  if (!id || !name) {
    return null;
  }

  return { id, name };
}

function normalizeLocalCategoryOverrides(value: unknown): StoredLocalCategoryOverrides {
  const candidate =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
  const rawCategories = Array.isArray(candidate?.categories)
    ? candidate.categories
    : Array.isArray(value)
      ? value
      : [];
  const rawDeletedCategoryIds = Array.isArray(candidate?.deletedCategoryIds)
    ? candidate.deletedCategoryIds
    : Array.isArray(candidate?.deletedIds)
      ? candidate.deletedIds
      : [];

  return {
    categories: rawCategories
      .map((category) => normalizeLocalCategoryRecord(category))
      .filter((category): category is StoredLocalCategory => category !== null),
    deletedCategoryIds: Array.from(
      new Set(
        rawDeletedCategoryIds
          .map((categoryId) => normalizeStorageText(categoryId))
          .filter((categoryId) => categoryId.length > 0),
      ),
    ),
  };
}

function getLocalCategoryStorageKeys(brand: 'natura' | 'nikken') {
  return LOCAL_CATEGORY_STORAGE_PREFIXES.map((prefix) => `${prefix}_${brand}`);
}

function isLocalCategoryStorageKeyForBrand(key: string | null | undefined, brand: 'natura' | 'nikken') {
  return key ? getLocalCategoryStorageKeys(brand).includes(key) : false;
}

function readLocalCategoryOverrides(brand: 'natura' | 'nikken') {
  if (!canUseBrowserStorage()) {
    return normalizeLocalCategoryOverrides({});
  }

  for (const storageKey of getLocalCategoryStorageKeys(brand)) {
    const parsedValue = safeParseStorageJson<unknown>(localStorage.getItem(storageKey), null);

    if (parsedValue) {
      return normalizeLocalCategoryOverrides(parsedValue);
    }
  }

  return normalizeLocalCategoryOverrides({});
}

function getUniqueCustomerCount(orders: StoredOrderRecord[]) {
  const uniqueCustomers = new Set(
    orders.map(order => {
      const phoneKey = order.customerPhone.trim();
      const nameKey = order.customerName.trim().toLowerCase();
      return phoneKey || nameKey || order.id;
    }),
  );

  return uniqueCustomers.size;
}

function getTrend(currentValue: number, previousValue: number) {
  if (previousValue <= 0) {
    return undefined;
  }

  const delta = ((currentValue - previousValue) / previousValue) * 100;
  return {
    value: Number(Math.abs(delta).toFixed(1)),
    isPositive: delta >= 0,
  };
}

function getOrderProductSummary(order: StoredOrderRecord) {
  const firstItem = order.items[0];

  if (!firstItem) {
    return 'Sin productos';
  }

  return order.items.length > 1
    ? `${firstItem.name} +${order.items.length - 1} mas`
    : firstItem.name;
}

function getActivityDetails(order: StoredOrderRecord): Omit<DashboardActivity, 'time'> {
  const orderId = `#${order.id}`;
  const customerLabel = order.customerName.trim() || 'Cliente';

  switch (order.status) {
    case 'delivered':
      return {
        icon: CheckCircle2,
        color: 'text-emerald-500',
        bg: 'bg-emerald-50',
        title: `${orderId} entregado a ${customerLabel}`,
      };
    case 'shipped':
      return {
        icon: Package,
        color: 'text-blue-500',
        bg: 'bg-blue-50',
        title: `${orderId} enviado a ${customerLabel}`,
      };
    case 'paid':
      return {
        icon: CheckCircle2,
        color: 'text-violet-500',
        bg: 'bg-violet-50',
        title: `Pago confirmado para ${orderId}`,
      };
    case 'processing':
      return {
        icon: Clock,
        color: 'text-amber-500',
        bg: 'bg-amber-50',
        title: `${orderId} en preparacion`,
      };
    case 'pending':
    default:
      return {
        icon: ShoppingBag,
        color: 'text-sky-500',
        bg: 'bg-sky-50',
        title: `Nuevo pedido ${orderId}`,
      };
  }
}

export default function AdminDashboard() {
  const { brand } = useBrand();
  const [orders, setOrders] = useState<StoredOrderRecord[]>([]);
  const [orderScopeCount, setOrderScopeCount] = useState(0);
  const [localCatalogStatus, setLocalCatalogStatus] = useState<LocalCatalogStatus>({
    changesCount: 0,
    customProductsCount: 0,
    editedProductsCount: 0,
    deletedProductsCount: 0,
  });
  const [localCategoryStatus, setLocalCategoryStatus] = useState<LocalCategoryStatus>({
    touchedCategoriesCount: 0,
    localCategoriesCount: 0,
    deletedCategoriesCount: 0,
    uncategorizedProductsCount: 0,
  });

  useEffect(() => {
    const syncOrders = () => {
      const nextOrders = listAllOrdersByBrand(brand).sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      );
      const nextScopeCount = listOrderStorageKeysForBrand(brand).filter(storageKey =>
        Boolean(localStorage.getItem(storageKey)) && isOrdersStorageKeyForBrand(storageKey, brand),
      ).length;

      setOrders(nextOrders);
      setOrderScopeCount(nextScopeCount);
    };

    const handleOrdersChanged = (event: Event) => {
      const { detail } = event as CustomEvent<{ brand?: string; storageKey?: string }>;

      if (
        !detail?.brand ||
        detail.brand === brand ||
        isOrdersStorageKeyForBrand(detail.storageKey, brand)
      ) {
        syncOrders();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || isOrdersStorageKeyForBrand(event.key, brand)) {
        syncOrders();
      }
    };

    syncOrders();
    window.addEventListener('catalog-orders-changed', handleOrdersChanged as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('catalog-orders-changed', handleOrdersChanged as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, [brand]);

  useEffect(() => {
    const syncLocalCatalogStatus = () => {
      const overrides = readLocalCatalogOverrides(brand);
      const customProductsCount = overrides.products.filter(product =>
        isCustomCatalogProductId(product.id),
      ).length;
      const editedProductsCount = overrides.products.length - customProductsCount;

      setLocalCatalogStatus({
        changesCount: getLocalCatalogChangesCount(brand),
        customProductsCount,
        editedProductsCount,
        deletedProductsCount: overrides.deletedProductIds.length,
      });
    };

    const handleLocalCatalogChanged = (event: Event) => {
      const { detail } = event as CustomEvent<{ brand?: string; storageKey?: string }>;

      if (
        !detail?.brand ||
        detail.brand === brand ||
        isLocalCatalogStorageKeyForBrand(detail.storageKey, brand)
      ) {
        syncLocalCatalogStatus();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || isLocalCatalogStorageKeyForBrand(event.key, brand)) {
        syncLocalCatalogStatus();
      }
    };

    syncLocalCatalogStatus();
    window.addEventListener(
      'catalog-local-products-changed',
      handleLocalCatalogChanged as EventListener,
    );
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(
        'catalog-local-products-changed',
        handleLocalCatalogChanged as EventListener,
      );
      window.removeEventListener('storage', handleStorage);
    };
  }, [brand]);

  useEffect(() => {
    const syncLocalCategoryStatus = () => {
      const categoryOverrides = readLocalCategoryOverrides(brand);
      const productOverrides = readLocalCatalogOverrides(brand);
      const activeLocalProducts = productOverrides.products.filter(
        (product) => !productOverrides.deletedProductIds.includes(product.id),
      );
      const touchedCategoryIds = new Set<string>();

      activeLocalProducts.forEach((product) => {
        const categoryId = normalizeStorageText(product.categoryId) || 'uncategorized';
        touchedCategoryIds.add(categoryId);
      });

      categoryOverrides.categories.forEach((category) => {
        touchedCategoryIds.add(category.id);
      });

      categoryOverrides.deletedCategoryIds.forEach((categoryId) => {
        touchedCategoryIds.add(categoryId);
      });

      const uncategorizedProductsCount = activeLocalProducts.filter((product) => {
        const categoryId = normalizeStorageText(product.categoryId);
        return !categoryId || categoryId === 'uncategorized';
      }).length;

      setLocalCategoryStatus({
        touchedCategoriesCount: touchedCategoryIds.size,
        localCategoriesCount: categoryOverrides.categories.length,
        deletedCategoriesCount: categoryOverrides.deletedCategoryIds.length,
        uncategorizedProductsCount,
      });
    };

    const handleLocalCatalogChanged = (event: Event) => {
      const { detail } = event as CustomEvent<{ brand?: string; storageKey?: string }>;

      if (
        !detail?.brand ||
        detail.brand === brand ||
        isLocalCatalogStorageKeyForBrand(detail.storageKey, brand) ||
        isLocalCategoryStorageKeyForBrand(detail.storageKey, brand)
      ) {
        syncLocalCategoryStatus();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        !event.key ||
        isLocalCatalogStorageKeyForBrand(event.key, brand) ||
        isLocalCategoryStorageKeyForBrand(event.key, brand)
      ) {
        syncLocalCategoryStatus();
      }
    };

    syncLocalCategoryStatus();
    window.addEventListener(
      'catalog-local-products-changed',
      handleLocalCatalogChanged as EventListener,
    );
    window.addEventListener(
      'catalog-local-categories-changed',
      handleLocalCatalogChanged as EventListener,
    );
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(
        'catalog-local-products-changed',
        handleLocalCatalogChanged as EventListener,
      );
      window.removeEventListener(
        'catalog-local-categories-changed',
        handleLocalCatalogChanged as EventListener,
      );
      window.removeEventListener('storage', handleStorage);
    };
  }, [brand]);

  const currentDateLabel = formatHeaderDate(new Date());
  const hasLocalCatalogChanges = localCatalogStatus.changesCount > 0;
  const hasLocalCategoryChanges =
    localCategoryStatus.touchedCategoriesCount > 0 ||
    localCategoryStatus.localCategoriesCount > 0 ||
    localCategoryStatus.deletedCategoriesCount > 0;

  const {
    monthlyRevenue,
    monthlyOrders,
    monthlyCustomers,
    pendingOrders,
    recentOrders,
    activityItems,
    revenueTrend,
    ordersTrend,
    customersTrend,
  } = useMemo(() => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const currentMonthOrders = orders.filter(order =>
      isBetweenDates(parseStoredDate(order.createdAt), currentMonthStart, nextMonthStart),
    );
    const previousMonthOrders = orders.filter(order =>
      isBetweenDates(parseStoredDate(order.createdAt), previousMonthStart, currentMonthStart),
    );

    const monthlyRevenueValue = currentMonthOrders.reduce((total, order) => total + order.total, 0);
    const previousMonthlyRevenue = previousMonthOrders.reduce((total, order) => total + order.total, 0);
    const monthlyCustomersCount = getUniqueCustomerCount(currentMonthOrders);
    const previousMonthlyCustomers = getUniqueCustomerCount(previousMonthOrders);

    return {
      monthlyRevenue: monthlyRevenueValue,
      monthlyOrders: currentMonthOrders.length,
      monthlyCustomers: monthlyCustomersCount,
      pendingOrders: orders.filter(order => order.status !== 'delivered').length,
      recentOrders: orders.slice(0, 5),
      activityItems: orders.slice(0, 4).map(order => ({
        ...getActivityDetails(order),
        time: formatRelativeTime(order.updatedAt || order.createdAt),
      })),
      revenueTrend: getTrend(monthlyRevenueValue, previousMonthlyRevenue),
      ordersTrend: getTrend(currentMonthOrders.length, previousMonthOrders.length),
      customersTrend: getTrend(monthlyCustomersCount, previousMonthlyCustomers),
    };
  }, [orders]);

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Panel de Control</h1>
            <p className="text-slate-500 mt-1">
              Aqui tienes un resumen actualizado de los pedidos locales de {brandLabel(brand)}
              {orderScopeCount > 0 ? ` en ${orderScopeCount} ${orderScopeCount === 1 ? 'scope' : 'scopes'}` : ''}.
            </p>
          </div>
          <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 shadow-sm">
            {currentDateLabel}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Ventas del mes"
            value={formatCurrency(monthlyRevenue)}
            icon={TrendingUp}
            trend={revenueTrend}
            color="emerald-500"
          />
          <StatCard
            label="Pedidos del mes"
            value={monthlyOrders}
            icon={ShoppingBag}
            trend={ordersTrend}
            color="primary"
          />
          <StatCard
            label="Clientes del mes"
            value={monthlyCustomers}
            icon={Users}
            trend={customersTrend}
            color="indigo-500"
          />
          <StatCard
            label="Por entregar"
            value={pendingOrders}
            icon={AlertCircle}
            color="rose-500"
          />
        </div>

        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg font-bold">Catalogo local de {brandLabel(brand)}</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                {hasLocalCatalogChanges
                  ? `${localCatalogStatus.changesCount} cambios locales activos listos para reflejarse en el catalogo.`
                  : 'Sin customizaciones locales activas en este momento.'}
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                hasLocalCatalogChanges
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {hasLocalCatalogChanges ? 'Con cambios locales' : 'Catalogo limpio'}
            </span>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-medium text-slate-500">Cambios activos</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{localCatalogStatus.changesCount}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Suma de altas, ediciones y eliminaciones locales.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-sm font-medium text-slate-500">Productos locales</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {localCatalogStatus.customProductsCount}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {localCatalogStatus.editedProductsCount} editados sobre el catalogo base.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-sm font-medium text-slate-500">Ocultos localmente</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {localCatalogStatus.deletedProductsCount}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Productos removidos solo en este dispositivo o sesion.
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Categorias locales de {brandLabel(brand)}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {hasLocalCategoryChanges
                      ? `${localCategoryStatus.touchedCategoriesCount} categorias reflejan cambios locales en esta marca.`
                      : 'Sin senales de categorias locales en este momento.'}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    hasLocalCategoryChanges
                      ? 'bg-sky-50 text-sky-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {hasLocalCategoryChanges ? 'Categorias con cambios' : 'Categorias estables'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <p className="text-sm font-medium text-slate-500">Categorias tocadas</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {localCategoryStatus.touchedCategoriesCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Detectadas desde productos o ajustes locales de la marca.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <p className="text-sm font-medium text-slate-500">Categorias locales</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {localCategoryStatus.localCategoriesCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Categorias guardadas localmente en este dispositivo.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <p className="text-sm font-medium text-slate-500">Ocultas localmente</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {localCategoryStatus.deletedCategoriesCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Categorias marcadas para ocultarse solo en esta marca.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-medium text-slate-500">Productos sin categoria</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {localCategoryStatus.uncategorizedProductsCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Productos locales que aun requieren clasificacion.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-bold">Pedidos Recientes</CardTitle>
              <span className="text-sm font-semibold text-slate-400">
                {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
              </span>
            </CardHeader>
            <CardContent>
              <div className="relative w-full overflow-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-400 uppercase bg-slate-50 font-bold">
                    <tr>
                      <th className="px-4 py-3 rounded-l-lg">Pedido</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3">Monto</th>
                      <th className="px-4 py-3 rounded-r-lg">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentOrders.length > 0 ? (
                      recentOrders.map(order => (
                        <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-4">
                            <p className="font-bold text-slate-700">#{order.id}</p>
                            <p className="text-xs text-slate-400 mt-1">{formatRelativeTime(order.createdAt)}</p>
                          </td>
                          <td className="px-4 py-4">
                            {order.customerName.trim() || 'Cliente sin nombre'}
                          </td>
                          <td className="px-4 py-4 text-slate-500">{getOrderProductSummary(order)}</td>
                          <td className="px-4 py-4 font-bold text-slate-900">{formatCurrency(order.total)}</td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getOrderStatusClasses(order.status)}`}>
                              {getOrderStatusLabel(order.status)}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center">
                          <div className="mx-auto max-w-md">
                            <p className="text-sm font-semibold text-slate-700">
                              Aun no hay pedidos guardados para {brandLabel(brand)}.
                            </p>
                            <p className="text-sm text-slate-400 mt-1">
                              Cuando se registren compras locales, este panel mostrara clientes, montos y estados reales.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Actividad del Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {activityItems.length > 0 ? (
                  activityItems.map((activity, index) => (
                    <div key={`${activity.title}-${index}`} className="flex gap-4">
                      <div className={`w-10 h-10 rounded-xl ${activity.bg} ${activity.color} flex items-center justify-center shrink-0`}>
                        <activity.icon size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 leading-tight">{activity.title}</p>
                        <p className="text-xs text-slate-400 mt-1">{activity.time}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6">
                    <p className="text-sm font-semibold text-slate-700">Sin actividad reciente</p>
                    <p className="text-sm text-slate-400 mt-1">
                      Los movimientos de pedidos de {brandLabel(brand)} apareceran aqui en cuanto haya registros locales.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
