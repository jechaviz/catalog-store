import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/shared/ui/dialog';
import { Button } from '@/components/shared/ui/button';
import {
    BadgeAlert,
    CheckCircle2,
    Heart,
    ShoppingBag,
    Leaf,
    ShieldCheck,
    Sparkles,
    X,
    Zap,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { getDarkerShade, getLighterShade } from '@/hooks/useColorExtraction';
import { fetchCatalogData, type CatalogProduct } from '@/lib/dataFetcher';
import { useBrand } from '@/contexts/BrandContext';
import { useTheme } from '@/contexts/ThemeContext';
import { SocialSharePanel } from '@/components/shared/ui/SocialSharePanel';
import { ExportableProduct } from '@/components/domain/product/ExportableProduct';
import { getProductFallbackImage } from '@/lib/storefrontStorage';
import { isCustomCatalogProductId, readLocalCatalogOverrides } from '@/lib/adminCatalogStorage';

interface ProductDetailProps {
    product: CatalogProduct | null;
    isOpen: boolean;
    onClose: () => void;
    onBuy: (product: CatalogProduct) => void;
    isLiked: boolean;
    onToggleLike: () => void;
    onSelectProduct?: (product: CatalogProduct) => void;
}

function uniqueStrings(values: string[] | undefined) {
    return Array.from(
        new Set(
            (values ?? [])
                .map(value => value.trim())
                .filter(Boolean),
        ),
    );
}

function formatDetailPrice(price: number) {
    return price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function ProductDetail({
    product,
    isOpen,
    onClose,
    onBuy,
    isLiked,
    onToggleLike,
    onSelectProduct,
}: ProductDetailProps) {
    const [, setLocation] = useLocation();
    const { brand, isNikken } = useBrand();
    const { isDark } = useTheme();
    const primaryColor = isNikken ? '#008244' : '#F15A24';
    const darkColor = isDark ? getLighterShade(primaryColor, 35) : getDarkerShade(primaryColor, 42);
    const accentBgColor = isDark ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)';

    if (!product) return null;

    const localOverrides = (() => {
        if (typeof window === 'undefined') {
            return null;
        }

        try {
            return readLocalCatalogOverrides(brand);
        } catch {
            return null;
        }
    })();

    const isLocalProduct = isCustomCatalogProductId(product.id);
    const isLocallyEdited = Boolean(
        localOverrides?.products.some(localProduct => localProduct.id === product.id),
    );
    const localCatalogState = isLocalProduct
        ? 'Producto local'
        : isLocallyEdited
            ? 'Editado localmente'
            : null;

    const benefitList = uniqueStrings(product.benefits);
    const deliveryMethods = uniqueStrings(product.deliveryMethods);
    const deliveryTime = product.deliveryTime.trim();
    const availabilityLabel = product.inStock ? 'Disponible ahora' : 'Agotado por ahora';
    const deliveryNotes = deliveryMethods.length > 0 ? deliveryMethods : ['Coordinacion directa'];
    const visibleBenefits = benefitList.slice(0, 5);
    const hiddenBenefitCount = Math.max(benefitList.length - visibleBenefits.length, 0);

    const [relatedProducts, setRelatedProducts] = React.useState<CatalogProduct[]>([]);

    React.useEffect(() => {
        let isMounted = true;

        if (isOpen && product) {
            fetchCatalogData(brand).then(data => {
                if (!isMounted || !data) return;
                const related = data.products
                    .filter(p => p.categoryId === product.categoryId && p.id !== product.id)
                    .slice(0, 4);
                setRelatedProducts(related);
            });
        }

        return () => {
            isMounted = false;
        };
    }, [isOpen, product, brand]);

    const usageTips = React.useMemo(() => {
        const categoryId = product.categoryId.toLowerCase();
        if (categoryId.includes('perfume') || categoryId === '1') {
            return [
                'Aplica en puntos de pulso (muñecas, cuello).',
                'No frotes la fragancia tras aplicar.',
                'Hidrata tu piel antes para mayor duración.'
            ];
        }
        if (categoryId.includes('maquillaje') || categoryId === '2') {
            return [
                'Prepara tu piel con hidratante.',
                'Usa brochas limpias para mejor acabado.',
                'Sella con polvos o fijador.'
            ];
        }
        if (categoryId.includes('cuerpo') || categoryId === '3') {
            return [
                'Usa después del baño con la piel húmeda.',
                'Masajea en círculos ascendentes.',
                'Enfócate en zonas secas como codos.'
            ];
        }
        return [
            'Sigue las instrucciones del empaque.',
            'Mantén en un lugar fresco y seco.',
            'Suspende si notas irritación.'
        ];
    }, [product.categoryId]);

    const handleDirectCheckout = () => {
        onBuy(product);
        setTimeout(() => {
            setLocation(isNikken ? '/nikken/checkout' : '/checkout');
        }, 500);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showCloseButton={false}
                className="w-[min(1000px,calc(100vw-20px))] sm:max-w-[1000px] max-h-[calc(100dvh-20px)] overflow-hidden rounded-2xl border border-border/60 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl transition-all"
            >
                <div className="sr-only">
                    <DialogTitle>{product.name}</DialogTitle>
                    <DialogDescription>{product.description}</DialogDescription>
                </div>

                <div className="relative max-h-[calc(100dvh-20px)] overflow-y-auto p-4 lg:p-8">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-6 top-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-lg backdrop-blur-sm transition hover:border-primary/25 hover:bg-primary/10 hover:text-primary active:scale-95"
                        aria-label="Cerrar detalle"
                    >
                        <X className="h-6 w-6" />
                    </button>

                    <div className="-mx-4 -mt-4 mb-5 border-b border-border/40 bg-background/90 px-4 py-2.5 pr-20 backdrop-blur-xl lg:-mx-8 lg:-mt-8 lg:px-8">
                        <div className="flex flex-wrap items-center gap-2">
                            {localCatalogState ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-sm">
                                    <BadgeAlert className="h-3.5 w-3.5" />
                                    {localCatalogState}
                                </span>
                            ) : null}
                            <span
                                className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] shadow-sm ${product.inStock
                                    ? 'bg-emerald-100/90 text-emerald-800'
                                    : 'bg-rose-100/90 text-rose-700'
                                    }`}
                            >
                                {availabilityLabel}
                            </span>
                            {deliveryTime ? (
                                <span className="inline-flex rounded-full border border-border/60 bg-background/50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground shadow-sm backdrop-blur-sm">
                                    Tiempo de entrega: {deliveryTime}
                                </span>
                            ) : null}
                            {deliveryNotes.slice(0, 2).map((method, idx) => (
                                <span
                                    key={`${method}-${idx}`}
                                    className="inline-flex rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-primary shadow-sm"
                                >
                                    {method}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
                        <section className="flex-1 min-w-0">
                            <section
                                className="mb-8 rounded-2xl border border-border/40 p-6 shadow-sm"
                                style={{
                                    background: isDark
                                        ? 'linear-gradient(135deg, rgba(17, 24, 39, 0.92), rgba(31, 41, 55, 0.72))'
                                        : 'linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(249, 115, 22, 0.06))',
                                }}
                            >
                                <div className="max-w-3xl">
                                    <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">
                                        {product.brand} {product.subBrand}
                                    </p>
                                    <h1
                                        className="text-2xl font-black leading-tight text-foreground md:text-4xl"
                                        style={{ color: darkColor }}
                                    >
                                        {product.name}
                                    </h1>
                                    <p className="mt-3 max-w-3xl text-[15px] font-medium leading-7 text-foreground/75">
                                        {product.description}
                                    </p>
                                </div>

                                <div className="mt-6 grid gap-6 border-t border-border/40 pt-6 lg:grid-cols-[1fr_0.95fr] lg:divide-x lg:divide-border/40">
                                    <div className="lg:pr-6">
                                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="h-5 w-5" style={{ color: primaryColor }} />
                                                <p className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground/80">
                                                    Beneficios clave
                                                </p>
                                            </div>
                                            <span className="rounded-full border border-primary/10 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-primary/80">
                                                {benefitList.length} razones
                                            </span>
                                        </div>

                                        {visibleBenefits.length > 0 ? (
                                            <div className="flex flex-wrap gap-2.5">
                                                {visibleBenefits.map((benefit, idx) => (
                                                    <span
                                                        key={`${benefit}-${idx}`}
                                                        className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/50 px-3.5 py-2 text-xs font-bold text-foreground/85 shadow-sm"
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                                                        {benefit}
                                                    </span>
                                                ))}
                                                {hiddenBenefitCount > 0 ? (
                                                    <span className="rounded-full bg-muted/50 px-3.5 py-2 text-xs font-bold text-muted-foreground">
                                                        +{hiddenBenefitCount} más
                                                    </span>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <p className="text-sm leading-relaxed text-muted-foreground">
                                                Aún no hay beneficios destacados para este producto.
                                            </p>
                                        )}
                                    </div>

                                    <div className="relative overflow-hidden lg:pl-6">
                                        <div className="pointer-events-none absolute -right-10 -top-10 opacity-5">
                                            <Sparkles className="h-40 w-40" style={{ color: primaryColor }} />
                                        </div>
                                        <div className="relative z-10">
                                            <div className="mb-4 flex items-center gap-2">
                                                <Zap className="h-5 w-5" style={{ color: primaryColor }} />
                                                <p className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground/80">
                                                    Modo de uso y tips
                                                </p>
                                            </div>
                                            <ul className="grid gap-3">
                                                {usageTips.map((tip, idx) => (
                                                    <li key={idx} className="flex gap-3 text-sm leading-relaxed text-foreground/80">
                                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                                            {idx + 1}
                                                        </span>
                                                        {tip}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <div className="mb-10 flex flex-wrap gap-6 justify-center lg:justify-start">
                                <div className="flex flex-col items-center gap-2 text-center group">
                                    <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 transition-transform group-hover:scale-110">
                                        <Leaf className="h-7 w-7" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">100% Vegano</span>
                                </div>
                                <div className="flex flex-col items-center gap-2 text-center group">
                                    <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 transition-transform group-hover:scale-110">
                                        <ShieldCheck className="h-7 w-7" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cruelty Free</span>
                                </div>
                                <div className="flex flex-col items-center gap-2 text-center group">
                                    <div className="h-14 w-14 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 transition-transform group-hover:scale-110">
                                        <Sparkles className="h-7 w-7" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Amazonía Viva</span>
                                </div>
                            </div>

                            {relatedProducts.length > 0 && (
                                <div className="mb-6 rounded-2xl border border-primary/15 bg-primary/5 p-4 shadow-sm">
                                    <h3 className="mb-4 text-lg font-black uppercase tracking-widest text-foreground/90">
                                        Productos relacionados
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        {relatedProducts.map(rp => (
                                            <button
                                                type="button"
                                                key={rp.id}
                                                className="group flex flex-col gap-2 rounded-xl text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                onClick={() => onSelectProduct?.(rp)}
                                                aria-label={`Ver ${rp.name}`}
                                            >
                                                <div className="aspect-square overflow-hidden rounded-xl border border-border/50 bg-white p-2 shadow-sm transition-all group-hover:border-primary/20 group-hover:shadow-md">
                                                    <img 
                                                        src={rp.imageUrl} 
                                                        alt={rp.name} 
                                                        className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-110" 
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src =
                                                                getProductFallbackImage(rp.brand);
                                                        }}
                                                    />
                                                </div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                                                    {rp.subBrand}
                                                </p>
                                                <p className="text-[11px] font-black text-foreground leading-tight line-clamp-2">
                                                    {rp.name}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <SocialSharePanel product={product} primaryColor={primaryColor} />
                        </section>

                        <aside className="flex w-full shrink-0 flex-col gap-6 rounded-2xl border border-border/40 bg-background/50 p-3 shadow-sm backdrop-blur-sm lg:w-[360px]">
                            <div className="group relative aspect-square overflow-hidden rounded-2xl border border-primary/10 bg-white p-4 shadow-lg lg:aspect-auto">
                                <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    className="h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src =
                                            getProductFallbackImage(product.brand);
                                    }}
                                />
                            </div>

                            <div 
                                className="flex flex-col gap-6 rounded-2xl border border-border/40 p-8 shadow-lg"
                                style={{ backgroundColor: accentBgColor }}
                            >
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/70 mb-2">
                                        Precio especial
                                    </p>
                                    <p className="font-mono text-4xl font-black leading-tight tracking-tight tabular-nums" style={{ color: darkColor }}>
                                        ${formatDetailPrice(product.price)}
                                    </p>
                                </div>

                                <div className="grid gap-4">
                                    <Button
                                        onClick={handleDirectCheckout}
                                        className="h-14 rounded-full bg-slate-900 px-8 text-sm font-black uppercase tracking-widest text-white shadow-lg hover:bg-black hover:shadow-xl transition-all active:scale-95"
                                        aria-label={`Comprar ${product.name} ahora`}
                                    >
                                        Comprar ahora
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            onBuy(product);
                                        }}
                                        className="h-14 rounded-full px-8 font-black uppercase tracking-widest shadow-md hover:shadow-lg transition-all active:scale-95"
                                        variant="secondary"
                                        title="Añadir al carrito"
                                        aria-label={`Añadir ${product.name} al carrito`}
                                    >
                                        <ShoppingBag className="mr-3 h-5 w-5" />
                                        Carrito
                                    </Button>
                                    <Button
                                        onClick={onToggleLike}
                                        variant="ghost"
                                        className="h-12 rounded-full px-8 font-bold text-muted-foreground hover:text-red-500 transition-colors mt-2"
                                        aria-label={isLiked ? `Quitar ${product.name} de favoritos` : `Añadir ${product.name} a favoritos`}
                                    >
                                        <Heart className={`mr-2 h-5 w-5 transition-all duration-300 ${isLiked ? 'fill-red-500 text-red-500 scale-110' : ''}`} />
                                        Me encanta
                                    </Button>
                                </div>
                            </div>
                        </aside>
                    </div>

                    <ExportableProduct product={product} type="post" primaryColor={primaryColor} />
                    <ExportableProduct product={product} type="story" primaryColor={primaryColor} />
                </div>

                <div className="sticky bottom-0 z-50 w-full border-t border-border/40 bg-background/80 p-4 backdrop-blur-lg lg:hidden">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">A solo</p>
                            <p className="text-xl font-black text-foreground">${formatDetailPrice(product.price)}</p>
                        </div>
                        <Button
                            onClick={handleDirectCheckout}
                            className="flex-1 h-12 rounded-full bg-slate-900 font-black uppercase tracking-widest text-white shadow-lg active:scale-95 transition-transform"
                            aria-label={`Comprar ${product.name} ahora`}
                        >
                            Comprar ahora
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
