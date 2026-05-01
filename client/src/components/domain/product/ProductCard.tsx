import { useEffect, useState } from 'react';
import { Heart, Eye, MessageCircle, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { Button } from '@/components/shared/ui/button';
import { Card } from '@/components/shared/ui/card';
import {
    isCustomCatalogProductId,
    isLocalCatalogStorageKeyForBrand,
    readLocalCatalogOverrides,
} from '@/lib/adminCatalogStorage';
import type { CatalogProduct } from '@/lib/dataFetcher';
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

type LocalStatus = 'new' | 'edited' | null;

export function ProductCard({
    product,
    onViewDetail,
    onQuickBuy,
    onAddToCart,
}: ProductCardProps) {
    const [isLiked, setIsLiked] = useState(false);
    const [localStatus, setLocalStatus] = useState<LocalStatus>(null);
    const { user } = useAuth();
    const { brand } = useBrand();
    const isLocalProduct = isCustomCatalogProductId(product.id);
    const showDeliveryMeta = Boolean(
        product.deliveryTime &&
        product.deliveryTime.trim() &&
        product.deliveryTime.toLowerCase() !== 'entrega inmediata',
    );

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

    useEffect(() => {
        const syncLocalStatus = () => {
            const overrides = readLocalCatalogOverrides(brand);
            const hasLocalOverride = overrides.products.some((item) => item?.id === product.id);

            if (!hasLocalOverride) {
                setLocalStatus(null);
                return;
            }

            setLocalStatus(isLocalProduct ? 'new' : 'edited');
        };

        const handleStorageEvent = (event: StorageEvent) => {
            if (isLocalCatalogStorageKeyForBrand(event.key, brand)) {
                syncLocalStatus();
            }
        };

        const handleLocalCatalogEvent = (event: Event) => {
            const customEvent = event as CustomEvent<{ brand?: string; storageKey?: string }>;
            if (
                customEvent.detail?.brand === brand ||
                isLocalCatalogStorageKeyForBrand(customEvent.detail?.storageKey, brand)
            ) {
                syncLocalStatus();
            }
        };

        syncLocalStatus();
        window.addEventListener('storage', handleStorageEvent);
        window.addEventListener('catalog-local-products-changed', handleLocalCatalogEvent);

        return () => {
            window.removeEventListener('storage', handleStorageEvent);
            window.removeEventListener('catalog-local-products-changed', handleLocalCatalogEvent);
        };
    }, [brand, isLocalProduct, product.id]);

    const toggleLike = () => {
        const newLikes = toggleBrandLikeId(brand, product.id, user?.id);
        setIsLiked(newLikes.includes(product.id));
    };

    return (
        <Card className="group relative overflow-hidden bg-white/80 backdrop-blur-sm border-transparent hover:border-primary/20 shadow-sm hover:shadow-2xl transition-all duration-500 rounded-[2rem] flex flex-col h-full">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full filter blur-2xl transform translate-x-10 -translate-y-10 group-hover:bg-primary/10 transition-colors duration-500" />

            <div className="relative aspect-square p-6 flex flex-col items-center justify-center bg-transparent mt-4 group/image overflow-hidden">
                <div className="absolute top-2 left-4 z-10">
                    <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm backdrop-blur-md ${
                            product.inStock
                                ? 'bg-green-100/80 text-green-700 border border-green-200/50'
                                : 'bg-orange-100/80 text-orange-700 border border-orange-200/50'
                        }`}
                    >
                        {product.inStock ? 'En stock' : 'Bajo pedido'}
                    </span>
                </div>

                <div className="absolute top-14 right-4 z-10 flex flex-col gap-1 items-end">
                    {localStatus && (
                        <span
                            className={`text-[9px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-md shadow-sm ${
                                localStatus === 'new'
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                        >
                            {localStatus === 'new' ? 'Nuevo local' : 'Editado local'}
                        </span>
                    )}
                </div>

                <button
                    onClick={toggleLike}
                    className="absolute top-2 right-4 z-20 p-2.5 rounded-full bg-white/80 backdrop-blur-md shadow-sm hover:shadow-md hover:bg-red-50 transition-all text-muted-foreground hover:text-red-500 group/btn"
                    title={isLiked ? 'Quitar de favoritos' : 'Anadir a favoritos'}
                >
                    <Heart
                        className={`w-5 h-5 transition-transform group-hover/btn:scale-110 ${
                            isLiked ? 'fill-red-500 text-red-500' : ''
                        }`}
                    />
                </button>

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
                    onError={(event) => {
                        (event.target as HTMLImageElement).src = getProductFallbackImage(product.brand);
                    }}
                />
            </div>

            <div className="p-6 pt-2 flex flex-col flex-grow relative z-10">
                <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                        <p className="font-bold text-xs uppercase tracking-widest text-primary/80 mb-1 heading">
                            {product.brand}
                        </p>
                        <h3 className="text-xl font-bold text-foreground leading-tight heading line-clamp-2">
                            {product.name}
                        </h3>
                        {(product.subBrand || showDeliveryMeta) && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {product.subBrand && (
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                                        {product.subBrand}
                                    </span>
                                )}
                                {showDeliveryMeta && (
                                    <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                                        {product.deliveryTime}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <p className="text-muted-foreground text-sm line-clamp-2 body mb-6 flex-grow">
                    {product.description}
                </p>

                <div className="flex items-center justify-between mt-auto">
                    <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase opacity-70 mb-0.5">
                            Precio
                        </span>
                        <span className="text-2xl font-black text-primary font-mono tracking-tight truncate">
                            ${product.price.toFixed(2)}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="outline"
                            onClick={(event) => {
                                event.stopPropagation();
                                onQuickBuy(product);
                            }}
                            className="rounded-full w-12 h-12 p-0 border-primary/20 hover:bg-primary/10 text-primary transition-all flex items-center justify-center shrink-0 shadow-sm"
                            title="Contacto / Atencion personal"
                        >
                            <MessageCircle className="w-5 h-5" />
                        </Button>
                        <Button
                            onClick={(event) => {
                                event.stopPropagation();
                                onAddToCart(product);
                                const button = event.currentTarget;
                                button.classList.add('animate-bounce');
                                setTimeout(() => button.classList.remove('animate-bounce'), 800);
                            }}
                            className="rounded-full w-12 h-12 p-0 bg-primary hover:bg-primary/80 active:scale-95 text-white shadow-lg hover:shadow-primary/40 transition-all group/buy shrink-0 flex items-center justify-center"
                            title="Anadir al carrito"
                        >
                            <ShoppingCart className="w-5 h-5 group-hover/buy:-rotate-12 transition-transform" />
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
}
