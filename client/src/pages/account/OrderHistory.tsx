import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/app/layout/Navbar';
import { Footer } from '@/components/app/layout/Footer';
import { useBrand } from '@/contexts/BrandContext';
import { AUTH_STORAGE_KEYS, useAuth } from '@/contexts/AuthContext';
import { Package, Search, Calendar, ArrowRight } from 'lucide-react';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent } from '@/components/shared/ui/card';
import { Input } from '@/components/shared/ui/input';
import { Link } from 'wouter';
import {
  isOrdersStorageKeyForBrand,
  getOrderStatusClasses,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  listOrdersByBrand,
  type StoredOrderRecord,
} from '@/lib/orderStorage';

const orderDateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

function formatOrderDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return orderDateFormatter.format(date);
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0);
}

function getItemsCountLabel(items: StoredOrderRecord['items']) {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  return `${totalItems} ${totalItems === 1 ? 'articulo' : 'articulos'}`;
}

export default function OrderHistory() {
  const { brand, isNikken } = useBrand();
  const { user, mockProfiles } = useAuth();
  const [orders, setOrders] = useState<StoredOrderRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const brandLabel = isNikken ? 'Nikken' : 'Natura';
  const accountBasePath = isNikken ? '/nikken/account' : '/account';
  const homePath = isNikken ? '/nikken' : '/';
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const activeProfileLabel = user?.name?.trim() || user?.email || 'este perfil';
  const shouldShowProfileContext = mockProfiles.length > 1 && Boolean(user);

  useEffect(() => {
    const loadOrders = () => {
      const nextOrders = [...listOrdersByBrand(brand, user?.id)].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt)
      );

      setOrders(nextOrders);
    };

    const handleOrdersChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ brand?: string; scopeId?: string }>).detail;
      const detailBrand = detail?.brand;

      if (!detailBrand || detailBrand === brand) {
        loadOrders();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (!event.key) {
        loadOrders();
        return;
      }

      if (AUTH_STORAGE_KEYS.has(event.key) || isOrdersStorageKeyForBrand(event.key, brand)) {
        loadOrders();
      }
    };

    loadOrders();
    window.addEventListener('catalog-orders-changed', handleOrdersChanged as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('catalog-orders-changed', handleOrdersChanged as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, [brand, user?.id]);

  const filteredOrders = orders.filter(order => order.id.toLowerCase().includes(normalizedSearch));
  const hasOrders = orders.length > 0;
  const hasSearch = normalizedSearch.length > 0;
  const summaryText = hasOrders
    ? hasSearch
      ? `Mostrando ${filteredOrders.length} de ${orders.length} pedidos de ${brandLabel}${shouldShowProfileContext ? ` para ${activeProfileLabel}` : ''}.`
      : `Consulta y rastrea tus pedidos recientes de ${brandLabel}${shouldShowProfileContext ? ` para ${activeProfileLabel}` : ''}.`
    : `Aun no hay pedidos guardados para ${brandLabel}${shouldShowProfileContext ? ` para ${activeProfileLabel}` : ''}.`;

  return (
    <div className={`min-h-screen flex flex-col bg-slate-50 ${isNikken ? 'theme-nikken' : ''}`}>
      <Navbar
        categories={[]}
        activeCategory=""
        onCategorySelect={() => {}}
        onSearchChange={() => {}}
        cartItemCount={0}
        onCartClick={() => {}}
        products={[]}
      />

      <main className="flex-1 container max-w-5xl py-12 px-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Mis Pedidos</h1>
            <p className="text-slate-500 mt-2">{summaryText}</p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por numero de pedido..."
              className="pl-10 rounded-xl bg-white border-slate-200"
            />
          </div>
        </div>

        {!hasOrders ? (
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-10 sm:p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6">
                <Package size={30} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Aun no tienes pedidos de {brandLabel}</h2>
              <p className="text-slate-500 mt-3 max-w-2xl mx-auto leading-relaxed">
                Cuando completes tu primera compra en {brandLabel}, aparecera aqui para que puedas
                revisarla, rastrearla y solicitar ayuda si la necesitas.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href={homePath}>
                  <Button className="rounded-xl px-6">Explorar catalogo</Button>
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
        ) : filteredOrders.length === 0 ? (
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-10 sm:p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-6">
                <Search size={28} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">No encontramos ese pedido</h2>
              <p className="text-slate-500 mt-3 max-w-xl mx-auto leading-relaxed">
                Revisa el numero que escribiste o limpia la busqueda para volver a ver todos tus
                pedidos de {brandLabel}.
              </p>
              <Button
                variant="ghost"
                className="mt-6 rounded-xl px-6 text-slate-600 hover:text-slate-900"
                onClick={() => setSearchTerm('')}
              >
                Limpiar busqueda
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <Package size={24} />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400 font-medium uppercase tracking-wider text-[10px]">
                          Pedido
                        </p>
                        <h3 className="font-bold text-slate-800 text-lg">#{order.id}</h3>
                      </div>
                    </div>

                    <div className="hidden sm:block h-10 w-px bg-slate-100 mx-2"></div>

                    <div className="flex flex-wrap items-center gap-8">
                      <div>
                        <p className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
                          <Calendar size={14} /> Realizado el
                        </p>
                        <p className="text-sm font-bold text-slate-700">
                          {formatOrderDate(order.createdAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium mb-1">Total</p>
                        <p className="text-sm font-bold text-slate-900">{formatCurrency(order.total)}</p>
                      </div>
                      <div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${getOrderStatusClasses(order.status)}`}
                        >
                          {getOrderStatusLabel(order.status)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-white">
                    <div className="space-y-4">
                      {order.items.map((item, index) => (
                        <div
                          key={`${order.id}-${item.productId}-${index}`}
                          className="flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0">
                              {item.quantity}x
                            </div>
                            <span className="text-slate-700 font-medium truncate">{item.name}</span>
                          </div>
                          <span className="text-slate-500 text-sm shrink-0">
                            {formatCurrency(item.lineTotal || item.unitPrice * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-b-2xl border-t border-slate-100 px-6">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                      <span>{getItemsCountLabel(order.items)}</span>
                      <span className="hidden sm:inline text-slate-300">/</span>
                      <span>Pago: {getPaymentMethodLabel(order.paymentMethod)}</span>
                      {order.trackingNumber ? (
                        <>
                          <span className="hidden sm:inline text-slate-300">/</span>
                          <span>Referencia: {order.trackingNumber}</span>
                        </>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-end gap-3">
                      <Link href={`${accountBasePath}/returns`}>
                        <Button
                          variant="ghost"
                          className="text-slate-500 hover:text-slate-700 text-sm font-bold"
                        >
                          Devolucion
                        </Button>
                      </Link>
                      <Link href={`${accountBasePath}/tracking/${order.id}`}>
                        <Button className="rounded-xl flex items-center gap-2 group">
                          Rastrear pedido
                          <ArrowRight
                            size={16}
                            className="group-hover:translate-x-1 transition-transform"
                          />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-16 p-8 rounded-3xl bg-primary/5 border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Necesitas ayuda con tu pedido?</h3>
            <p className="text-slate-600">
              Nuestro equipo esta listo para ayudarte con devoluciones, cambios o seguimiento.
            </p>
          </div>
          <Link href={`${accountBasePath}/returns`}>
            <Button size="lg" className="rounded-2xl px-8 shadow-xl shadow-primary/20">
              Solicitar devolucion
            </Button>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
