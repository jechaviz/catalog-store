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
  getOrdersStorageKey,
  listOrdersByBrand,
  type StoredOrderRecord,
} from '@/lib/orderStorage';

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

  useEffect(() => {
    const syncOrders = () => {
      const nextOrders = listOrdersByBrand(brand).sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      );
      setOrders(nextOrders);
    };

    const handleOrdersChanged = (event: Event) => {
      const { detail } = event as CustomEvent<{ brand?: string }>;

      if (!detail?.brand || detail.brand === brand) {
        syncOrders();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === getOrdersStorageKey(brand)) {
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

  const currentDateLabel = formatHeaderDate(new Date());

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
              Aqui tienes un resumen actualizado de los pedidos locales de {brandLabel(brand)}.
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
