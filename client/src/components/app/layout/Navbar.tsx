import { Search, Heart, ShoppingBag, User } from 'lucide-react';
import { Input } from '@/components/shared/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { CatalogPdfGenerator } from '@/components/domain/catalog/CatalogPdfGenerator';
import type { Category, CatalogProduct } from '@/lib/dataFetcher';

interface NavbarProps {
    categories: Category[];
    activeCategory: string;
    onCategorySelect: (id: string) => void;
    onSearchChange: (query: string) => void;
    cartItemCount: number;
    onCartClick: () => void;
    products: CatalogProduct[];
}

export function Navbar({ categories, activeCategory, onCategorySelect, onSearchChange, cartItemCount, onCartClick, products }: NavbarProps) {
    const { user, loginWithGoogle } = useAuth();
    const [, setLocation] = useLocation();

    return (
        <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-primary/10 shadow-sm">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
                {/* Logo / Brand Name */}
                <div className="flex items-center flex-shrink-0 cursor-pointer" onClick={() => onCategorySelect('')}>
                    <h1 className="display text-2xl md:text-3xl font-bold text-primary tracking-tight">
                        Natura <span className="text-secondary">Catálogo</span>
                    </h1>
                </div>

                {/* Global Search Bar */}
                <div className="flex-1 max-w-md hidden md:flex relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder="Buscar perfumes, cremas, maquillaje..."
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-9 rounded-full bg-secondary/10 border-transparent focus-visible:ring-primary/20 focus-visible:bg-white transition-all text-sm body"
                    />
                </div>

                {/* Action Icons */}
                <div className="flex items-center gap-3 md:gap-4 shrink-0">
                    <CatalogPdfGenerator products={products} />
                    <button className="md:hidden p-2 text-foreground/80 hover:text-primary rounded-full hover:bg-primary/10 transition-colors">
                        <Search className="w-5 h-5" />
                    </button>
                    {user ? (
                        <button onClick={() => setLocation('/profile')} className="p-2 text-foreground/80 hover:text-primary rounded-full hover:bg-primary/10 transition-colors relative" title="Mi Perfil">
                            <div className="w-6 h-6 rounded-full overflow-hidden border border-primary/30">
                                {user.avatar ? (
                                    <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-full h-full p-1 bg-secondary/10 text-primary" />
                                )}
                            </div>
                        </button>
                    ) : (
                        <button onClick={loginWithGoogle} className="p-2 text-foreground/80 hover:text-primary rounded-full hover:bg-primary/10 transition-colors relative" title="Iniciar Sesión">
                            <User className="w-5 h-5" />
                        </button>
                    )}
                    <button className="p-2 text-foreground/80 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors relative" title="Mis Favoritos">
                        <Heart className="w-5 h-5" />
                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                    </button>
                    <button
                        onClick={onCartClick}
                        className="p-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-transform hover:scale-105 shadow-md flex items-center justify-center relative"
                        title="Mi Pedido"
                    >
                        <ShoppingBag className="w-5 h-5" />
                        {cartItemCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white shadow-sm">
                                {cartItemCount > 9 ? '9+' : cartItemCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Category Navigation (Horizontal scrollable on mobile) */}
            <nav className="border-t border-primary/5 bg-white/50">
                <div className="container mx-auto px-4 overflow-x-auto custom-scrollbar flex items-center py-2 md:py-3 gap-2 md:gap-6">
                    <button
                        onClick={() => onCategorySelect('')}
                        className={`whitespace-nowrap heading text-sm md:text-base font-bold transition-colors py-1 px-3 md:px-0 rounded-full md:rounded-none md:border-b-2 ${activeCategory === ''
                            ? 'bg-primary text-white md:bg-transparent md:text-primary md:border-primary'
                            : 'text-foreground/70 hover:text-primary md:border-transparent md:hover:border-primary/50'
                            }`}
                    >
                        Todos
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => onCategorySelect(cat.id)}
                            className={`whitespace-nowrap heading text-sm md:text-base font-bold transition-colors py-1 px-3 md:px-0 rounded-full md:rounded-none md:border-b-2 ${activeCategory === cat.id
                                ? 'bg-primary text-white md:bg-transparent md:text-primary md:border-primary'
                                : 'text-foreground/70 hover:text-primary md:border-transparent md:hover:border-primary/50'
                                }`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </nav>
            {/* Mobile Search Bar Expandable (Future Proofing) */}
            <div className="container mx-auto px-4 pb-3 md:hidden">
                <Input
                    placeholder="Buscar perfumes, cremas, maquillaje..."
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full rounded-2xl bg-secondary/10 border-transparent focus-visible:ring-primary/20 text-sm body"
                />
            </div>
        </header>
    );
}
