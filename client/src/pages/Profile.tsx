import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Clock,
  LogOut,
  Package,
  Receipt,
  RefreshCw,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/shared/ui/button';
import { useCart } from '@/hooks/useCart';
import { useBrand } from '@/contexts/BrandContext';
import {
  getOrderStatusClasses,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  listOrdersByBrand,
  type StoredOrderRecord,
} from '@/lib/orderStorage';

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0);
}

function formatOrderDate(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Fecha no disponible';
  }

  return dateFormatter.format(parsedDate);
}

function getOrderItemCount(order: StoredOrderRecord) {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}

export default function Profile() {
  const { user, isLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { addItem, setIsDrawerOpen } = useCart();
  const { brand, isNikken } = useBrand();
  const [orders, setOrders] = useState<StoredOrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation(isNikken ? '/nikken' : '/');
    }
  }, [user, isLoading, isNikken, setLocation]);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setLoadingOrders(false);
      return;
    }

    const userId = user.id;

    const loadOrders = () => {
      setLoadingOrders(true);

      const nextOrders = listOrdersByBrand(brand, userId)
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

      setOrders(nextOrders);
      setLoadingOrders(false);
    };

    loadOrders();

    const handleOrdersChanged = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : null;

      if (detail?.brand && detail.brand !== brand) {
        return;
      }

      if (detail?.scopeId && detail.scopeId !== userId) {
        return;
      }

      loadOrders();
    };

    window.addEventListener('catalog-orders-changed', handleOrdersChanged);

    return () => {
      window.removeEventListener('catalog-orders-changed', handleOrdersChanged);
    };
  }, [brand, user]);

  if (isLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center">Cargando perfil...</div>;
  }

  const basePath = isNikken ? '/nikken' : '';
  const brandLabel = isNikken ? 'Nikken' : 'Natura';
  const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);
  const totalUnits = orders.reduce((sum, order) => sum + getOrderItemCount(order), 0);
  const activeOrders = orders.filter(
    order => order.status === 'pending' || order.status === 'processing' || order.status === 'paid' || order.status === 'shipped'
  ).length;
  const latestOrder = orders[0] || null;

  const handleLogout = () => {
    logout();
    setLocation(basePath || '/');
  };

  const handleReorder = (order: StoredOrderRecord) => {
    const reorderableItems = order.items.filter(item => item.productSnapshot);

    if (reorderableItems.length === 0) {
      toast.error('No encontramos productos validos para volver a agregar.');
      return;
    }

    const reorderedUnits = reorderableItems.reduce((sum, item) => sum + item.quantity, 0);

    reorderableItems.forEach(item => {
      addItem(item.productSnapshot, item.quantity);
    });

    setIsDrawerOpen(true);
    toast.success('Pedido agregado al carrito', {
      description:
        reorderedUnits === 1
          ? 'Agregamos 1 producto y te llevamos al catalogo.'
          : `Agregamos ${reorderedUnits} productos y te llevamos al catalogo.`,
    });
    setLocation(basePath || '/');
  };

  return (
    <div className="min-h-screen bg-background selection:bg-primary/20 transition-colors duration-500 pb-20">
      <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-primary/10 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation(basePath || '/')}
              className="p-2 hover:bg-secondary/10 rounded-full text-foreground/80 hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="heading text-xl md:text-2xl font-bold text-foreground">Mi Perfil</h1>
          </div>
          <Button
            variant="ghost"
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 mr-2" /> Cerrar sesion
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-primary/10 flex flex-col sm:flex-row items-center gap-6 mb-8">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary/20 shrink-0">
            {user.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-secondary/20 flex items-center justify-center text-primary font-bold text-3xl heading">
                {user.name?.charAt(0) || user.email?.charAt(0) || '?'}
              </div>
            )}
          </div>
          <div className="text-center sm:text-left flex-1">
            <h2 className="display text-3xl font-black text-foreground">
              {user.name || (isNikken ? 'Cliente Nikken' : 'Cliente Natura')}
            </h2>
            <p className="body text-muted-foreground">{user.email}</p>
            <p className="body text-sm text-muted-foreground mt-2">
              Resumen local de pedidos {brandLabel} guardados en este navegador.
            </p>
            {user.role === 'admin' && (
              <Button
                onClick={() => setLocation(`${basePath}/admin`)}
                variant="outline"
                className="mt-4 border-primary text-primary hover:bg-primary hover:text-white rounded-full"
              >
                Ir al Panel de Administracion
              </Button>
            )}
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="bg-white rounded-3xl p-6 border border-primary/10 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <Receipt className="w-6 h-6" />
            </div>
            <p className="text-sm text-muted-foreground">Pedidos registrados</p>
            <p className="display text-3xl font-black text-foreground mt-1">{orders.length}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Historial local actual para {brandLabel}.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-primary/10 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <p className="text-sm text-muted-foreground">Productos comprados</p>
            <p className="display text-3xl font-black text-foreground mt-1">{totalUnits}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Unidades acumuladas en tus pedidos guardados.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-primary/10 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <Truck className="w-6 h-6" />
            </div>
            <p className="text-sm text-muted-foreground">Total y seguimiento</p>
            <p className="display text-3xl font-black text-foreground mt-1">
              {formatCurrency(totalSpent)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {activeOrders > 0
                ? `${activeOrders} pedido${activeOrders === 1 ? '' : 's'} en proceso o entrega.`
                : 'No tienes pedidos pendientes actualmente.'}
            </p>
          </div>
        </section>

        <section>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
              <h3 className="heading text-2xl font-bold flex items-center gap-2">
                <Package className="w-6 h-6 text-primary" />
                Historial de pedidos
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                {latestOrder
                  ? `Ultimo pedido registrado el ${formatOrderDate(latestOrder.createdAt)}.`
                  : `Todavia no hay pedidos locales para ${brandLabel}.`}
              </p>
            </div>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setLocation(basePath || '/')}
            >
              Explorar catalogo
            </Button>
          </div>

          {loadingOrders ? (
            <div className="py-12 text-center text-muted-foreground animate-pulse">
              Cargando tus pedidos...
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-primary/10">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-10 h-10 text-primary opacity-50" />
              </div>
              <h4 className="heading text-xl font-bold mb-2">Aun no tienes pedidos guardados</h4>
              <p className="body text-muted-foreground mb-6">
                Cuando completes una compra, aqui veras tu historial local de {brandLabel}.
              </p>
              <Button
                onClick={() => setLocation(basePath || '/')}
                className="rounded-full px-8 py-6"
              >
                Explorar catalogo
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map(order => {
                const itemCount = getOrderItemCount(order);

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-3xl p-6 shadow-sm border border-primary/10 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                          <p className="text-sm font-semibold text-muted-foreground">
                            Pedido #{order.id}
                          </p>
                          <span
                            className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-widest ${getOrderStatusClasses(order.status)}`}
                          >
                            {getOrderStatusLabel(order.status)}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Total
                            </p>
                            <p className="heading text-lg font-bold text-foreground">
                              {formatCurrency(order.total)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Fecha
                            </p>
                            <p className="text-sm font-medium text-foreground">
                              {formatOrderDate(order.createdAt)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Pago
                            </p>
                            <p className="text-sm font-medium text-foreground">
                              {getPaymentMethodLabel(order.paymentMethod)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4">
                          <span className="inline-flex items-center rounded-full bg-secondary/15 px-3 py-1 text-xs font-medium text-foreground">
                            {itemCount} producto{itemCount === 1 ? '' : 's'}
                          </span>
                          {order.trackingNumber ? (
                            <span className="inline-flex items-center rounded-full bg-secondary/15 px-3 py-1 text-xs font-medium text-foreground">
                              Guia {order.trackingNumber}
                            </span>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          {order.items.slice(0, 3).map(item => (
                            <div
                              key={`${order.id}-${item.productId}`}
                              className="flex items-center justify-between gap-4 rounded-2xl bg-secondary/10 px-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">
                                  {item.quantity}x {item.name}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {formatCurrency(item.unitPrice)} c/u
                                </p>
                              </div>
                              <p className="text-sm font-semibold text-foreground shrink-0">
                                {formatCurrency(item.lineTotal)}
                              </p>
                            </div>
                          ))}
                          {order.items.length > 3 ? (
                            <p className="text-xs text-muted-foreground px-1">
                              +{order.items.length - 3} producto
                              {order.items.length - 3 === 1 ? '' : 's'} mas en este pedido
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:min-w-[220px]">
                        <Button
                          variant="outline"
                          className="rounded-full"
                          onClick={() => setLocation(`${basePath}/account/tracking/${order.id}`)}
                        >
                          Ver seguimiento
                        </Button>
                        <Button
                          className="rounded-full"
                          onClick={() => handleReorder(order)}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Volver a pedir
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
