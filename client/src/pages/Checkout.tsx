import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { CreditCard, ArrowLeft, Banknote, Building2, Loader2 } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';
import { Textarea } from '@/components/shared/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { client as odooClient } from '@/lib/odoo';
import { CREATE_ORDER } from '@/lib/odooQueries';
import { CONFIG } from '@/config';
import { useBrand } from '@/contexts/BrandContext';
import { useStorefrontSettings } from '@/hooks/useStorefrontSettings';
import { getProductFallbackImage } from '@/lib/storefrontStorage';
import {
    createFallbackOrderId,
    mapCartItemsToOrderItems,
    upsertOrder,
} from '@/lib/orderStorage';

type PaymentMethod = 'whatsapp_cash' | 'transfer' | 'connectia' | 'paypal';

type CheckoutPaymentOption = {
    description: string;
    enabled: boolean;
    feedback?: string;
    link?: string;
    instructions?: string;
};

type CheckoutPaymentOptions = Record<PaymentMethod, CheckoutPaymentOption>;

const PLACEHOLDER_PATTERNS = [
    'tu-tienda',
    'tuusuario',
    'example',
    'demo',
    'placeholder',
    '12345678901234567',
    '012345678901234567',
];

function getStringValue(source: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = source[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }

    return '';
}

function getNestedRecord(source: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = source[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return value as Record<string, unknown>;
        }
    }

    return null;
}

function isConfiguredValue(value: string) {
    if (!value.trim()) {
        return false;
    }

    const normalizedValue = value.trim().toLowerCase();
    return !PLACEHOLDER_PATTERNS.some(pattern => normalizedValue.includes(pattern));
}

function getUniqueValues(values: string[]) {
    return Array.from(
        new Set(
            values
                .map(value => value.trim())
                .filter(Boolean)
        )
    );
}

function joinReadableList(values: string[]) {
    if (values.length <= 1) {
        return values[0] || '';
    }

    if (values.length === 2) {
        return `${values[0]} y ${values[1]}`;
    }

    return `${values.slice(0, -1).join(', ')} y ${values[values.length - 1]}`;
}

export default function Checkout() {
    const { items, subtotal, clearCart } = useCart();
    const [, setLocation] = useLocation();
    const { user } = useAuth();
    const { brand, isNikken } = useBrand();
    const storefrontSettings = useStorefrontSettings(brand);
    const hadItemsOnLoad = useRef(items.length > 0);
    const lastSyncedProfileRef = useRef<{ id: string | null; name: string }>({
        id: null,
        name: '',
    });
    const userId = user?.id ?? null;

    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('whatsapp_cash');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        const nextProfileId = user?.id ?? null;
        const nextProfileName = user?.name?.trim() || '';
        const previousProfile = lastSyncedProfileRef.current;
        const currentName = customerName.trim();
        const shouldSyncName =
            previousProfile.id !== nextProfileId ||
            !currentName ||
            currentName === previousProfile.name;

        if (shouldSyncName) {
            setCustomerName(nextProfileName);
        }

        lastSyncedProfileRef.current = {
            id: nextProfileId,
            name: nextProfileName,
        };
    }, [customerName, user?.id, user?.name]);

    useEffect(() => {
        if (!hadItemsOnLoad.current && items.length === 0) {
            setLocation(isNikken ? '/nikken' : '/');
        }
    }, [items.length, isNikken, setLocation]);

    if (items.length === 0) {
        return null;
    }

    const shippingCost = subtotal > CONFIG.SHIPPING.FREE_THRESHOLD ? 0 : CONFIG.SHIPPING.DEFAULT_COST;
    const total = subtotal + shippingCost;
    const sellerPhone = storefrontSettings.sellerPhone || CONFIG.SELLER.PHONE;
    const sellerMessageTemplate =
        storefrontSettings.sellerMessageTemplate?.trim() || 'Hola, me interesa realizar el siguiente pedido:';
    const storefrontSettingsRecord = storefrontSettings as unknown as Record<string, unknown>;
    const paymentSettingsRecord =
        getNestedRecord(storefrontSettingsRecord, ['paymentSettings', 'payments', 'checkoutPayments']) || {};
    const productPaymentLink = items.find(item => item.product.paymentLink)?.product.paymentLink?.trim() || '';
    const transferClabe =
        getStringValue(paymentSettingsRecord, [
            'bankTransferClabe',
            'transferClabe',
            'clabe',
        ]) ||
        getStringValue(storefrontSettingsRecord, [
            'sellerClabe',
            'bankTransferClabe',
            'transferClabe',
            'clabe',
        ]) ||
        CONFIG.SELLER.CLABE;
    const transferInstructions =
        getStringValue(paymentSettingsRecord, [
            'bankTransferInstructions',
            'transferInstructions',
        ]) ||
        getStringValue(storefrontSettingsRecord, [
            'bankTransferInstructions',
            'transferInstructions',
        ]);
    const connectiaLink =
        getStringValue(paymentSettingsRecord, [
            'connectiaLink',
            'connectiaPaymentLink',
            'cardPaymentLink',
            'paymentLink',
        ]) ||
        getStringValue(storefrontSettingsRecord, [
            'connectiaLink',
            'connectiaPaymentLink',
            'cardPaymentLink',
        ]) ||
        productPaymentLink;
    const paypalLink =
        getStringValue(paymentSettingsRecord, [
            'paypalLink',
            'paypalMeLink',
        ]) ||
        getStringValue(storefrontSettingsRecord, [
            'paypalLink',
            'paypalMeLink',
        ]);
    const paymentOptions: CheckoutPaymentOptions = {
        whatsapp_cash: {
            enabled: true,
            description: 'Acuerda entrega fisica (Efectivo/Terminal)',
        },
        transfer: isConfiguredValue(transferClabe)
            ? {
                enabled: true,
                description: 'Envia comprobante por WhatsApp',
                instructions:
                    transferInstructions ||
                    `Transfiere $${total.toFixed(2)} a la CLABE ${transferClabe} y envia tu comprobante por WhatsApp.`,
            }
            : {
                enabled: false,
                description: 'Envia comprobante por WhatsApp',
                feedback: 'No hay CLABE configurada para esta marca.',
            },
        connectia: isConfiguredValue(connectiaLink)
            ? {
                enabled: true,
                description: 'Pago seguro en linea',
                link: connectiaLink,
            }
            : {
                enabled: false,
                description: 'Pago seguro en linea',
                feedback: 'No hay liga de pago en linea configurada.',
            },
        paypal: isConfiguredValue(paypalLink)
            ? {
                enabled: true,
                description: 'Paga con tu cuenta PayPal',
                link: paypalLink,
            }
            : {
                enabled: false,
                description: 'Paga con tu cuenta PayPal',
                feedback: 'PayPal no esta configurado para esta marca.',
            },
    };
    const availablePaymentMethod =
        (Object.keys(paymentOptions) as PaymentMethod[]).find(method => paymentOptions[method].enabled) ||
        'whatsapp_cash';
    const activeProfileLabel = user?.name?.trim() || user?.email?.trim() || null;
    const activeProfileNote = user
        ? `Perfil activo: ${activeProfileLabel}${user.email ? ` <${user.email}>` : ''}${user.id ? ` [${user.id}]` : ''}`
        : undefined;
    const deliveryTimes = getUniqueValues(items.map(item => item.product.deliveryTime || ''));
    const deliveryMethods = getUniqueValues(
        items.flatMap(item => item.product.deliveryMethods || [])
    );
    const backorderUnits = items.reduce(
        (total, item) => total + (item.product.inStock ? 0 : item.quantity),
        0
    );
    const deliverySummaryText =
        deliveryTimes.length === 0
            ? ''
            : deliveryTimes.length === 1
                ? deliveryTimes[0]
                : `Variable segun producto: ${deliveryTimes.join(', ')}`;
    const deliveryMethodsText = joinReadableList(deliveryMethods);
    const orderMetadataNotes = [
        activeProfileNote,
        deliverySummaryText ? `Entrega estimada: ${deliverySummaryText}` : '',
        deliveryMethodsText ? `Metodos de entrega: ${deliveryMethodsText}` : '',
        backorderUnits > 0 ? `Unidades bajo pedido: ${backorderUnits}` : '',
    ].filter(Boolean).join('\n');

    useEffect(() => {
        if (!paymentOptions[paymentMethod].enabled) {
            setPaymentMethod(availablePaymentMethod);
        }
    }, [availablePaymentMethod, paymentMethod, paymentOptions]);

    const generateOrderDetails = () => {
        let orderText = `${sellerMessageTemplate}\n\n`;
        orderText += '*NUEVO PEDIDO DIGITAL*\n\n';
        orderText += `*Cliente:* ${customerName}\n`;
        orderText += `*Telefono:* ${customerPhone}\n`;
        orderText += `*Direccion:* ${customerAddress}\n\n`;
        orderText += '*Articulos:*\n';
        items.forEach(item => {
            orderText += `- ${item.quantity}x ${item.product.name} ($${(item.product.price * item.quantity).toFixed(2)})\n`;
            const itemDeliveryDetails = [
                item.product.deliveryTime?.trim() || '',
                ...(item.product.deliveryMethods || []).map(method => method.trim()).filter(Boolean),
                item.product.inStock ? '' : 'Bajo pedido',
            ].filter(Boolean);

            if (itemDeliveryDetails.length > 0) {
                orderText += `  Entrega: ${itemDeliveryDetails.join(' | ')}\n`;
            }
        });
        orderText += `\n*Subtotal:* $${subtotal.toFixed(2)}\n`;
        orderText += `*Envio:* $${shippingCost.toFixed(2)}\n`;
        orderText += `*TOTAL:* $${total.toFixed(2)}\n\n`;
        if (deliverySummaryText) {
            orderText += `*Entrega estimada del pedido:* ${deliverySummaryText}\n`;
        }
        if (deliveryMethodsText) {
            orderText += `*Metodos de entrega disponibles:* ${deliveryMethodsText}\n`;
        }
        if (backorderUnits > 0) {
            orderText += `*Nota:* ${backorderUnits} unidad(es) quedan sujetas a confirmacion de disponibilidad.\n`;
        }
        orderText += '\n';
        return orderText;
    };

    const openWhatsApp = (message: string) => {
        window.open(
            `${CONFIG.SELLER.WHATSAPP_BASE_URL}${sellerPhone}?text=${encodeURIComponent(message)}`,
            '_blank'
        );
    };

    const handleCheckout = async () => {
        if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
            toast.error('Completa tu nombre, telefono y direccion de entrega.');
            return;
        }

        const selectedPaymentOption = paymentOptions[paymentMethod];

        if (!selectedPaymentOption.enabled) {
            toast.error(selectedPaymentOption.feedback || 'Este metodo de pago no esta disponible.');
            return;
        }

        setIsProcessing(true);

        try {
            const itemsInput = items.map(item => ({
                product_id: Number.parseInt(item.product.id, 10),
                quantity: item.quantity,
                price_unit: item.product.price,
            }));

            const response = await odooClient.mutate({
                mutation: CREATE_ORDER,
                variables: {
                    customerName,
                    customerPhone,
                    customerAddress,
                    items: itemsInput,
                },
            });

            const odooOrder = (response.data as any)?.createOrder?.order;
            const orderId = String(odooOrder?.id || odooOrder?.name || createFallbackOrderId(brand));
            const orderName = odooOrder?.name || orderId;

            const baseOrder = generateOrderDetails();
            let finalMessage = '';

            if (paymentMethod === 'whatsapp_cash') {
                finalMessage = `${baseOrder}*Metodo de Pago:* Pago contra entrega (Efectivo/Terminal).\n\nOrden Odoo: ${orderName}\nPor favor confirmar recepcion del pedido.`;
                openWhatsApp(finalMessage);
            } else if (paymentMethod === 'transfer') {
                toast('Transferencia bancaria', {
                    description: selectedPaymentOption.instructions,
                });
                finalMessage = `${baseOrder}*Metodo de Pago:* Transferencia bancaria.\n\nOrden Odoo: ${orderName}\nAdjunto mi comprobante de pago para proceder con el envio.`;
                openWhatsApp(finalMessage);
            } else if (paymentMethod === 'connectia') {
                window.open(selectedPaymentOption.link, '_blank');
            } else if (paymentMethod === 'paypal') {
                window.open(selectedPaymentOption.link, '_blank');
            }

            upsertOrder({
                id: orderId,
                brand,
                status: paymentMethod === 'transfer' || paymentMethod === 'connectia' || paymentMethod === 'paypal' ? 'paid' : 'processing',
                paymentMethod,
                subtotal,
                shippingCost,
                total,
                customerName,
                customerPhone,
                customerAddress,
                items: mapCartItemsToOrderItems(items),
                carrier: paymentMethod === 'whatsapp_cash' ? 'Confirmacion por WhatsApp' : 'Mensajeria por asignar',
                trackingNumber: odooOrder?.name ? String(odooOrder.name) : undefined,
                notes: orderMetadataNotes || undefined,
            }, userId);

            clearCart();
            setLocation(isNikken ? `/nikken/account/tracking/${orderId}` : `/account/tracking/${orderId}`);
        } catch (error) {
            console.error('Error saving order to Odoo:', error);
            toast.error('No pudimos guardar el pedido en Odoo; seguimos por WhatsApp.');

            const fallbackOrderId = createFallbackOrderId(brand);
            const baseOrder = generateOrderDetails();
            const finalMessage = `${baseOrder}*Aviso:* El pedido no se pudo guardar automaticamente en el sistema. Referencia local: ${fallbackOrderId}. Por favor confirmar manualmente.`;
            openWhatsApp(finalMessage);

            upsertOrder({
                id: fallbackOrderId,
                brand,
                status: 'pending',
                paymentMethod,
                subtotal,
                shippingCost,
                total,
                customerName,
                customerPhone,
                customerAddress,
                items: mapCartItemsToOrderItems(items),
                carrier: 'Confirmacion por WhatsApp',
                notes: orderMetadataNotes || undefined,
            }, userId);

            clearCart();
            setLocation(isNikken ? `/nikken/account/tracking/${fallbackOrderId}` : `/account/tracking/${fallbackOrderId}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-background selection:bg-primary/20 transition-colors duration-500 pb-20">
            <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-primary/10 shadow-sm">
                <div className="container mx-auto px-4 h-16 flex items-center gap-4">
                    <button
                        onClick={() => setLocation(isNikken ? '/nikken' : '/')}
                        className="p-2 hover:bg-secondary/10 rounded-full text-foreground/80 hover:text-primary transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className={`heading text-xl md:text-2xl font-bold ${isNikken ? 'text-primary' : 'text-foreground'}`}>
                        {isNikken ? 'Finalizar Pedido Nikken' : 'Finalizar Compra'}
                    </h1>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                    <div className="lg:col-span-7 space-y-8">
                        <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-primary/10">
                            <h2 className="heading text-2xl font-bold mb-6 text-foreground flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">1</span>
                                Datos de envio
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-2 mb-1 block">
                                        Nombre completo
                                    </label>
                                    <Input
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        placeholder="Ej. Maria Perez"
                                        className="rounded-xl border-border/60 bg-secondary/5 focus-visible:ring-primary/30 h-12"
                                    />
                                    {activeProfileLabel ? (
                                        <p className="text-xs text-muted-foreground mt-2 ml-2">
                                            Este pedido se guardara para el perfil activo: {activeProfileLabel}.
                                        </p>
                                    ) : null}
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-2 mb-1 block">
                                        Telefono (WhatsApp)
                                    </label>
                                    <Input
                                        value={customerPhone}
                                        onChange={(e) => setCustomerPhone(e.target.value)}
                                        placeholder="10 digitos"
                                        type="tel"
                                        className="rounded-xl border-border/60 bg-secondary/5 focus-visible:ring-primary/30 h-12"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-2 mb-1 block">
                                        Direccion de entrega
                                    </label>
                                    <Textarea
                                        value={customerAddress}
                                        onChange={(e) => setCustomerAddress(e.target.value)}
                                        placeholder="Calle, Numero, Colonia, Codigo Postal, Referencias..."
                                        className="rounded-xl border-border/60 bg-secondary/5 focus-visible:ring-primary/30 min-h-[100px] resize-none"
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-primary/10">
                            <h2 className="heading text-2xl font-bold mb-6 text-foreground flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">2</span>
                                Metodo de pago
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div
                                    onClick={() => setPaymentMethod('whatsapp_cash')}
                                    className={`cursor-pointer rounded-2xl p-4 border-2 transition-all flex flex-col items-center justify-center gap-3 text-center ${paymentMethod === 'whatsapp_cash' ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/30 bg-white'}`}
                                >
                                    <Banknote className={`w-8 h-8 ${paymentMethod === 'whatsapp_cash' ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <div>
                                        <p className="font-bold heading text-sm">Pago a la entrega</p>
                                        <p className="text-xs text-muted-foreground mt-1">{paymentOptions.whatsapp_cash.description}</p>
                                    </div>
                                </div>

                                <div
                                    onClick={() => paymentOptions.transfer.enabled && setPaymentMethod('transfer')}
                                    className={`rounded-2xl p-4 border-2 transition-all flex flex-col items-center justify-center gap-3 text-center ${paymentOptions.transfer.enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} ${paymentMethod === 'transfer' ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/30 bg-white'}`}
                                >
                                    <Building2 className={`w-8 h-8 ${paymentMethod === 'transfer' ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <div>
                                        <p className="font-bold heading text-sm">Transferencia</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {paymentOptions.transfer.feedback || paymentOptions.transfer.description}
                                        </p>
                                    </div>
                                </div>

                                <div
                                    onClick={() => paymentOptions.connectia.enabled && setPaymentMethod('connectia')}
                                    className={`rounded-2xl p-4 border-2 transition-all flex flex-col items-center justify-center gap-3 text-center ${paymentOptions.connectia.enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} ${paymentMethod === 'connectia' ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/30 bg-white'}`}
                                >
                                    <CreditCard className={`w-8 h-8 ${paymentMethod === 'connectia' ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <div>
                                        <p className="font-bold heading text-sm">Connectia (TDC / TDD)</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {paymentOptions.connectia.feedback || paymentOptions.connectia.description}
                                        </p>
                                    </div>
                                </div>

                                <div
                                    onClick={() => paymentOptions.paypal.enabled && setPaymentMethod('paypal')}
                                    className={`rounded-2xl p-4 border-2 transition-all flex flex-col items-center justify-center gap-3 text-center ${paymentOptions.paypal.enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} ${paymentMethod === 'paypal' ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/30 bg-white'}`}
                                >
                                    <svg viewBox="0 0 24 24" className={`w-8 h-8 ${paymentMethod === 'paypal' ? 'fill-primary' : 'fill-muted-foreground'}`}>
                                        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106a.64.64 0 0 1-.632.54h.632z" />
                                    </svg>
                                    <div>
                                        <p className="font-bold heading text-sm">PayPal</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {paymentOptions.paypal.feedback || paymentOptions.paypal.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {!paymentOptions[paymentMethod].enabled && paymentOptions[paymentMethod].feedback ? (
                                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mt-4">
                                    {paymentOptions[paymentMethod].feedback}
                                </p>
                            ) : null}
                        </section>
                    </div>

                    <div className="lg:col-span-5">
                        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-primary/10 sticky top-24">
                            <h3 className="heading text-xl font-bold mb-6 text-foreground">Resumen de tu pedido</h3>

                            <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                {items.map(item => (
                                    <div key={item.product.id} className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-xl bg-secondary/10 p-1 flex-shrink-0">
                                            <img
                                                src={item.product.imageUrl}
                                                alt={item.product.name}
                                                className="w-full h-full object-contain mix-blend-multiply"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = getProductFallbackImage(item.product.brand);
                                                }}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="heading text-sm font-bold truncate">{item.product.name}</p>
                                            <p className="body text-xs text-muted-foreground">Cant: {item.quantity}</p>
                                            {item.product.deliveryTime || item.product.deliveryMethods.length > 0 ? (
                                                <p className="body text-[11px] text-slate-500 mt-1 leading-relaxed">
                                                    {[item.product.deliveryTime, ...item.product.deliveryMethods].filter(Boolean).join(' · ')}
                                                </p>
                                            ) : null}
                                            {!item.product.inStock ? (
                                                <p className="body text-[11px] text-amber-700 mt-1">
                                                    Bajo pedido; disponibilidad sujeta a confirmacion.
                                                </p>
                                            ) : null}
                                        </div>
                                        <div className="font-bold heading text-primary shrink-0">
                                            ${(item.product.price * item.quantity).toFixed(2)}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {deliverySummaryText || deliveryMethodsText || backorderUnits > 0 ? (
                                <div className="mb-6 rounded-2xl border border-primary/10 bg-secondary/5 px-4 py-4 space-y-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                        Logistica del pedido
                                    </p>
                                    {deliverySummaryText ? (
                                        <p className="text-sm text-foreground">
                                            Entrega estimada: <span className="font-medium">{deliverySummaryText}</span>
                                        </p>
                                    ) : null}
                                    {deliveryMethodsText ? (
                                        <p className="text-xs text-muted-foreground">
                                            Metodos de entrega: {deliveryMethodsText}
                                        </p>
                                    ) : null}
                                    {backorderUnits > 0 ? (
                                        <p className="text-xs text-amber-700">
                                            Hay {backorderUnits} unidad{backorderUnits === 1 ? '' : 'es'} bajo pedido; el tiempo final puede variar.
                                        </p>
                                    ) : null}
                                </div>
                            ) : null}

                            <div className="space-y-3 pt-4 border-t border-border/50 mb-6">
                                <div className="flex justify-between text-muted-foreground text-sm">
                                    <span>Subtotal</span>
                                    <span>${subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground text-sm">
                                    <span>Envio</span>
                                    <span>{shippingCost === 0 ? 'Gratis' : `$${shippingCost.toFixed(2)}`}</span>
                                </div>
                                <div className="flex justify-between items-center text-foreground font-black text-xl heading pt-2 border-t border-border/50">
                                    <span>Total</span>
                                    <span className="text-primary">${total.toFixed(2)}</span>
                                </div>
                            </div>

                            <Button
                                onClick={handleCheckout}
                                disabled={isProcessing}
                                className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white shadow-xl hover:shadow-primary/30 transition-all font-bold heading text-lg"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Procesando...
                                    </>
                                ) : (
                                    'Confirmar pedido'
                                )}
                            </Button>
                            <p className="text-center text-xs text-muted-foreground mt-4">
                                {isNikken
                                    ? 'Al confirmar, aceptas que el inventario depende de la disponibilidad del distribuidor independiente.'
                                    : 'Al confirmar, aceptas que el inventario depende de la disponibilidad del consultor.'}
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
