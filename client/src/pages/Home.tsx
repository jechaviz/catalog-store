import { Suspense, lazy, useEffect, useState } from 'react';
import { fetchCatalogData, type CatalogData, type CatalogProduct } from '@/lib/dataFetcher';
import { Navbar } from '@/components/app/layout/Navbar';
import { ProductCard } from '@/components/domain/product/ProductCard';
import { ThemeSelector } from '@/components/shared/ui/ThemeSelector';
import { LazyCatalogPdfGenerator } from '@/components/domain/catalog/LazyCatalogPdfGenerator';
import { Footer } from '@/components/app/layout/Footer';
import { useCart } from '@/hooks/useCart';
import { useTheme } from '@/hooks/useTheme';
import { Loader2 } from 'lucide-react';
import { useBrand } from '@/contexts/BrandContext';
import { useLocation } from 'wouter';
import {
  readBrandLikeIds,
  toggleBrandLikeId,
} from '@/lib/storefrontStorage';

const ProductDetail = lazy(() =>
  import('@/components/domain/product/ProductDetail').then(module => ({
    default: module.ProductDetail,
  }))
);

const CartDrawer = lazy(() =>
  import('@/components/domain/cart/CartDrawer').then(module => ({
    default: module.CartDrawer,
  }))
);

const ContactFormModal = lazy(() =>
  import('@/components/shared/ui/ContactFormModal').then(module => ({
    default: module.ContactFormModal,
  }))
);

export default function Home() {
  const [data, setData] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [, setLocation] = useLocation();

  // Custom Hooks
  const { theme } = useTheme();
  const { brand, isNikken } = useBrand();
  const cart = useCart();

  // Modal State
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [quickBuyProduct, setQuickBuyProduct] = useState<CatalogProduct | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const catalogInfo = await fetchCatalogData(brand);
        setData(catalogInfo);
        // Reset category when brand changes
        setActiveCategory('');
      } catch (error) {
        console.error("Error loading storefront data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [brand]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background/50">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <h2 className="heading text-xl font-bold text-primary animate-pulse">Cargando catálogo...</h2>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background/50 p-6 text-center">
        <h2 className="heading text-3xl font-bold text-red-500 mb-4">¡Ups! Algo salió mal</h2>
        <p className="body text-muted-foreground max-w-md">No pudimos conectar con el servidor de Odoo y los datos de respaldo no están disponibles. Por favor, revisa la configuración en tu archivo .env.</p>
      </div>
    );
  }

  // Filter products based on category, search, and theme
  const filteredProducts = data.products.filter(product => {
    const matchesCategory = activeCategory === '' || product.categoryId === activeCategory;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = searchQuery === '' ||
      product.name.toLowerCase().includes(searchLower) ||
      product.brand.toLowerCase().includes(searchLower) ||
      product.subBrand.toLowerCase().includes(searchLower) ||
      product.description.toLowerCase().includes(searchLower);

    // Theme filtering: Show products matching the theme OR unisex. If no search is active, we strongly filter.
    // If user is searching, let them find anything.
    // For Nikken, we show all products regardless of theme.
    const matchesTheme = isNikken || searchQuery !== '' || product.gender === theme || product.gender === 'unisex';

    return matchesCategory && matchesSearch && matchesTheme;

  });

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

      <main className="container mx-auto px-4 py-8 md:py-12 relative min-h-[80vh]">

        {/* Page Header / Hero Area (Optional, hidden when searching) */}
        {!searchQuery && !activeCategory && (
          <div className="mb-12 md:mb-16 text-center max-w-3xl mx-auto px-4">
            <div className="inline-flex flex-col sm:flex-row items-center gap-4 mb-6">
              <div className="px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-xs uppercase tracking-widest transition-colors duration-500">
                {isNikken ? 'Tecnología Japonesa' : 'Colección 2026'}
              </div>
              {!isNikken && <ThemeSelector />}
              {data?.products && <LazyCatalogPdfGenerator products={data.products} />}
            </div>
            <h2 className="display text-4xl md:text-5xl lg:text-6xl font-black text-foreground mb-6 leading-tight transition-colors duration-500">
              {isNikken ? (
                <>
                  Transforma tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary transition-colors duration-500">Entorno</span>
                </>
              ) : (
                <>
                  Descubre tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary transition-colors duration-500">Bienestar</span>
                </>
              )}
            </h2>
            <p className="body text-lg text-muted-foreground transition-colors duration-500">
              {isNikken 
                ? 'Líder mundial en bienestar y salud. Descubre cómo el agua, el aire, el descanso y la nutrición pueden cambiar tu vida con tecnología magnética avanzada.' 
                : 'Explora la línea completa de Natura. Cosméticos y fragancias inspirados en la riqueza de la biodiversidad, creados para cuidar de ti y del planeta.'}
            </p>
          </div>
        )}

        {/* Categories Title */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h3 className="heading text-2xl font-bold border-l-4 border-primary pl-4 text-foreground/90 transition-colors duration-500">
              {activeCategory
                ? data.categories.find(c => c.id === activeCategory)?.name
                : searchQuery
                  ? `Resultados para "${searchQuery}"`
                  : 'Productos Para Ti'}
            </h3>
            <p className="text-sm text-muted-foreground mt-2 ml-4 font-semibold">{filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}</p>
          </div>

          {!isNikken && (searchQuery || activeCategory) && (
            <div className="hidden sm:block">
              <ThemeSelector />
            </div>
          )}

        </div>

        {/* Product Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {filteredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onViewDetail={setSelectedProduct}
                onQuickBuy={setQuickBuyProduct}
                onAddToCart={(p) => cart.addItem(p, 1)}
              />
            ))}
          </div>
        ) : (
          <div className="py-20 flex flex-col items-center justify-center text-center px-4">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 transition-colors duration-500">
              <span className="text-4xl">🍃</span>
            </div>
            <h3 className="heading text-2xl font-bold text-foreground mb-2 transition-colors duration-500">No encontramos lo que buscas</h3>
            <p className="body text-muted-foreground max-w-md transition-colors duration-500">
              {isNikken 
                ? 'Intenta con un término diferente o explora nuestras categorías de bienestar.' 
                : 'Intenta con un término diferente o ajusta tus preferencias de género en el menú.'}
            </p>

          </div>
        )}
      </main>

      {/* Slide-Out Shopping Cart */}
      {cart.isDrawerOpen && (
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
      )}

      {/* Immersive Product Detail Modal */}
      {selectedProduct && (
        <Suspense fallback={null}>
          <ProductDetail
            product={selectedProduct}
            isOpen={!!selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onBuy={(product) => {
              cart.addItem(product, 1);
              setSelectedProduct(null); // Close the detail view to show cart
            }}
            isLiked={selectedProduct ? readBrandLikeIds(brand).includes(selectedProduct.id) : false}
            onToggleLike={() => {
              if (selectedProduct) {
                toggleBrandLikeId(brand, selectedProduct.id);
                // Force re-render of detail view
                setSelectedProduct({ ...selectedProduct });
              }
            }}
          />
        </Suspense>
      )}

      {/* Quick Buy Modal (Contact Form) */}
      {quickBuyProduct && (
        <Suspense fallback={null}>
          <ContactFormModal
            product={quickBuyProduct}
            isOpen={!!quickBuyProduct}
            onClose={() => setQuickBuyProduct(null)}
          />
        </Suspense>
      )}

      <Footer />
    </div>
  );
}
