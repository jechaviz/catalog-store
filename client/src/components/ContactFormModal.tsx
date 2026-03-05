import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, CreditCard, ChevronRight } from 'lucide-react';
import type { CatalogProduct } from '@/lib/dataFetcher';

interface ContactFormModalProps {
    product: CatalogProduct | null;
    isOpen: boolean;
    onClose: () => void;
    sellerPhone?: string;
}

export function ContactFormModal({ product, isOpen, onClose, sellerPhone = "5215573456073" }: ContactFormModalProps) {
    const [customerName, setCustomerName] = useState('');
    const [customerLocation, setCustomerLocation] = useState('');

    if (!product) return null;

    const handleWhatsAppOrder = () => {
        const greeting = customerName ? `Hola soy ${customerName}, ` : `Hola, `;
        const locationInfo = customerLocation ? ` Vivo en ${customerLocation}.` : '';
        const message = `${greeting}me interesa el producto *${product.name}* a $${product.price.toFixed(2)} que vi en Natura Digital.${locationInfo}`;

        window.open(`https://wa.me/${sellerPhone}?text=${encodeURIComponent(message)}`, '_blank');
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
                        <span>Compra Rápida ✨</span>
                        <span className="text-primary font-mono text-xl">${product.price.toFixed(2)}</span>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                    <div className="flex items-center gap-4 bg-secondary/10 p-4 rounded-2xl">
                        <img src={product.imageUrl} alt={product.name} className="w-12 h-12 object-contain mix-blend-multiply" />
                        <span className="font-semibold text-sm leading-tight">{product.name}</span>
                    </div>

                    <div className="space-y-3">
                        <Input placeholder="Tu Nombre" value={customerName} onChange={e => setCustomerName(e.target.value)} className="rounded-xl h-12 focus-visible:ring-primary/20 bg-secondary/5" />
                        <Input placeholder="Tu Ubicación (Opcional)" value={customerLocation} onChange={e => setCustomerLocation(e.target.value)} className="rounded-xl h-12 focus-visible:ring-primary/20 bg-secondary/5" />
                    </div>

                    <div className="flex flex-col gap-3 pt-4 border-t border-border/20">
                        <Button onClick={handleWhatsAppOrder} className="w-full h-14 rounded-2xl bg-[#25D366] hover:bg-[#1EBE5D] text-white shadow-md flex justify-between px-6 group">
                            <span className="flex items-center gap-2 font-bold heading"><MessageCircle className="w-5 h-5" /> WhatsApp Rápido</span>
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition" />
                        </Button>
                        {product.paymentLink && (
                            <Button onClick={handlePaymentLink} variant="outline" className="w-full h-14 rounded-2xl border-primary/20 text-primary hover:bg-primary/5 flex justify-between px-6 group">
                                <span className="flex items-center gap-2 font-bold heading"><CreditCard className="w-5 h-5" /> Pagar en Línea</span>
                                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition" />
                            </Button>
                        )}
                        <Button variant="ghost" onClick={onClose} className="rounded-2xl text-muted-foreground w-full">Cancelar</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
