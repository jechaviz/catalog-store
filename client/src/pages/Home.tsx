import { Suspense, lazy, useEffect, useState } from 'react';
import { fetchCatalogData, type CatalogData, type CatalogProduct } from '@/lib/dataFetcher';
import { Navbar } from '@/components/app/layout/Navbar';
import { ProductCard } from '@/components/domain/product/ProductCard';
import { ThemeSelector } from '@/components/shared/ui/ThemeSelector';
import { LazyCatalogPdfGenerator } from '@/components/domain/catalog/LazyCatalogPdfGenerator';
import { Footer } from '@/components/app/layout/Footer';
import { useCart } from '@/hooks/useCart';
import { useStorefrontSettings } from '@/hooks/useStorefrontSettings';
import { useTheme } from '@/hooks/useTheme';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { useLocation } from 'wouter';
import {
  applyLocalCatalogOverrides,
  isLocalCatalogStorageKeyForBrand,
  readLocalCatalogOverrides,
} from '@/lib/adminCatalogStorage';
import {
  isLikesStorageKeyForBrand,
  readBrandLikeIds,
  toggleBrandLikeId,
} from '@/lib/storefrontStorage';

const ProductDetail = lazy(() =>
  import('@/components/domain/product/ProductDetail').then((module) => ({
    default: module.ProductDetail,
  })),
);

const CartDrawer = lazy(() =>
  import('@/components/domain/cart/CartDrawer').then((module) => ({
    default: module.CartDrawer,
  })),
);

const ContactFormModal = lazy(() =>
  import('@/components/shared/ui/ContactFormModal').then((module) => ({
    default: module.ContactFormModal,
  })),
);

export default function Home() {
  const [data, setData] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLocalCatalogOverrides, setHasLocalCatalogOverrides] = useState(false);
  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [, setLocation] = useLocation();

  const { user } = useAuth();
  const { theme } = useTheme();
  const { brand, isNikken } = useBrand();
  const storefrontSettings = useStorefrontSettings(brand);
  const cart = useCart();
  const userId = user?.id ?? null;
  const activeProfileLabel = user?.name?.trim() || user?.email || 'tu perfil activo';
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [hasHeroImageError, setHasHeroImageError] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [quickBuyProduct, setQuickBuyProduct] = useState<CatalogProduct | null>(null);

  useEffect(() => {
    let isMounted = true;

    const syncLocalCatalogState = () => {
      try {
        const overrides = readLocalCatalogOverrides(brand);
        setHasLocalCatalogOverrides(
          overrides.products.length > 0 || overrides.deletedProductIds.length > 0,
        );
      } catch {
        setHasLocalCatalogOverrides(false);
      }
    };

    const loadData = async () => {
      try {
        setLoading(true);
        const catalogInfo = await fetchCatalogData(brand);

        if (!isMounted) {
          return;
        }

        const overrides = readLocalCatalogOverrides(brand);
        const nextCatalogInfo = catalogInfo
          ? {
              ...catalogInfo,
              products: applyLocalCatalogOverrides(catalogInfo.products, overrides),
            }
          : null;

        setData(nextCatalogInfo);
        setHasLocalCatalogOverrides(
          overrides.products.length > 0 || overrides.deletedProductIds.length > 0,
        );

        if (!nextCatalogInfo) {
          setSelectedProduct(null);
          setQuickBuyProduct(null);
          return;
        }

        const productsById = new Map(
          nextCatalogInfo.products.map((product) => [product.id, product]),
        );
        setSelectedProduct((currentProduct) =>
          currentProduct ? productsById.get(currentProduct.id) ?? null : null,
        );
        setQuickBuyProduct((currentProduct) =>
          currentProduct ? productsById.get(currentProduct.id) ?? null : null,
        );
      } catch (error) {
        console.error('Error loading storefront data:', error);

        if (!isMounted) {
          return;
        }

        syncLocalCatalogState();
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const handleLocalProductsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ brand?: string; storageKey?: string }>).detail;

      if (detail?.brand === brand || isLocalCatalogStorageKeyForBrand(detail?.storageKey, brand)) {
        void loadData();
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (isLocalCatalogStorageKeyForBrand(event.key, brand)) {
        void loadData();
      }
    };

    void loadData();
    window.addEventListener(
      'catalog-local-products-changed',
      handleLocalProductsChanged as EventListener,
    );
    window.addEventListener('storage', handleStorageChange);

    return () => {
      isMounted = false;
      window.removeEventListener(
        'catalog-local-products-changed',
        handleLocalProductsChanged as EventListener,
      );
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [brand]);

  useEffect(() => {
    setActiveCategory('');
  }, [brand]);

  useEffect(() => {
    setHasHeroImageError(false);
  }, [brand, storefrontSettings.heroImageUrl]);

  useEffect(() => {
    const syncFavoriteCount = () => {
      try {
        setFavoriteCount(readBrandLikeIds(brand, userId).length);
      } catch {
        setFavoriteCount(0);
      }
    };

    const handleLikesChanged = (event: Event) => {
      const storageKey = (event as CustomEvent<{ storageKey?: string }>).detail?.storageKey;

      if (!storageKey || isLikesStorageKeyForBrand(storageKey, brand)) {
        syncFavoriteCount();
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (!event.key || isLikesStorageKeyForBrand(event.key, brand)) {
        syncFavoriteCount();
      }
    };

    syncFavoriteCount();
    window.addEventListener('catalog-likes-changed', handleLikesChanged as EventListener);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('catalog-likes-changed', handleLikesChanged as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [brand, userId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background/50">
        <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
        <h2 className="heading animate-pulse text-xl font-bold text-primary">
          Cargando catalogo...
        </h2>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background/50 p-6 text-center">
        <h2 className="heading mb-4 text-3xl font-bold text-red-500">Ups! Algo salio mal</h2>
        <p className="body max-w-md text-muted-foreground">
          No pudimos conectar con el servidor de Odoo y los datos de respaldo no estan
          disponibles. Por favor, revisa la configuracion en tu archivo .env.
        </p>
      </div>
    );
  }

  const filteredProducts = data.products.filter((product) => {
    const matchesCategory = activeCategory === '' || product.categoryId === activeCategory;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      product.name.toLowerCase().includes(searchLower) ||
      product.brand.toLowerCase().includes(searchLower) ||
      product.subBrand.toLowerCase().includes(searchLower) ||
      product.description.toLowerCase().includes(searchLower);

    const matchesTheme =
      isNikken || searchQuery !== '' || product.gender === theme || product.gender === 'unisex';

    return matchesCategory && matchesSearch && matchesTheme;
  });

  const heroEyebrow = storefrontSettings.heroEyebrow.trim();
  const heroTitle = storefrontSettings.siteName.trim();
  const heroSlogan = storefrontSettings.slogan.trim();
  const heroDescription = storefrontSettings.heroDescription.trim();
  const heroImageUrl = storefrontSettings.heroImageUrl.trim();
  const shouldShowHeroImage = Boolean(heroImageUrl) && !hasHeroImageError;

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20 transition-colors duration-500">
      <Navbar
        categories={data.categories}
        activeCategory={activeCategory}
        onCategorySelect={setActiveCategory}
        onSearchChange={setSearchQuery}
        cartItemCount={cart.itemCount}
        onCartClick={() => cart.setIsDrawerOpen(true)}
        products={data.products}
      />

      <main className="container relative mx-auto min-h-[80vh] px-4 py-8 md:py-12">
        {!searchQuery && !activeCategory ? (
          <div className="mx-auto mb-12 max-w-6xl md:mb-16">
            <div className="grid gap-8 overflow-hidden rounded-[2.5rem] border border-primary/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),rgba(255,255,255,0.82)_45%,rgba(249,115,22,0.08)_100%)] p-6 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)] transition-colors duration-500 md:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] md:p-10 lg:p-12">
              <div className="flex flex-col justify-center">
                <div className="mb-6 flex flex-wrap items-center gap-3">
                  <div className="rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary transition-colors duration-500">
                    {heroEyebrow || (isNikken ? 'Tecnologia Japonesa' : 'Coleccion 2026')}
                  </div>
                  {!isNikken ? <ThemeSelector /> : null}
                  {data.products ? <LazyCatalogPdfGenerator products={data.products} /> : null}
                </div>

                <h2 className="display text-4xl font-black leading-tight text-foreground transition-colors duration-500 md:text-5xl lg:text-6xl">
                  {heroTitle}
                </h2>
                <p className="mt-4 max-w-2xl text-lg font-semibold uppercase tracking-[0.2em] text-primary/80 transition-colors duration-500">
                  {heroSlogan}
                </p>
                <p className="body mt-5 max-w-2xl text-lg leading-8 text-muted-foreground transition-colors duration-500">
                  {heroDescription}
                </p>

                <div className="mt-8 inline-flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl border border-primary/10 bg-background/80 px-4 py-3 text-sm text-muted-foreground shadow-sm transition-colors duration-500">
                  <span className="font-semibold text-foreground/90">{activeProfileLabel}</span>
                  <span className="hidden text-primary/50 sm:inline">|</span>
                  <span>
                    {favoriteCount} favorito{favoriteCount !== 1 ? 's' : ''} guardado
                    {favoriteCount !== 1 ? 's' : ''} en {heroTitle}
                  </span>
                  <span className="hidden text-primary/50 md:inline">|</span>
                  <span className="hidden md:inline">
                    Tus likes y guardados se aplican a este perfil activo.
                  </span>
                  {hasLocalCatalogOverrides ? (
                    <>
                      <span className="hidden text-primary/50 md:inline">|</span>
                      <span className="text-primary/80">Incluye ajustes locales del catalogo.</span>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="relative flex min-h-[260px] items-center justify-center">
                <div className="absolute inset-8 rounded-[2rem] bg-gradient-to-br from-primary/15 via-transparent to-secondary/20 blur-2xl" />
                <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-[2rem] border border-white/60 bg-white/85 p-4 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-primary/70">
                        {heroEyebrow || heroTitle}
                      </p>
                      <p className="mt-2 text-lg font-bold text-slate-900">{heroTitle}</p>
                    </div>
                    <div className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                      {isNikken ? 'Wellness' : 'Catalogo'}
                    </div>
                  </div>

                  {shouldShowHeroImage ? (
                    <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary/5 via-white to-secondary/10">
                      <img
                        src={heroImageUrl}
                        alt={heroTitle}
                        className="h-[280px] w-full object-cover md:h-[360px]"
                        onError={() => setHasHeroImageError(true)}
                      />
                    </div>
                  ) : (
                    <div className="flex h-[280px] flex-col justify-end rounded-[1.75rem] bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.16),transparent_35%),linear-gradient(160deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9),rgba(241,245,249,0.86))] p-6 md:h-[360px]">
                      <div className="max-w-xs rounded-[1.5rem] border border-primary/10 bg-white/80 p-5 shadow-sm backdrop-blur">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary/70">
                          Seleccion activa
                        </p>
                        <p className="mt-3 text-2xl font-black text-slate-900">{heroTitle}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {heroDescription}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h3 className="heading border-l-4 border-primary pl-4 text-2xl font-bold text-foreground/90 transition-colors duration-500">
              {activeCategory
                ? data.categories.find((category) => category.id === activeCategory)?.name
                : searchQuery
                  ? `Resultados para "${searchQuery}"`
                  : 'Productos Para Ti'}
            </h3>
            <p className="ml-4 mt-2 text-sm font-semibold text-muted-foreground">
              {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''}{' '}
              encontrado{filteredProducts.length !== 1 ? 's' : ''}
            </p>
            <p className="ml-4 mt-1 text-xs text-muted-foreground/90">
              Perfil activo:{' '}
              <span className="font-semibold text-foreground/80">{activeProfileLabel}</span>
            </p>
            {hasLocalCatalogOverrides ? (
              <p className="ml-4 mt-1 text-xs text-primary/80">
                Vista actualizada con productos personalizados o cambios locales.
              </p>
            ) : null}
          </div>

          {!isNikken && (searchQuery || activeCategory) ? (
            <div className="hidden sm:block">
              <ThemeSelector />
            </div>
          ) : null}
        </div>

        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onViewDetail={setSelectedProduct}
                onQuickBuy={setQuickBuyProduct}
                onAddToCart={(currentProduct) => cart.addItem(currentProduct, 1)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 transition-colors duration-500">
              <span className="text-4xl">?</span>
            </div>
            <h3 className="heading mb-2 text-2xl font-bold text-foreground transition-colors duration-500">
              No encontramos lo que buscas
            </h3>
            <p className="body max-w-md text-muted-foreground transition-colors duration-500">
              {isNikken
                ? 'Intenta con un termino diferente o explora nuestras categorias de bienestar.'
                : 'Intenta con un termino diferente o ajusta tus preferencias de genero en el menu.'}
            </p>
          </div>
        )}
      </main>

      {cart.isDrawerOpen ? (
        <Suspense fallback={null}>
          <CartDrawer
            isOpen={cart.isDrawerOpen}
            onClose={() => cart.setIsDrawerOpen(false)}
            onProceedToCheckout={() => {
              cart.setIsDrawerOpen(false);
              setLocation(isNikken ? '/nikken/checkout' : '/checkout');
            }}
          />
        </Suspense>
      ) : null}

      {selectedProduct ? (
        <Suspense fallback={null}>
          <ProductDetail
            product={selectedProduct}
            isOpen={!!selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onBuy={(product) => {
              cart.addItem(product, 1);
              setSelectedProduct(null);
            }}
            isLiked={readBrandLikeIds(brand, userId).includes(selectedProduct.id)}
            onToggleLike={() => {
              toggleBrandLikeId(brand, selectedProduct.id, userId);
              setSelectedProduct({ ...selectedProduct });
            }}
          />
        </Suspense>
      ) : null}

      {quickBuyProduct ? (
        <Suspense fallback={null}>
          <ContactFormModal
            product={quickBuyProduct}
            isOpen={!!quickBuyProduct}
            onClose={() => setQuickBuyProduct(null)}
          />
        </Suspense>
      ) : null}

      <Footer />
    </div>
  );
}
