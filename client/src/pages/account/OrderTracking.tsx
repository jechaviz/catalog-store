import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/app/layout/Navbar';
import { Footer } from '@/components/app/layout/Footer';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent } from '@/components/shared/ui/card';
import { useBrand } from '@/contexts/BrandContext';
import { AUTH_STORAGE_KEYS, useAuth } from '@/contexts/AuthContext';
import {
  getCarrierLabel,
  getEstimatedDeliveryLabel,
  getOrderById,
  getOrderStatusClasses,
  getOrderStatusLabel,
  getTrackingTimeline,
  isOrdersStorageKeyForBrand,
  type StoredOrderRecord,
} from '@/lib/orderStorage';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Truck,
} from 'lucide-react';
import { Link, useParams } from 'wouter';

function formatOrderDate(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(parsedDate);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(value);
}

export default function OrderTracking() {
  const { brand } = useBrand();
  const { user, mockProfiles } = useAuth();
  const { id } = useParams();
  const isNikkenRoute =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/nikken');
  const activeBrand = isNikkenRoute ? 'nikken' : brand;
  const isNikken = activeBrand === 'nikken';
  const [order, setOrder] = useState<StoredOrderRecord | null>(null);
  const activeProfileLabel = user?.name?.trim() || user?.email || 'este perfil';
  const shouldShowProfileContext = mockProfiles.length > 1 && Boolean(user);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const loadOrder = () => {
      setOrder(getOrderById(activeBrand, id, user?.id));
    };

    const handleOrdersChanged = (event: Event) => {
      const detailBrand = (event as CustomEvent<{ brand?: string }>).detail?.brand;

      if (!detailBrand || detailBrand === activeBrand) {
        loadOrder();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (!event.key) {
        loadOrder();
        return;
      }

      if (AUTH_STORAGE_KEYS.has(event.key) || isOrdersStorageKeyForBrand(event.key, activeBrand)) {
        loadOrder();
      }
    };

    loadOrder();
    window.addEventListener('catalog-orders-changed', handleOrdersChanged as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('catalog-orders-changed', handleOrdersChanged as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, [activeBrand, id, user?.id]);

  const timeline = order ? getTrackingTimeline(order) : [];
  const historyHref = `/${isNikken ? 'nikken/' : ''}account/orders`;
  const itemCount = order
    ? order.items.reduce((total, item) => total + item.quantity, 0)
    : 0;
  const fallbackOrderId = id || 'sin-folio';

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

      <main className="flex-1 container max-w-4xl py-12 px-4">
        <Link href={historyHref}>
          <a className="inline-flex items-center gap-2 text-slate-400 hover:text-primary transition-colors mb-8 font-medium group">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Volver a mis pedidos
          </a>
        </Link>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Rastreo de Pedido</h1>
            <p className="text-slate-500 mt-2">
              {order
                ? `Seguimiento en tiempo real de tu envio #${order.id}${shouldShowProfileContext ? ` para ${activeProfileLabel}` : ''}.`
                : `No encontramos el pedido #${fallbackOrderId} en ${isNikken ? 'Nikken' : 'Natura'}${shouldShowProfileContext ? ` para ${activeProfileLabel}` : ''}.`}
            </p>
          </div>
          <div
            className={`px-6 py-3 rounded-2xl flex items-center gap-3 shadow-sm ${
              order ? getOrderStatusClasses(order.status) : 'bg-slate-100 text-slate-500'
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-current opacity-70"></div>
            <span className="text-sm font-bold">
              {order ? getOrderStatusLabel(order.status) : 'Pedido no disponible'}
            </span>
          </div>
        </div>

        {!order ? (
          <Card className="border border-dashed border-slate-200 shadow-sm bg-white">
            <CardContent className="p-10 text-center">
              <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center">
                <Package size={28} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Pedido no encontrado</h2>
              <p className="text-slate-500 mt-3 max-w-xl mx-auto leading-relaxed">
                El folio <span className="font-semibold text-slate-700">#{fallbackOrderId}</span>{' '}
                no esta guardado en el historial de la marca actual
                {shouldShowProfileContext ? ` para ${activeProfileLabel}` : ''}. Revisa que estes
                navegando en la tienda correcta o vuelve a tus pedidos para elegir otro folio.
              </p>
              <Link href={historyHref}>
                <Button className="mt-8 rounded-xl px-6">Ir a mis pedidos</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 border-none shadow-sm h-fit overflow-hidden">
              <CardContent className="p-8">
                <div className="relative space-y-0">
                  {timeline.map((step, idx) => (
                    <div key={`${step.title}-${idx}`} className="relative flex gap-6 pb-10 last:pb-0">
                      {idx !== timeline.length - 1 && (
                        <div
                          className={`absolute left-[15px] top-[30px] w-0.5 h-full ${
                            step.status === 'completed'
                              ? 'bg-primary'
                              : step.status === 'active'
                                ? 'bg-primary/30'
                                : 'bg-slate-100'
                          }`}
                        ></div>
                      )}

                      <div className="relative z-10 shrink-0">
                        {step.status === 'completed' ? (
                          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30">
                            <CheckCircle2 size={18} />
                          </div>
                        ) : step.status === 'active' ? (
                          <div className="w-8 h-8 rounded-full bg-white border-4 border-primary text-primary flex items-center justify-center shadow-md">
                            <Clock size={16} />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white border-2 border-slate-100 text-slate-300 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                          </div>
                        )}
                      </div>

                      <div className="pt-0.5">
                        <p
                          className={`font-bold transition-colors ${
                            step.status === 'pending' ? 'text-slate-300' : 'text-slate-800'
                          }`}
                        >
                          {step.title}
                        </p>
                        <p
                          className={`text-xs mt-1 ${
                            step.status === 'pending' ? 'text-slate-200' : 'text-slate-400'
                          }`}
                        >
                          {step.date}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-none shadow-sm overflow-hidden bg-primary text-white">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Truck size={24} />
                    <h3 className="font-bold">Info del Envio</h3>
                  </div>
                  <div className="space-y-4 text-primary-foreground/90 text-sm">
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-wider opacity-60">
                        Paqueteria
                      </p>
                      <p className="font-medium">{getCarrierLabel(order)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-wider opacity-60">
                        Guia de rastreo
                      </p>
                      <p className="font-medium break-words">
                        {order.trackingNumber || 'Pendiente de asignacion'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-wider opacity-60">
                        Entrega estimada
                      </p>
                      <p className="font-medium">{getEstimatedDeliveryLabel(order)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm overflow-hidden bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4 text-slate-800">
                    <MapPin size={24} className="text-rose-500" />
                    <h3 className="font-bold">Direccion de Entrega</h3>
                  </div>
                  <div className="space-y-2 text-sm text-slate-600 leading-relaxed">
                    <p className="font-semibold text-slate-800">{order.customerName}</p>
                    <p>{order.customerPhone}</p>
                    <p className="whitespace-pre-line break-words">{order.customerAddress}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm overflow-hidden bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4 text-slate-800">
                    <Package size={24} className="text-primary" />
                    <h3 className="font-bold">Resumen del Pedido</h3>
                  </div>
                  <div className="space-y-4 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Pedido</span>
                      <span className="font-semibold text-slate-800">#{order.id}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Fecha</span>
                      <span className="font-semibold text-slate-800 text-right">
                        {formatOrderDate(order.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Articulos</span>
                      <span className="font-semibold text-slate-800">{itemCount}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Total</span>
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(order.total)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
