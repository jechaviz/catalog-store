import { Heart, Eye, MessageCircle, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/shared/ui/button';
import { Card } from '@/components/shared/ui/card';
import type { CatalogProduct } from '@/lib/dataFetcher';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import {
    getProductFallbackImage,
    readBrandLikeIds,
    toggleBrandLikeId,
} from '@/lib/storefrontStorage';

interface ProductCardProps {
    product: CatalogProduct;
    onViewDetail: (product: CatalogProduct) => void;
    onQuickBuy: (product: CatalogProduct) => void;
    onAddToCart: (product: CatalogProduct) => void;
}

export function ProductCard({ product, onViewDetail, onQuickBuy, onAddToCart }: ProductCardProps) {
    const [isLiked, setIsLiked] = useState(false);
    const { user } = useAuth();
    const { brand } = useBrand();

    useEffect(() => {
        const syncLikedState = () => {
            const likedItems = readBrandLikeIds(brand, user?.id);
            setIsLiked(likedItems.includes(product.id));
        };

        syncLikedState();
        window.addEventListener('catalog-likes-changed', syncLikedState);

        return () => {
            window.removeEventListener('catalog-likes-changed', syncLikedState);
        };
    }, [brand, product.id, user?.id]);

    const toggleLike = () => {
        const newLikes = toggleBrandLikeId(brand, product.id, user?.id);
        setIsLiked(newLikes.includes(product.id));
    };

    return (
        <Card className="group relative overflow-hidden bg-white/80 backdrop-blur-sm border-transparent hover:border-primary/20 shadow-sm hover:shadow-2xl transition-all duration-500 rounded-[2rem] flex flex-col h-full">
            {/* Decorative blurred background blob */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full filter blur-2xl transform translate-x-10 -translate-y-10 group-hover:bg-primary/10 transition-colors duration-500"></div>

            {/* Product Image Container */}
            <div className="relative aspect-square p-6 flex flex-col items-center justify-center bg-transparent mt-4 group/image overflow-hidden">
                {/* Delivery Badge (Top Left) */}
                <div className="absolute top-2 left-4 z-10">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm backdrop-blur-md ${product.inStock
                        ? 'bg-green-100/80 text-green-700 border border-green-200/50'
                        : 'bg-orange-100/80 text-orange-700 border border-orange-200/50'
                        }`}>
                        {product.inStock ? 'En stock' : 'Bajo pedido'}
                    </span>
                </div>
                {/* Brand Tag (Top Right - below Like) */}
                <div className="absolute top-14 right-4 z-10 flex flex-col gap-1 items-end">
                    {product.subBrand && (
                        <span className="text-[9px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-md bg-primary text-white shadow-sm">
                            {product.subBrand}
                        </span>
                    )}
                </div>

                {/* Like Button (Absolute top right) */}
                <button
                    onClick={toggleLike}
                    className="absolute top-2 right-4 z-20 p-2.5 rounded-full bg-white/80 backdrop-blur-md shadow-sm hover:shadow-md hover:bg-red-50 transition-all text-muted-foreground hover:text-red-500 group/btn"
                    title={isLiked ? "Quitar de favoritos" : "Añadir a favoritos"}
                >
                    <Heart className={`w-5 h-5 transition-transform group-hover/btn:scale-110 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                </button>

                {/* Eye Icon Overlay for Detail View */}
                <div
                    className="absolute inset-0 bg-primary/20 backdrop-blur-[2px] opacity-0 group-hover/image:opacity-100 transition-opacity duration-300 z-10 flex items-center justify-center cursor-pointer rounded-[2rem]"
                    onClick={() => onViewDetail(product)}
                >
                    <div className="w-14 h-14 bg-white text-primary rounded-full shadow-2xl flex items-center justify-center transform scale-50 group-hover/image:scale-100 transition-all duration-300 hover:bg-primary hover:text-white hover:scale-110">
                        <Eye className="w-6 h-6" />
                    </div>
                </div>

                <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-contain filter drop-shadow-xl group-hover/image:scale-105 transition-transform duration-500"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = getProductFallbackImage(product.brand);
                    }}
                />
            </div>

            {/* Content */}
            <div className="p-6 pt-2 flex flex-col flex-grow relative z-10">
                <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                        <p className="font-bold text-xs uppercase tracking-widest text-primary/80 mb-1 heading">
                            {product.brand} {product.subBrand}
                        </p>
                        <h3 className="text-xl font-bold text-foreground leading-tight heading line-clamp-2">
                            {product.name}
                        </h3>
                    </div>
                </div>

                <p className="text-muted-foreground text-sm line-clamp-2 body mb-6 flex-grow">
                    {product.description}
                </p>

                {/* Price & Buy Button container always pushed to bottom */}
                <div className="flex items-center justify-between mt-auto">
                    <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase opacity-70 mb-0.5">Precio</span>
                        <span className="text-2xl font-black text-primary font-mono tracking-tight truncate">${product.price.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); onQuickBuy(product); }}
                            className="rounded-full w-12 h-12 p-0 border-primary/20 hover:bg-primary/10 text-primary transition-all flex items-center justify-center shrink-0 shadow-sm"
                            title="Contacto / Atención Personal"
                        >
                            <MessageCircle className="w-5 h-5" />
                        </Button>
                        <Button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAddToCart(product);
                                // Local "dance" trigger
                                const btn = e.currentTarget;
                                btn.classList.add('animate-bounce');
                                setTimeout(() => btn.classList.remove('animate-bounce'), 800);
                            }}
                            className="rounded-full w-12 h-12 p-0 bg-primary hover:bg-primary/80 active:scale-95 text-white shadow-lg hover:shadow-primary/40 transition-all group/buy shrink-0 flex items-center justify-center"
                            title="Añadir al Carrito"
                        >
                            <ShoppingCart className="w-5 h-5 group-hover/buy:-rotate-12 transition-transform" />
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
}
