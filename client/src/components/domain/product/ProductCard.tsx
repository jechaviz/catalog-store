import { type MouseEvent, useEffect, useState } from 'react';
import { Heart, Eye, ShoppingCart } from 'lucide-react';
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
import { normalizeStorageScopeId } from '@/lib/storageScope';
import {
    getLikesStorageKey,
    getProductFallbackImage,
    readBrandLikeIds,
    toggleBrandLikeId,
} from '@/lib/storefrontStorage';

interface ProductCardProps {
    product: CatalogProduct;
    onViewDetail: (product: CatalogProduct) => void;
    onAddToCart: (product: CatalogProduct) => void;
}

type LocalStatus = 'new' | 'edited' | null;

function formatCardPrice(price: number) {
    const hasCents = Math.abs(price % 1) > 0.001;

    return price.toLocaleString('en-US', {
        minimumFractionDigits: hasCents ? 2 : 0,
        maximumFractionDigits: hasCents ? 2 : 0,
    });
}

export function ProductCard({
    product,
    onViewDetail,
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
        const activeScopeId = normalizeStorageScopeId(user?.id);
        const likesStorageKey = getLikesStorageKey(brand, user?.id);

        const syncLikedState = () => {
            const likedItems = readBrandLikeIds(brand, user?.id);
            setIsLiked(likedItems.includes(product.id));
        };

        const handleLikesChanged = (event: Event) => {
            const detail = (event as CustomEvent<{
                storageKey?: string;
                brand?: typeof brand;
                scopeId?: string;
                source?: 'local' | 'remote';
            }>).detail;

            if (detail?.brand && detail.brand !== brand) {
                return;
            }

            if (detail?.scopeId && detail.scopeId !== activeScopeId) {
                return;
            }

            if (detail?.storageKey && detail.storageKey !== likesStorageKey) {
                return;
            }

            syncLikedState();
        };

        syncLikedState();
        window.addEventListener('catalog-likes-changed', handleLikesChanged as EventListener);

        return () => {
            window.removeEventListener('catalog-likes-changed', handleLikesChanged as EventListener);
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

    const toggleLike = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        const newLikes = toggleBrandLikeId(brand, product.id, user?.id);
        setIsLiked(newLikes.includes(product.id));
    };

    return (
        <Card className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg">
            <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted/25 p-5 group/image">
                <div className="absolute left-5 top-4 z-10">
                    <span
                        className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md ${
                            product.inStock
                                ? 'bg-green-100/80 text-green-700 border border-green-200/50'
                                : 'bg-orange-100/80 text-orange-700 border border-orange-200/50'
                        }`}
                    >
                        {product.inStock ? 'En stock' : 'Bajo pedido'}
                    </span>
                </div>

                <div className="absolute bottom-4 left-5 z-10 flex flex-col items-start gap-1">
                    {localStatus && (
                        <span
                            className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] shadow-sm ${
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
                    type="button"
                    onClick={toggleLike}
                    className="absolute right-4 top-3 z-20 rounded-full bg-white/90 p-2.5 text-muted-foreground shadow-md backdrop-blur-md transition-all hover:bg-red-50 hover:text-red-500 hover:shadow-lg active:scale-95"
                    title={isLiked ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                    aria-label={isLiked ? `Quitar ${product.name} de favoritos` : `Añadir ${product.name} a favoritos`}
                >
                    <Heart
                        className={`h-5 w-5 transition-all duration-300 ${
                            isLiked ? 'fill-red-500 text-red-500 scale-110' : ''
                        }`}
                    />
                </button>

                <button
                    type="button"
                    className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-primary/5 opacity-0 transition-opacity duration-300 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    onClick={(event) => {
                        event.stopPropagation();
                        onViewDetail(product);
                    }}
                    aria-label={`Ver detalles de ${product.name}`}
                >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/10 bg-white/95 text-primary shadow-xl">
                        <Eye className="h-6 w-6" />
                    </div>
                </button>

                <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-full w-full object-contain drop-shadow-xl transition-transform duration-500 group-hover/image:scale-105"
                    onError={(event) => {
                        (event.target as HTMLImageElement).src = getProductFallbackImage(product.brand);
                    }}
                />
            </div>

            <div className="relative z-10 flex flex-grow flex-col p-5">
                <div className="mb-3 flex items-start justify-between gap-4">
                    <div>
                        <p className="heading mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/75">
                            {product.brand}
                        </p>
                        <h3 className="heading line-clamp-2 text-lg font-bold leading-tight text-foreground transition-colors group-hover:text-primary">
                            {product.name}
                        </h3>
                        {(product.subBrand || showDeliveryMeta) && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {product.subBrand && (
                                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                                        {product.subBrand}
                                    </span>
                                )}
                                {showDeliveryMeta && (
                                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        Tiempo: {product.deliveryTime}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <p className="body mb-6 line-clamp-2 flex-grow text-xs leading-relaxed text-muted-foreground opacity-85">
                    {product.description}
                </p>

                <div className="mt-auto grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                    <div className="min-w-0">
                        <span className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">
                            Precio
                        </span>
                        <span className="block truncate font-mono text-lg font-black leading-none tracking-tight text-primary tabular-nums sm:text-xl">
                            ${formatCardPrice(product.price)}
                        </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={(event) => {
                                event.stopPropagation();
                                onViewDetail(product);
                            }}
                            className="h-10 w-10 shrink-0 rounded-xl border-primary/15 p-0 text-primary shadow-sm transition-all hover:bg-primary/10"
                            title="Ver detalles"
                            aria-label={`Ver detalles de ${product.name}`}
                        >
                            <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                            onClick={(event) => {
                                event.stopPropagation();
                                onAddToCart(product);
                            }}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary p-0 text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
                            title="Añadir al carrito"
                            aria-label={`Añadir ${product.name} al carrito`}
                        >
                            <ShoppingCart className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
}
