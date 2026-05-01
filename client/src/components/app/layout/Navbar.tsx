import { useEffect, useState } from 'react';
import { Search, Heart, ShoppingBag, LogOut, Settings, Package, LayoutDashboard, User as UserIcon } from 'lucide-react';
import { Input } from '@/components/shared/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { LazyCatalogPdfGenerator } from '@/components/domain/catalog/LazyCatalogPdfGenerator';
import type { Category, CatalogProduct } from '@/lib/dataFetcher';
import { useBrand } from '@/contexts/BrandContext';
import { getLegacyLikesStorageKey, getLikesStorageKey, readBrandLikeIds } from '@/lib/storefrontStorage';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/shared/ui/dropdown-menu";

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
    const { user, loginWithGoogle, logout } = useAuth();
    const { brand, isNikken } = useBrand();
    const [, setLocation] = useLocation();
    const [favoriteCount, setFavoriteCount] = useState(0);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(true);
    const homePath = isNikken ? '/nikken' : '/';
    const favoritesPath = isNikken ? '/nikken/account/favorites' : '/account/favorites';
    const mobileSearchInputId = `${brand}-navbar-mobile-search`;
    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        const syncFavoriteCount = () => {
            try {
                setFavoriteCount(readBrandLikeIds(brand).length);
            } catch {
                setFavoriteCount(0);
            }
        };

        const handleLikesChanged = (event: Event) => {
            const storageKey = (event as CustomEvent<{ storageKey?: string }>).detail?.storageKey;
            const scopedStorageKey = getLikesStorageKey(brand);
            const legacyStorageKey = brand === 'natura' ? getLegacyLikesStorageKey() : null;

            if (!storageKey || storageKey === scopedStorageKey || storageKey === legacyStorageKey) {
                syncFavoriteCount();
            }
        };

        const handleStorageChange = (event: StorageEvent) => {
            const scopedStorageKey = getLikesStorageKey(brand);
            const legacyStorageKey = brand === 'natura' ? getLegacyLikesStorageKey() : null;

            if (!event.key || event.key === scopedStorageKey || event.key === legacyStorageKey) {
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
    }, [brand]);

    const handleLogout = () => {
        logout();
        onCategorySelect('');
        onSearchChange('');
        setLocation(homePath);
    };

    const handleMobileSearchToggle = () => {
        setIsMobileSearchOpen((current) => {
            const next = !current;

            if (next) {
                window.setTimeout(() => {
                    const input = document.getElementById(mobileSearchInputId);

                    if (input instanceof HTMLInputElement) {
                        input.focus();
                    }
                }, 0);
            }

            return next;
        });
    };

    return (
        <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-primary/10 shadow-sm">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
                {/* Logo / Brand Name */}
                <div className="flex items-center flex-shrink-0 cursor-pointer" onClick={() => { setLocation(homePath); onCategorySelect(''); }}>
                    <h1 className="display text-2xl md:text-3xl font-bold text-primary tracking-tight">
                        {isNikken ? (
                            <div className="flex flex-col">
                                <span className="text-2xl font-black text-primary leading-none">Nikken</span>
                                <span className="text-secondary text-[10px] uppercase tracking-[0.15em] font-bold mt-1">Distribuidor Independiente</span>
                            </div>
                        ) : (
                            <>
                                Natura <span className="text-secondary">Catálogo</span>
                            </>
                        )}
                    </h1>
                </div>

                {/* Global Search Bar */}
                <div className="flex-1 max-w-md hidden md:flex relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder={isNikken ? "Buscar agua, descanso, nutrición..." : "Buscar perfumes, cremas, maquillaje..."}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-9 rounded-full bg-secondary/10 border-transparent focus-visible:ring-primary/20 focus-visible:bg-white transition-all text-sm body"
                    />
                </div>

                {/* Desktop Navigation Links */}
                {isNikken && (
                    <nav className="hidden lg:flex items-center gap-6 ml-8 mr-auto">
                        {isAdmin && (
                            <button onClick={() => setLocation('/nikken/admin')} className="text-sm font-bold text-slate-500 hover:text-primary transition-colors uppercase tracking-wider">Admin</button>
                        )}
                        <button onClick={() => setLocation('/nikken/account/orders')} className="text-sm font-bold text-slate-500 hover:text-primary transition-colors uppercase tracking-wider">Mis Pedidos</button>
                    </nav>
                )}

                {/* Action Icons */}
                <div className="flex items-center gap-3 md:gap-4 shrink-0">
                    {products.length > 0 && <LazyCatalogPdfGenerator products={products} />}
                    <button
                        onClick={handleMobileSearchToggle}
                        className="md:hidden p-2 text-foreground/80 hover:text-primary rounded-full hover:bg-primary/10 transition-colors"
                        title={isMobileSearchOpen ? 'Ocultar busqueda' : 'Mostrar busqueda'}
                        aria-label={isMobileSearchOpen ? 'Ocultar busqueda' : 'Mostrar busqueda'}
                        aria-expanded={isMobileSearchOpen}
                        aria-controls={mobileSearchInputId}
                    >
                        <Search className="w-5 h-5" />
                    </button>
                    {user ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="p-2 text-foreground/80 hover:text-primary rounded-full hover:bg-primary/10 transition-colors relative" title="Mi Cuenta">
                                    <div className="w-6 h-6 rounded-full overflow-hidden border border-primary/30">
                                        {user.avatar ? (
                                            <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <UserIcon className="w-full h-full p-1 bg-secondary/10 text-primary" />
                                        )}
                                    </div>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl border-primary/5">
                                <DropdownMenuLabel className="px-3 py-2">
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Mi Cuenta</p>
                                    <p className="text-sm font-bold truncate mt-0.5">{user.name || user.email}</p>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-primary/5" />
                                <DropdownMenuItem onClick={() => setLocation(isNikken ? '/nikken/profile' : '/profile')} className="rounded-xl mt-1 gap-3 px-3 py-2 cursor-pointer focus:bg-primary/5">
                                    <UserIcon className="w-4 h-4 text-primary" />
                                    <span className="font-semibold text-slate-700">Mi Perfil</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setLocation(isNikken ? '/nikken/account/orders' : '/account/orders')} className="rounded-xl gap-3 px-3 py-2 cursor-pointer focus:bg-primary/5">
                                    <Package className="w-4 h-4 text-primary" />
                                    <span className="font-semibold text-slate-700">Mis Pedidos</span>
                                </DropdownMenuItem>
                                {isAdmin && (
                                    <>
                                        <DropdownMenuSeparator className="bg-primary/5" />
                                        <DropdownMenuItem onClick={() => setLocation(isNikken ? '/nikken/admin' : '/admin')} className="rounded-xl gap-3 px-3 py-2 cursor-pointer focus:bg-primary/5">
                                            <LayoutDashboard className="w-4 h-4 text-primary" />
                                            <span className="font-semibold text-slate-700">Admin Panel</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setLocation(isNikken ? '/nikken/admin/settings' : '/admin/settings')} className="rounded-xl gap-3 px-3 py-2 cursor-pointer focus:bg-primary/5">
                                            <Settings className="w-4 h-4 text-primary" />
                                            <span className="font-semibold text-slate-700">Configuración</span>
                                        </DropdownMenuItem>
                                    </>
                                )}
                                <DropdownMenuSeparator className="bg-primary/5" />
                                <DropdownMenuItem onClick={handleLogout} className="rounded-xl gap-3 px-3 py-2 text-rose-600 focus:bg-rose-50 cursor-pointer">
                                    <LogOut className="w-4 h-4" />
                                    <span className="font-bold">Cerrar Sesión</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <button onClick={loginWithGoogle} className="p-2 text-foreground/80 hover:text-primary rounded-full hover:bg-primary/10 transition-colors relative" title="Iniciar Sesión">
                            <UserIcon className="w-5 h-5" />
                        </button>
                    )}

                    <button
                        onClick={() => setLocation(favoritesPath)}
                        className="p-2 text-foreground/80 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors relative"
                        title="Mis Favoritos"
                    >
                        <Heart className="w-5 h-5" />
                        {favoriteCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center border border-white shadow-sm">
                                {favoriteCount > 99 ? '99+' : favoriteCount}
                            </span>
                        )}
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

            {/* Mobile Search Bar Expandable */}
            <div
                className={`container mx-auto px-4 md:hidden overflow-hidden transition-all duration-200 ${isMobileSearchOpen ? 'max-h-24 pb-3 opacity-100' : 'max-h-0 pb-0 opacity-0 pointer-events-none'}`}
            >
                <Input
                    id={mobileSearchInputId}
                    placeholder={isNikken ? "Buscar agua, descanso, nutrición..." : "Buscar perfumes, cremas, maquillaje..."}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full rounded-2xl bg-secondary/10 border-transparent focus-visible:ring-primary/20 text-sm body"
                />
            </div>
        </header>
    );
}
