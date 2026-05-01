import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Navbar } from '@/components/app/layout/Navbar';
import { Footer } from '@/components/app/layout/Footer';
import { useBrand } from '@/contexts/BrandContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Camera,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent } from '@/components/shared/ui/card';
import { Input } from '@/components/shared/ui/input';
import { Textarea } from '@/components/shared/ui/textarea';
import {
  isOrdersStorageKeyForBrand,
  listOrdersByBrand,
  type StoredOrderRecord,
} from '@/lib/orderStorage';

const AUTH_STORAGE_KEYS = new Set(['odoo_session', 'odoo_mock_user']);

export default function ReturnsPortal() {
  const { brand } = useBrand();
  const { user } = useAuth();
  const isNikken = brand === 'nikken';
  const [storedOrders, setStoredOrders] = useState<StoredOrderRecord[]>([]);

  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [reason, setReason] = useState('Defecto de fabrica');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const loadOrders = () => {
      setStoredOrders(listOrdersByBrand(brand, user?.id));
    };

    const handleOrdersChanged = (event: Event) => {
      const detailBrand = (event as CustomEvent<{ brand?: string }>).detail?.brand;

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

  useEffect(() => {
    if (!storedOrders.length) {
      return;
    }

    const hasMatchingOrder = storedOrders.some(order => order.id === orderId);

    if (!orderId || !hasMatchingOrder) {
      setOrderId(storedOrders[0].id);
    }
  }, [storedOrders, orderId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
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

        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-none shadow-2xl rounded-[2.5rem] p-12 text-center overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-8 shadow-inner">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Solicitud enviada</h2>
            <p className="text-slate-500 mb-4 leading-relaxed">
              Registramos tu solicitud para el pedido <span className="font-semibold text-slate-700">{orderId || 'sin referencia'}</span>.
            </p>
            <p className="text-slate-500 mb-8 leading-relaxed">
              Un asesor se pondra en contacto contigo en las proximas 24-48 horas habiles para revisar el motivo: <span className="font-medium text-slate-700">{reason}</span>.
            </p>
            <Link href={`/${isNikken ? 'nikken' : ''}`}>
              <Button size="lg" className="w-full rounded-2xl font-bold py-6">
                Volver al inicio
              </Button>
            </Link>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

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
        <Link href={`/${isNikken ? 'nikken/' : ''}account/orders`}>
          <a className="inline-flex items-center gap-2 text-slate-400 hover:text-primary transition-colors mb-8 font-medium group">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Volver a mis pedidos
          </a>
        </Link>

        <div className="mb-10 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold uppercase tracking-widest mb-4">
            Atencion al cliente
          </div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Devoluciones y cambios</h1>
          <p className="text-slate-500 mt-3 text-lg">
            Inicia tu proceso de retorno de manera sencilla y profesional.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
              <CardContent className="p-8 space-y-6">
                {storedOrders.length > 0 && (
                  <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm text-slate-600">
                    Puedes usar uno de tus pedidos recientes o escribir la referencia manualmente.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Numero de pedido</label>
                    <Input
                      value={orderId}
                      onChange={(event) => setOrderId(event.target.value)}
                      placeholder={storedOrders[0]?.id ? `Ej: ${storedOrders[0].id}` : 'Ej: NIK-49201'}
                      className="rounded-xl border-slate-200"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Motivo</label>
                    <select
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option>Defecto de fabrica</option>
                      <option>Producto incorrecto</option>
                      <option>No cumple expectativas</option>
                      <option>Dano en transporte</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Descripcion del problema</label>
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe brevemente la razon de tu solicitud y cualquier detalle util para el asesor."
                    className="rounded-xl border-slate-200 min-h-[120px]"
                    required
                  />
                </div>

                {storedOrders.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Pedidos recientes</label>
                    <div className="grid gap-2">
                      {storedOrders.slice(0, 3).map((order) => (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => setOrderId(order.id)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-semibold text-slate-800">#{order.id}</p>
                              <p className="text-xs text-slate-500">
                                {order.items.length} producto{order.items.length === 1 ? '' : 's'} • ${order.total.toFixed(2)}
                              </p>
                            </div>
                            <span className="text-xs font-semibold text-primary">Usar</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-6 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-primary/50 transition-colors cursor-pointer group">
                  <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-all">
                    <Camera size={24} />
                  </div>
                  <p className="text-sm font-medium text-slate-500">Haz clic para subir fotos (opcional)</p>
                  <p className="text-[10px] text-slate-400">Ayudanos a procesar mas rapido tu solicitud</p>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-4 p-6 rounded-3xl bg-amber-50 border border-amber-100 text-amber-800 text-sm">
              <AlertCircle size={20} className="shrink-0" />
              <p>Recuerda que tienes hasta 30 dias despues de tu compra para solicitar una devolucion o cambio.</p>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="border-none shadow-lg rounded-3xl overflow-hidden bg-white">
              <CardContent className="p-8">
                <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <FileText size={20} className="text-primary" />
                  Resumen
                </h3>
                <div className="space-y-4 mb-8">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Referencia</span>
                    <span className="text-slate-900 font-bold">{orderId || 'Pendiente'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Motivo</span>
                    <span className="text-slate-900 font-bold">{reason}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Politica</span>
                    <span className="text-emerald-600 font-bold">{isNikken ? 'Soporte Nikken' : 'Soporte Natura'}</span>
                  </div>
                </div>
                <Button type="submit" className="w-full rounded-2xl font-bold py-6 shadow-xl shadow-primary/20 flex items-center gap-2">
                  <RotateCcw size={18} />
                  Enviar solicitud
                </Button>
              </CardContent>
            </Card>

            <div className="p-6 rounded-3xl border border-slate-200 bg-white flex items-center gap-4 group cursor-pointer hover:border-primary transition-colors">
              <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-all">
                <MessageSquare size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">¿Dudas?</p>
                <p className="text-xs text-slate-500">Habla con un asesor</p>
              </div>
            </div>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
}
