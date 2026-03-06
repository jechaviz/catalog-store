import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from '@/components/shared/ui/drawer';
import { Button } from '@/components/shared/ui/button';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

interface CartDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onProceedToCheckout: () => void;
}

export function CartDrawer({ isOpen, onClose, onProceedToCheckout }: CartDrawerProps) {
    const { items, updateQuantity, removeItem, subtotal, itemCount } = useCart();

    return (
        <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()} direction="right">
            <DrawerContent className="h-[100dvh] top-0 right-0 left-auto mt-0 w-full sm:w-[400px] md:w-[450px] rounded-none border-l shadow-2xl bg-white/95 backdrop-blur-xl flex flex-col">
                <DrawerHeader className="border-b border-primary/10 flex flex-col items-center justify-center p-6 gap-3 pb-8">
                    <DrawerTitle className="text-2xl font-bold heading flex items-center justify-center gap-2 text-foreground">
                        <ShoppingBag className="w-5 h-5 text-primary" />
                        Tu Carrito
                    </DrawerTitle>
                    <DrawerDescription className="sr-only">
                        Resumen de los productos añadidos a tu carrito de compras.
                    </DrawerDescription>
                    <div className="bg-secondary/10 text-primary font-semibold px-4 py-1.5 rounded-full text-sm">
                        {itemCount} {itemCount === 1 ? 'artículo' : 'artículos'}
                    </div>
                </DrawerHeader>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar">
                    {items.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-70">
                            <ShoppingBag className="w-16 h-16 text-muted-foreground mb-4" />
                            <p className="heading text-xl font-bold text-foreground">Tu carrito está vacío</p>
                            <p className="body text-sm mt-2">¡Descubre nuestros productos y añade tus favoritos!</p>
                            <Button onClick={onClose} variant="outline" className="mt-6 rounded-full">
                                Seguir comprando
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {items.map((item) => (
                                <div key={item.product.id} className="flex gap-4 p-4 rounded-2xl bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] border border-primary/5 group shrink-0 items-center">
                                    <div className="w-20 h-20 rounded-xl bg-secondary/10 flex-shrink-0 flex items-center justify-center p-2 relative overflow-hidden">
                                        <img
                                            src={item.product.imageUrl}
                                            alt={item.product.name}
                                            className="w-full h-full object-contain mix-blend-multiply"
                                        />
                                    </div>

                                    <div className="flex-1 flex flex-col gap-3">
                                        <div className="flex justify-between items-start gap-2">
                                            <div>
                                                <h4 className="font-bold text-sm heading leading-tight">{item.product.name}</h4>
                                                <p className="text-[10px] text-muted-foreground uppercase mt-1 tracking-wider">{item.product.subBrand}</p>
                                            </div>
                                            <button
                                                onClick={() => removeItem(item.product.id)}
                                                className="text-muted-foreground/50 hover:text-red-500 transition-colors p-1"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between mt-1">
                                            <div className="flex items-center gap-3 bg-[#f0f9ff] rounded-full px-3 py-1.5 border border-[#e0f2fe]">
                                                <button
                                                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                                    className="w-5 h-5 rounded-full flex items-center justify-center bg-white shadow-sm hover:text-primary transition-colors text-muted-foreground"
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <span className="font-bold text-sm min-w-[1.5ch] text-center">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                                    className="w-5 h-5 rounded-full flex items-center justify-center bg-white shadow-sm hover:text-primary transition-colors text-muted-foreground"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <span className="font-bold heading text-primary text-base">
                                                ${(item.product.price * item.quantity).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {items.length > 0 && (
                    <div className="border-t border-primary/10 p-6 bg-white shrink-0 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-muted-foreground font-bold text-sm">Subtotal</span>
                            <span className="text-xl font-black heading">${subtotal.toFixed(2)}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-6">El costo de envío se calculará en el siguiente paso.</p>

                        <Button
                            onClick={onProceedToCheckout}
                            className="w-full h-12 rounded-xl bg-[#1e3a8a] hover:bg-[#1e40af] text-white shadow-lg transition-all flex justify-between items-center px-6"
                        >
                            <span className="font-bold text-sm heading tracking-wide">Pagar Ahora</span>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold">${subtotal.toFixed(2)}</span>
                                <ArrowRight className="w-4 h-4" />
                            </div>
                        </Button>

                        <button
                            onClick={onClose}
                            className="w-full mt-4 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors text-center"
                        >
                            Continuar Comprando
                        </button>
                    </div>
                )}
            </DrawerContent>
        </Drawer>
    );
}
