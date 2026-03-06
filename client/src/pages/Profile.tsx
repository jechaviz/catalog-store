import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { Button } from '@/components/shared/ui/button';
import { ArrowLeft, Clock, Package, LogOut, Zap } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

export default function Profile() {
    const { user, isLoading, logout } = useAuth();
    const [, setLocation] = useLocation();
    const { addItem, setIsDrawerOpen } = useCart();
    const [orders, setOrders] = useState<any[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    // Flash deal dummy data for UI demonstration
    const [timeLeft, setTimeLeft] = useState<{ hours: number, minutes: number, seconds: number }>({
        hours: 5, minutes: 23, seconds: 59
    });

    useEffect(() => {
        // Countdown timer for Flash Deals
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                let { hours, minutes, seconds } = prev;
                if (seconds > 0) seconds--;
                else {
                    seconds = 59;
                    if (minutes > 0) minutes--;
                    else {
                        minutes = 59;
                        if (hours > 0) hours--;
                    }
                }
                return { hours, minutes, seconds };
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!isLoading && !user) {
            setLocation('/');
        }
    }, [user, isLoading, setLocation]);

    useEffect(() => {
        // TODO: Load orders from Odoo
        setLoadingOrders(false);
    }, [user]);

    if (isLoading || !user) {
        return <div className="min-h-screen flex items-center justify-center">Cargando perfil...</div>;
    }

    const handleLogout = () => {
        logout();
        setLocation('/');
    };

    const handleReorder = (order: any) => {
        // TODO: Implement reorder logic with Odoo
        alert("Funcionalidad de Re-ordenar (Pendiente integración con Odoo)");
    };

    return (
        <div className="min-h-screen bg-background selection:bg-primary/20 transition-colors duration-500 pb-20">
            <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-primary/10 shadow-sm">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setLocation('/')}
                            className="p-2 hover:bg-secondary/10 rounded-full text-foreground/80 hover:text-primary transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="heading text-xl md:text-2xl font-bold text-foreground">
                            Mi Perfil
                        </h1>
                    </div>
                    <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleLogout}>
                        <LogOut className="w-5 h-5 mr-2" /> Cerrar Sesión
                    </Button>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">

                {/* User Info Card */}
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
                    <div className="text-center sm:text-left">
                        <h2 className="display text-3xl font-black text-foreground">{user.name || 'Cliente Natura'}</h2>
                        <p className="body text-muted-foreground">{user.email}</p>
                        {user.role === 'admin' && (
                            <Button onClick={() => setLocation('/admin')} variant="outline" className="mt-4 border-primary text-primary hover:bg-primary hover:text-white rounded-full">
                                Ir al Panel de Administración
                            </Button>
                        )}
                    </div>
                </div>

                {/* Flash Deals Section (UI Demo) */}
                <section className="mb-12">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="heading text-2xl font-bold flex items-center gap-2">
                            <Zap className="w-6 h-6 text-yellow-500 fill-yellow-500 animate-pulse" />
                            Ofertas Flash Exclusivas
                        </h3>
                        <div className="flex gap-2">
                            <span className="bg-red-500 text-white font-mono font-bold px-2 py-1 rounded w-8 text-center">{String(timeLeft.hours).padStart(2, '0')}</span> :
                            <span className="bg-red-500 text-white font-mono font-bold px-2 py-1 rounded w-8 text-center">{String(timeLeft.minutes).padStart(2, '0')}</span> :
                            <span className="bg-red-500 text-white font-mono font-bold px-2 py-1 rounded w-8 text-center">{String(timeLeft.seconds).padStart(2, '0')}</span>
                        </div>
                    </div>
                    <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-200 rounded-3xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
                        <div className="flex-1">
                            <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Flash Deal</span>
                            <h4 className="heading text-xl font-bold">Kit Essencial Supremo - 30% OFF</h4>
                            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">Aprovecha este descuento solo por las próximas {timeLeft.hours} horas. Incluye perfume y crema corporal.</p>
                        </div>
                        <div className="flex flex-col items-center sm:items-end w-full sm:w-auto shrink-0">
                            <span className="text-sm text-muted-foreground line-through">$1,250.00</span>
                            <span className="display text-3xl font-black text-red-600 mb-3">$875.00</span>
                            <Button className="w-full sm:w-auto rounded-full bg-red-600 hover:bg-red-700 shadow-xl" onClick={() => { setLocation('/'); alert("Oferta limitada en fase demo. Volviendo al inicio."); }}>
                                Ver Oferta Exclusiva
                            </Button>
                        </div>
                    </div>
                </section>

                {/* Order History */}
                <section>
                    <h3 className="heading text-2xl font-bold mb-6 flex items-center gap-2">
                        <Package className="w-6 h-6 text-primary" />
                        Historial de Pedidos
                    </h3>

                    {loadingOrders ? (
                        <div className="py-12 text-center text-muted-foreground animate-pulse">Cargando tus pedidos...</div>
                    ) : orders.length === 0 ? (
                        <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-primary/10">
                            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Clock className="w-10 h-10 text-primary opacity-50" />
                            </div>
                            <h4 className="heading text-xl font-bold mb-2">Aún no tienes pedidos</h4>
                            <p className="body text-muted-foreground mb-6">Tu historial de compras aparecerá aquí cuando realices tu primer pedido.</p>
                            <Button onClick={() => setLocation('/')} className="rounded-full px-8 py-6">Explorar Catálogo</Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {orders.map(order => (
                                <div key={order.id} className="bg-white rounded-2xl p-6 shadow-sm border border-primary/10 flex flex-col sm:flex-row justify-between gap-4 group hover:border-primary/30 transition-colors">
                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold text-muted-foreground">Pedido #{order.id}</p>
                                        <p className="heading text-lg font-bold">${order.total?.toFixed(2) || '0.00'}</p>
                                        <p className="text-xs text-muted-foreground">{new Date(order.created).toLocaleDateString()} • {order.payment_method}</p>
                                    </div>
                                    <div className="flex flex-col items-start sm:items-end justify-between">
                                        <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-widest ${order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                            order.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                                                'bg-orange-100 text-orange-700'
                                            }`}>
                                            {order.status || 'Procesando'}
                                        </span>
                                        <Button variant="outline" size="sm" className="mt-4 rounded-full group-hover:bg-primary group-hover:text-white transition-colors" onClick={() => handleReorder(order)}>
                                            Volver a pedir
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

            </main>
        </div>
    );
}
