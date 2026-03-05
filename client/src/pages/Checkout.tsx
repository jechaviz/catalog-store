import { useState } from 'react';
import { useCart } from '@/hooks/useCart';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, CreditCard, ArrowLeft, Banknote, Building2 } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

const SELLER_PHONE = "5215573456073"; // Update with actual seller number
const CLABE_ACCOUNT = "012345678901234567 (Bancomer)"; // Change to actual CLABE

type PaymentMethod = 'whatsapp_cash' | 'transfer' | 'connectia' | 'paypal';

export default function Checkout() {
    const { items, subtotal, clearCart } = useCart();
    const [, setLocation] = useLocation();
    const { theme } = useTheme();

    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('whatsapp_cash');

    // If cart is empty, redirect back
    if (items.length === 0) {
        setLocation('/');
        return null;
    }

    const shippingCost = subtotal > 1500 ? 0 : 99; // Free shipping over $1500
    const total = subtotal + shippingCost;

    const generateOrderDetails = () => {
        let orderText = `*NUEVO PEDIDO DIGITAL*\n\n`;
        orderText += `*Cliente:* ${customerName}\n`;
        orderText += `*Teléfono:* ${customerPhone}\n`;
        orderText += `*Dirección:* ${customerAddress}\n\n`;
        orderText += `*Artículos:*\n`;
        items.forEach(item => {
            orderText += `- ${item.quantity}x ${item.product.name} ($${(item.product.price * item.quantity).toFixed(2)})\n`;
        });
        orderText += `\n*Subtotal:* $${subtotal.toFixed(2)}\n`;
        orderText += `*Envío:* $${shippingCost.toFixed(2)}\n`;
        orderText += `*TOTAL:* $${total.toFixed(2)}\n\n`;
        return orderText;
    };

    const handleCheckout = () => {
        if (!customerName || !customerPhone || !customerAddress) {
            alert('Por favor, completa todos tus datos de envío.');
            return;
        }

        const baseOrder = generateOrderDetails();
        let finalMessage = '';

        if (paymentMethod === 'whatsapp_cash') {
            finalMessage = `${baseOrder}*Método de Pago:* Pago contra entrega (Efectivo/Terminal). \n\nPor favor confirmar recepción del pedido.`;
            window.open(`https://wa.me/${SELLER_PHONE}?text=${encodeURIComponent(finalMessage)}`, '_blank');
            clearCart();
            setLocation('/');
        }
        else if (paymentMethod === 'transfer') {
            alert(`Por favor, transfiere la cantidad de $${total.toFixed(2)} a la CLABE:\n${CLABE_ACCOUNT}\n\nPresiona OK para abrir WhatsApp y enviar tu comprobante.`);
            finalMessage = `${baseOrder}*Método de Pago:* Transferencia Bancaria. \n\nAdjunto mi comprobante de pago para proceder con el envío.`;
            window.open(`https://wa.me/${SELLER_PHONE}?text=${encodeURIComponent(finalMessage)}`, '_blank');
            clearCart();
            setLocation('/');
        }
        else if (paymentMethod === 'connectia') {
            // Find if any product has a specific payment link (mocking connectia redirect)
            const directLink = items.find(i => i.product.paymentLink)?.product.paymentLink || "https://connectia.mx/tu-tienda";
            window.open(directLink, '_blank');
            clearCart();
            setLocation('/');
        }
        else if (paymentMethod === 'paypal') {
            // Simple PayPal.Me generic redirect
            window.open(`https://paypal.me/tuusuario/${total}`, '_blank');
            clearCart();
            setLocation('/');
        }
    };

    return (
        <div className={`min-h-screen bg-background selection:bg-primary/20 transition-colors duration-500 pb-20`}>
            {/* Checkout Header */}
            <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-primary/10 shadow-sm">
                <div className="container mx-auto px-4 h-16 flex items-center gap-4">
                    <button
                        onClick={() => setLocation('/')}
                        className="p-2 hover:bg-secondary/10 rounded-full text-foreground/80 hover:text-primary transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="heading text-xl md:text-2xl font-bold text-foreground">
                        Finalizar Compra
                    </h1>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">

                    {/* Left Column: Form & Payment */}
                    <div className="lg:col-span-7 space-y-8">

                        {/* 1. Datos de Envío */}
                        <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-primary/10">
                            <h2 className="heading text-2xl font-bold mb-6 text-foreground flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">1</span>
                                Datos de Envío
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-2 mb-1 block">Nombre Completo</label>
                                    <Input
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        placeholder="Ej. María Pérez"
                                        className="rounded-xl border-border/60 bg-secondary/5 focus-visible:ring-primary/30 h-12"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-2 mb-1 block">Teléfono (WhatsApp)</label>
                                    <Input
                                        value={customerPhone}
                                        onChange={(e) => setCustomerPhone(e.target.value)}
                                        placeholder="10 dígitos"
                                        type="tel"
                                        className="rounded-xl border-border/60 bg-secondary/5 focus-visible:ring-primary/30 h-12"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-2 mb-1 block">Dirección de Entrega</label>
                                    <Textarea
                                        value={customerAddress}
                                        onChange={(e) => setCustomerAddress(e.target.value)}
                                        placeholder="Calle, Número, Colonia, Código Postal, Referencias..."
                                        className="rounded-xl border-border/60 bg-secondary/5 focus-visible:ring-primary/30 min-h-[100px] resize-none"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* 2. Método de Pago */}
                        <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-primary/10">
                            <h2 className="heading text-2xl font-bold mb-6 text-foreground flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">2</span>
                                Método de Pago
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                                {/* Efectivo / Contra Entrega */}
                                <div
                                    onClick={() => setPaymentMethod('whatsapp_cash')}
                                    className={`cursor-pointer rounded-2xl p-4 border-2 transition-all flex flex-col items-center justify-center gap-3 text-center ${paymentMethod === 'whatsapp_cash' ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/30 bg-white'}`}
                                >
                                    <Banknote className={`w-8 h-8 ${paymentMethod === 'whatsapp_cash' ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <div>
                                        <p className="font-bold heading text-sm">Pago a la Entrega</p>
                                        <p className="text-xs text-muted-foreground mt-1">Acuerda entrega física (Efectivo/Terminal)</p>
                                    </div>
                                </div>

                                {/* Transferencia */}
                                <div
                                    onClick={() => setPaymentMethod('transfer')}
                                    className={`cursor-pointer rounded-2xl p-4 border-2 transition-all flex flex-col items-center justify-center gap-3 text-center ${paymentMethod === 'transfer' ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/30 bg-white'}`}
                                >
                                    <Building2 className={`w-8 h-8 ${paymentMethod === 'transfer' ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <div>
                                        <p className="font-bold heading text-sm">Transferencia</p>
                                        <p className="text-xs text-muted-foreground mt-1">Envía comprobante vía WhatsApp</p>
                                    </div>
                                </div>

                                {/* Connectia */}
                                <div
                                    onClick={() => setPaymentMethod('connectia')}
                                    className={`cursor-pointer rounded-2xl p-4 border-2 transition-all flex flex-col items-center justify-center gap-3 text-center ${paymentMethod === 'connectia' ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/30 bg-white'}`}
                                >
                                    <CreditCard className={`w-8 h-8 ${paymentMethod === 'connectia' ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <div>
                                        <p className="font-bold heading text-sm">Connectia (TDC / TDD)</p>
                                        <p className="text-xs text-muted-foreground mt-1">Pago seguro en línea</p>
                                    </div>
                                </div>

                                {/* PayPal */}
                                <div
                                    onClick={() => setPaymentMethod('paypal')}
                                    className={`cursor-pointer rounded-2xl p-4 border-2 transition-all flex flex-col items-center justify-center gap-3 text-center ${paymentMethod === 'paypal' ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/30 bg-white'}`}
                                >
                                    <svg viewBox="0 0 24 24" className={`w-8 h-8 ${paymentMethod === 'paypal' ? 'fill-primary' : 'fill-muted-foreground'}`}>
                                        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106a.64.64 0 0 1-.632.54h.632z" />
                                    </svg>
                                    <div>
                                        <p className="font-bold heading text-sm">PayPal</p>
                                        <p className="text-xs text-muted-foreground mt-1">Paga con tu cuenta PayPal</p>
                                    </div>
                                </div>

                            </div>
                        </section>
                    </div>

                    {/* Right Column: Order Summary */}
                    <div className="lg:col-span-5">
                        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-primary/10 sticky top-24">
                            <h3 className="heading text-xl font-bold mb-6 text-foreground">Resumen de tu pedido</h3>

                            <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                {items.map(item => (
                                    <div key={item.product.id} className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-xl bg-secondary/10 p-1 flex-shrink-0">
                                            <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-contain mix-blend-multiply" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="heading text-sm font-bold truncate">{item.product.name}</p>
                                            <p className="body text-xs text-muted-foreground">Cant: {item.quantity}</p>
                                        </div>
                                        <div className="font-bold heading text-primary shrink-0">
                                            ${(item.product.price * item.quantity).toFixed(2)}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-3 pt-4 border-t border-border/50 mb-6">
                                <div className="flex justify-between text-muted-foreground text-sm">
                                    <span>Subtotal</span>
                                    <span>${subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground text-sm">
                                    <span>Envío</span>
                                    <span>{shippingCost === 0 ? '¡Gratis!' : `$${shippingCost.toFixed(2)}`}</span>
                                </div>
                                <div className="flex justify-between items-center text-foreground font-black text-xl heading pt-2 border-t border-border/50">
                                    <span>Total</span>
                                    <span className="text-primary">${total.toFixed(2)}</span>
                                </div>
                            </div>

                            <Button
                                onClick={handleCheckout}
                                className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white shadow-xl hover:shadow-primary/30 transition-all font-bold heading text-lg"
                            >
                                Confirmar Pedido
                            </Button>
                            <p className="text-center text-xs text-muted-foreground mt-4">
                                Al confirmar, estás aceptando que el inventario está sujeto a disponibilidad por parte del consultor.
                            </p>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
