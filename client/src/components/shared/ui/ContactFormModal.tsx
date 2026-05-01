import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/shared/ui/dialog';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';
import { MessageCircle, CreditCard, ChevronRight } from 'lucide-react';
import { CONFIG } from '@/config';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { useStorefrontSettings } from '@/hooks/useStorefrontSettings';
import type { CatalogProduct } from '@/lib/dataFetcher';
import { getProductFallbackImage } from '@/lib/storefrontStorage';

interface ContactFormModalProps {
    product: CatalogProduct | null;
    isOpen: boolean;
    onClose: () => void;
    sellerPhone?: string;
}

export function ContactFormModal({
    product,
    isOpen,
    onClose,
    sellerPhone,
}: ContactFormModalProps) {
    const { user } = useAuth();
    const { brand } = useBrand();
    const storefrontSettings = useStorefrontSettings(brand);
    const [customerName, setCustomerName] = useState(() => user?.name?.trim() || '');
    const [customerLocation, setCustomerLocation] = useState('');

    useEffect(() => {
        const nextName = user?.name?.trim();

        if (nextName) {
            setCustomerName(currentName => currentName.trim() ? currentName : nextName);
        }
    }, [user?.name]);

    if (!product) return null;

    const brandName = product.brand?.trim() || (brand === 'nikken' ? 'Nikken' : 'Natura');
    const normalizedBrand = brandName.toLowerCase();
    const fallbackImage = getProductFallbackImage(product.brand || brand);
    const configuredMessageTemplate = storefrontSettings.sellerMessageTemplate.trim();
    const sellerContactPhone = sellerPhone?.trim() || storefrontSettings.sellerPhone || CONFIG.SELLER.PHONE;
    const quickHelpCopy = normalizedBrand === 'nikken'
        ? 'Te ayudamos a confirmar disponibilidad y entrega por WhatsApp.'
        : 'Te ayudamos a cerrar tu pedido por WhatsApp.';

    const handleWhatsAppOrder = () => {
        const greeting = customerName.trim() ? `Hola, soy ${customerName.trim()}. ` : 'Hola. ';
        const locationInfo = customerLocation.trim() ? ` Vivo en ${customerLocation.trim()}.` : '';
        const templateWithoutGreeting = configuredMessageTemplate
            .replace(/^hola[\s,.!¡¿?]*/i, '')
            .trim();
        const productLine = `el producto *${product.name}* de *${brandName}* por $${product.price.toFixed(2)}`;
        const messageBody = templateWithoutGreeting
            ? `${templateWithoutGreeting} ${productLine}`.trim()
            : `Me interesa ${productLine}`;
        const message = `${greeting}${messageBody} que vi en el catálogo digital de ${brandName}.${locationInfo}`;

        window.open(
            `${CONFIG.SELLER.WHATSAPP_BASE_URL}${sellerContactPhone}?text=${encodeURIComponent(message)}`,
            '_blank'
        );
        onClose();
    };

    const handlePaymentLink = () => {
        if (product.paymentLink) {
            window.open(product.paymentLink, '_blank');
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md w-11/12 bg-white/95 backdrop-blur-md rounded-[2rem] p-6 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="heading text-xl font-bold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <span>Compra rápida de {brandName}</span>
                        <span className="text-primary font-mono text-xl">${product.price.toFixed(2)}</span>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                    <p className="text-sm text-muted-foreground">
                        {quickHelpCopy}
                    </p>

                    <div className="flex items-center gap-4 bg-secondary/10 p-4 rounded-2xl">
                        <img
                            src={product.imageUrl || fallbackImage}
                            alt={product.name}
                            className="w-12 h-12 object-contain mix-blend-multiply"
                            onError={(event) => {
                                const image = event.currentTarget;
                                image.onerror = null;
                                image.src = fallbackImage;
                            }}
                        />
                        <div className="min-w-0">
                            <span className="font-semibold text-sm leading-tight block">{product.name}</span>
                            <span className="text-xs text-muted-foreground">{brandName}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Input
                            placeholder="Tu nombre"
                            value={customerName}
                            onChange={event => setCustomerName(event.target.value)}
                            className="rounded-xl h-12 focus-visible:ring-primary/20 bg-secondary/5"
                        />
                        <Input
                            placeholder="Tu ubicación (opcional)"
                            value={customerLocation}
                            onChange={event => setCustomerLocation(event.target.value)}
                            className="rounded-xl h-12 focus-visible:ring-primary/20 bg-secondary/5"
                        />
                    </div>

                    <div className="flex flex-col gap-3 pt-4 border-t border-border/20">
                        <Button
                            onClick={handleWhatsAppOrder}
                            className="w-full h-14 rounded-2xl bg-[#25D366] hover:bg-[#1EBE5D] text-white shadow-md flex justify-between px-6 group"
                        >
                            <span className="flex items-center gap-2 font-bold heading">
                                <MessageCircle className="w-5 h-5" />
                                WhatsApp rápido
                            </span>
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition" />
                        </Button>
                        {product.paymentLink && (
                            <Button
                                onClick={handlePaymentLink}
                                variant="outline"
                                className="w-full h-14 rounded-2xl border-primary/20 text-primary hover:bg-primary/5 flex justify-between px-6 group"
                            >
                                <span className="flex items-center gap-2 font-bold heading">
                                    <CreditCard className="w-5 h-5" />
                                    Pagar en línea
                                </span>
                                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition" />
                            </Button>
                        )}
                        <Button variant="ghost" onClick={onClose} className="rounded-2xl text-muted-foreground w-full">
                            Cancelar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
