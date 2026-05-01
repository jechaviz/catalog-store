import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, Heart, Loader2, ShoppingBag, Sparkles } from 'lucide-react';
import { Navbar } from '@/components/app/layout/Navbar';
import { Footer } from '@/components/app/layout/Footer';
import { ProductCard } from '@/components/domain/product/ProductCard';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent } from '@/components/shared/ui/card';
import { useBrand } from '@/contexts/BrandContext';
import { useCart } from '@/hooks/useCart';
import { useStorefrontSettings } from '@/hooks/useStorefrontSettings';
import { fetchCatalogData, type CatalogData, type CatalogProduct } from '@/lib/dataFetcher';
import { readBrandLikeIds, toggleBrandLikeId } from '@/lib/storefrontStorage';

const ProductDetail = lazy(() =>
  import('@/components/domain/product/ProductDetail').then((module) => ({
    default: module.ProductDetail,
  }))
);

const CartDrawer = lazy(() =>
  import('@/components/domain/cart/CartDrawer').then((module) => ({
    default: module.CartDrawer,
  }))
);

const ContactFormModal = lazy(() =>
  import('@/components/shared/ui/ContactFormModal').then((module) => ({
    default: module.ContactFormModal,
  }))
);

export default function Favorites() {
  const { brand, isNikken } = useBrand();
  const storefrontSettings = useStorefrontSettings(brand);
  const cart = useCart();
  const [, setLocation] = useLocation();

  const [data, setData] = useState<CatalogData | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [quickBuyProduct, setQuickBuyProduct] = useState<CatalogProduct | null>(null);

  const brandLabel = isNikken ? 'Nikken' : 'Natura';
  const homePath = isNikken ? '/nikken' : '/';
  const accountBasePath = isNikken ? '/nikken/account' : '/account';
  const checkoutPath = isNikken ? '/nikken/checkout' : '/checkout';

  useEffect(() => {
    const syncFavoriteIds = () => {
      setFavoriteIds(readBrandLikeIds(brand));
    };

    syncFavoriteIds();
    window.addEventListener('catalog-likes-changed', syncFavoriteIds);
    window.addEventListener('storage', syncFavoriteIds);

    return () => {
      window.removeEventListener('catalog-likes-changed', syncFavoriteIds);
      window.removeEventListener('storage', syncFavoriteIds);
    };
  }, [brand]);

  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      try {
        setLoading(true);
        setHasLoadError(false);
        const catalogData = await fetchCatalogData(brand);

        if (!isMounted) {
          return;
        }

        setData(catalogData);
        setHasLoadError(!catalogData);
      } catch (error) {
        console.error('Error loading favorites catalog:', error);

        if (!isMounted) {
          return;
        }

        setData(null);
        setHasLoadError(true);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    setSelectedProduct(null);
    loadCatalog();

    return () => {
      isMounted = false;
    };
  }, [brand]);

  const favoriteProducts = useMemo(() => {
    if (!data) {
      return [];
    }

    const productsById = new Map(data.products.map((product) => [product.id, product]));
    return favoriteIds
      .map((id) => productsById.get(id))
      .filter((product): product is CatalogProduct => Boolean(product));
  }, [data, favoriteIds]);

  const missingFavoritesCount = Math.max(favoriteIds.length - favoriteProducts.length, 0);

  const heroCopy = isNikken
    ? 'Guarda tus sistemas y esenciales de bienestar para retomarlos cuando quieras.'
    : 'Reune tus productos y rutinas favoritas para comprar con mas calma cuando te convenga.';

  return (
    <div className={`min-h-screen flex flex-col bg-slate-50 ${isNikken ? 'theme-nikken' : ''}`}>
      <Navbar
        categories={[]}
        activeCategory=""
        onCategorySelect={() => {}}
        onSearchChange={() => {}}
        cartItemCount={cart.itemCount}
        onCartClick={() => cart.setIsDrawerOpen(true)}
        products={[]}
      />

      <main className="flex-1 container max-w-6xl py-12 px-4">
        <section className="mb-10">
          <div className="rounded-[2rem] border border-primary/10 bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
                  <Heart className="h-3.5 w-3.5" />
                  Favoritos {brandLabel}
                </div>
                <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                  Tu lista guardada por marca activa
                </h1>
                <p className="mt-3 text-slate-500 text-base sm:text-lg leading-relaxed">
                  {heroCopy}
                </p>
                <p className="mt-4 text-sm font-medium text-slate-600">
                  Toca el corazon en cualquier tarjeta para quitar productos de esta lista y usa el carrito para cerrar tu compra mas rapido.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 lg:justify-end">
                <Button
                  variant="outline"
                  className="rounded-xl border-slate-200 text-slate-700"
                  onClick={() => cart.setIsDrawerOpen(true)}
                >
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  Ver carrito ({cart.itemCount})
                </Button>
                <Link href={homePath}>
                  <Button className="rounded-xl px-6">
                    Explorar {brandLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="min-h-[40vh] flex flex-col items-center justify-center text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <h2 className="text-xl font-bold text-slate-900">Cargando tus favoritos...</h2>
            <p className="mt-2 text-slate-500">Estamos consultando el catalogo activo de {brandLabel}.</p>
          </div>
        ) : hasLoadError || !data ? (
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-10 sm:p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-6">
                <Heart className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">No pudimos cargar tus favoritos</h2>
              <p className="text-slate-500 mt-3 max-w-2xl mx-auto leading-relaxed">
                Ocurrio un problema al leer el catalogo de {brandLabel}. Puedes volver al inicio e intentarlo de nuevo sin perder tu lista guardada.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href={homePath}>
                  <Button className="rounded-xl px-6">Volver al catalogo</Button>
                </Link>
                <Link href={`${accountBasePath}/orders`}>
                  <Button
                    variant="ghost"
                    className="rounded-xl px-6 text-slate-600 hover:text-slate-900"
                  >
                    Ver pedidos
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : favoriteIds.length === 0 ? (
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-10 sm:p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6">
                <Heart className="h-7 w-7 fill-current" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Aun no tienes favoritos de {brandLabel}</h2>
              <p className="text-slate-500 mt-3 max-w-2xl mx-auto leading-relaxed">
                Cuando marques productos con el corazon en el catalogo de {brandLabel}, apareceran aqui para que los compares, los agregues al carrito o los retomes despues.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href={homePath}>
                  <Button className="rounded-xl px-6">Descubrir productos</Button>
                </Link>
                <Link href={`${accountBasePath}/orders`}>
                  <Button
                    variant="ghost"
                    className="rounded-xl px-6 text-slate-600 hover:text-slate-900"
                  >
                    Ir a mis pedidos
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : favoriteProducts.length === 0 ? (
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-10 sm:p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Tus favoritos ya no estan disponibles</h2>
              <p className="text-slate-500 mt-3 max-w-2xl mx-auto leading-relaxed">
                Tu lista guardada tiene {favoriteIds.length} referencia{favoriteIds.length === 1 ? '' : 's'}, pero ningun producto coincide con el catalogo activo de {brandLabel}. Explora la tienda para guardar nuevos favoritos vigentes.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href={homePath}>
                  <Button className="rounded-xl px-6">Explorar catalogo actual</Button>
                </Link>
                <Link href={`${accountBasePath}/returns`}>
                  <Button
                    variant="ghost"
                    className="rounded-xl px-6 text-slate-600 hover:text-slate-900"
                  >
                    Centro de devoluciones
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {favoriteProducts.length} favorito{favoriteProducts.length === 1 ? '' : 's'} listo{favoriteProducts.length === 1 ? '' : 's'} para comprar
                </h2>
                <p className="mt-2 text-slate-500">
                  Vista filtrada por la marca activa. Puedes abrir el detalle, quitar productos o agregarlos directo al carrito.
                </p>
              </div>
              {missingFavoritesCount > 0 ? (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {missingFavoritesCount} favorito{missingFavoritesCount === 1 ? '' : 's'} no aparece{missingFavoritesCount === 1 ? '' : 'n'} en el catalogo actual de {brandLabel}.
                </div>
              ) : null}
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
              {favoriteProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onViewDetail={setSelectedProduct}
                  onQuickBuy={setQuickBuyProduct}
                  onAddToCart={(currentProduct) => cart.addItem(currentProduct, 1)}
                />
              ))}
            </section>
          </>
        )}
      </main>

      {cart.isDrawerOpen ? (
        <Suspense fallback={null}>
          <CartDrawer
            isOpen={cart.isDrawerOpen}
            onClose={() => cart.setIsDrawerOpen(false)}
            onProceedToCheckout={() => {
              cart.setIsDrawerOpen(false);
              setLocation(checkoutPath);
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
            sellerPhone={storefrontSettings.sellerPhone}
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
            isLiked={readBrandLikeIds(brand).includes(selectedProduct.id)}
            onToggleLike={() => {
              toggleBrandLikeId(brand, selectedProduct.id);
              setSelectedProduct({ ...selectedProduct });
            }}
          />
        </Suspense>
      ) : null}

      <Footer />
    </div>
  );
}
