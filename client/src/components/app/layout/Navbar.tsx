import { useEffect, useState } from 'react';
import {
  Heart,
  LayoutDashboard,
  LogOut,
  Package,
  Repeat,
  Search,
  Settings,
  ShoppingBag,
  User as UserIcon,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { LazyCatalogPdfGenerator } from '@/components/domain/catalog/LazyCatalogPdfGenerator';
import { Input } from '@/components/shared/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { useStorefrontSettings } from '@/hooks/useStorefrontSettings';
import type { Category, CatalogProduct } from '@/lib/dataFetcher';
import {
  isLikesStorageKeyForBrand,
  readBrandLikeIds,
} from '@/lib/storefrontStorage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/shared/ui/dropdown-menu';

interface NavbarProps {
  categories: Category[];
  activeCategory: string;
  onCategorySelect: (id: string) => void;
  onSearchChange: (query: string) => void;
  cartItemCount: number;
  onCartClick: () => void;
  products: CatalogProduct[];
}

export function Navbar({
  categories,
  activeCategory,
  onCategorySelect,
  onSearchChange,
  cartItemCount,
  onCartClick,
  products,
}: NavbarProps) {
  const { user, loginWithGoogle, logout, mockProfiles, switchMockProfile } = useAuth();
  const { brand, isNikken } = useBrand();
  const settings = useStorefrontSettings(brand);
  const [, setLocation] = useLocation();
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(true);
  const homePath = isNikken ? '/nikken' : '/';
  const favoritesPath = isNikken ? '/nikken/account/favorites' : '/account/favorites';
  const mobileSearchInputId = `${brand}-navbar-mobile-search`;
  const isAdmin = user?.role === 'admin';
  const userId = user?.id ?? null;
  const profileName = user?.name || user?.email || 'Mi cuenta';
  const profileInitial = profileName.trim().charAt(0).toUpperCase() || '?';
  const profileRoleLabel = isAdmin ? 'Admin' : 'Cliente';

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
        <div
          className="flex items-center flex-shrink-0 cursor-pointer min-w-0"
          onClick={() => {
            setLocation(homePath);
            onCategorySelect('');
          }}
        >
          <div className="flex flex-col min-w-0">
            <h1 className="display text-lg sm:text-2xl md:text-3xl font-bold text-primary tracking-tight truncate">
              {settings.siteName}
            </h1>
            <span className="hidden sm:block text-secondary text-[10px] uppercase tracking-[0.15em] font-bold mt-1 truncate">
              {settings.slogan}
            </span>
          </div>
        </div>

        <div className="flex-1 max-w-md hidden md:flex relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder={
              isNikken
                ? 'Buscar agua, descanso, nutricion...'
                : 'Buscar perfumes, cremas, maquillaje...'
            }
            onChange={(event) => onSearchChange(event.target.value)}
            className="w-full pl-9 rounded-full bg-secondary/10 border-transparent focus-visible:ring-primary/20 focus-visible:bg-white transition-all text-sm body"
          />
        </div>

        {isNikken && (
          <nav className="hidden lg:flex items-center gap-6 ml-8 mr-auto">
            {isAdmin && (
              <button
                onClick={() => setLocation('/nikken/admin')}
                className="text-sm font-bold text-slate-500 hover:text-primary transition-colors uppercase tracking-wider"
              >
                Admin
              </button>
            )}
            <button
              onClick={() => setLocation('/nikken/account/orders')}
              className="text-sm font-bold text-slate-500 hover:text-primary transition-colors uppercase tracking-wider"
            >
              Mis pedidos
            </button>
          </nav>
        )}

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
                <button
                  className="flex items-center gap-2 rounded-full border border-primary/10 bg-white/80 py-1 pl-1 pr-2 text-foreground/80 hover:text-primary hover:bg-primary/10 transition-colors relative max-w-[11rem]"
                  title="Mi cuenta"
                >
                  <div className="w-7 h-7 rounded-full overflow-hidden border border-primary/30 shrink-0">
                    {user.avatar ? (
                      <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-secondary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {profileInitial}
                      </div>
                    )}
                  </div>
                  <div className="hidden sm:flex min-w-0 flex-col items-start text-left">
                    <span className="max-w-full truncate text-xs font-bold text-slate-800">
                      {profileName}
                    </span>
                    <span className="max-w-full truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {profileRoleLabel}
                    </span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 rounded-2xl p-2 shadow-2xl border-primary/5"
              >
                <DropdownMenuLabel className="px-3 py-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Mi cuenta
                  </p>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-secondary/10">
                      {user.avatar ? (
                        <img src={user.avatar} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-primary">{profileInitial}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{profileName}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                      {profileRoleLabel}
                    </span>
                    {mockProfiles.length > 1 ? (
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {mockProfiles.length} perfiles
                      </span>
                    ) : null}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-primary/5" />
                {mockProfiles.length > 1 && (
                  <>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="rounded-xl gap-3 px-3 py-2 focus:bg-primary/5">
                        <Repeat className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-slate-700">Cambiar perfil</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-60 rounded-2xl p-2">
                        <DropdownMenuLabel className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Perfiles mock
                        </DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={user.id}>
                          {mockProfiles.map((profile) => {
                            const isActiveProfile = profile.id === user.id;
                            const displayName = profile.name || profile.email;

                            return (
                              <DropdownMenuRadioItem
                                key={profile.id}
                                value={profile.id}
                                onSelect={() => switchMockProfile(profile.id)}
                                className="rounded-xl gap-3 px-3 py-2 cursor-pointer focus:bg-primary/5"
                              >
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-secondary/10">
                                    {profile.avatar ? (
                                      <img
                                        src={profile.avatar}
                                        alt={displayName}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <span className="text-xs font-bold text-primary">
                                        {displayName.trim().charAt(0).toUpperCase() || '?'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-slate-800">
                                      {displayName}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {profile.email}
                                    </p>
                                  </div>
                                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                                    {profile.role === 'admin' ? 'Admin' : 'Cliente'}
                                  </span>
                                  {isActiveProfile ? (
                                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                                      Activo
                                    </span>
                                  ) : null}
                                </div>
                              </DropdownMenuRadioItem>
                            );
                          })}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator className="bg-primary/5" />
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => setLocation(isNikken ? '/nikken/profile' : '/profile')}
                  className="rounded-xl mt-1 gap-3 px-3 py-2 cursor-pointer focus:bg-primary/5"
                >
                  <UserIcon className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-slate-700">Mi perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLocation(isNikken ? '/nikken/account/orders' : '/account/orders')}
                  className="rounded-xl gap-3 px-3 py-2 cursor-pointer focus:bg-primary/5"
                >
                  <Package className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-slate-700">Mis pedidos</span>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator className="bg-primary/5" />
                    <DropdownMenuItem
                      onClick={() => setLocation(isNikken ? '/nikken/admin' : '/admin')}
                      className="rounded-xl gap-3 px-3 py-2 cursor-pointer focus:bg-primary/5"
                    >
                      <LayoutDashboard className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-slate-700">Admin panel</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setLocation(isNikken ? '/nikken/admin/settings' : '/admin/settings')}
                      className="rounded-xl gap-3 px-3 py-2 cursor-pointer focus:bg-primary/5"
                    >
                      <Settings className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-slate-700">Configuracion</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="bg-primary/5" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="rounded-xl gap-3 px-3 py-2 text-rose-600 focus:bg-rose-50 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="font-bold">Cerrar sesion</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="p-2 text-foreground/80 hover:text-primary rounded-full hover:bg-primary/10 transition-colors relative"
              title="Iniciar sesion"
            >
              <UserIcon className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={() => setLocation(favoritesPath)}
            className="p-2 text-foreground/80 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors relative"
            title="Mis favoritos"
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
            title="Mi pedido"
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

      <nav className="border-t border-primary/5 bg-white/50">
        <div className="container mx-auto px-4 overflow-x-auto custom-scrollbar flex items-center py-2 md:py-3 gap-2 md:gap-6">
          <button
            onClick={() => onCategorySelect('')}
            className={`whitespace-nowrap heading text-sm md:text-base font-bold transition-colors py-1 px-3 md:px-0 rounded-full md:rounded-none md:border-b-2 ${
              activeCategory === ''
                ? 'bg-primary text-white md:bg-transparent md:text-primary md:border-primary'
                : 'text-foreground/70 hover:text-primary md:border-transparent md:hover:border-primary/50'
            }`}
          >
            Todos
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => onCategorySelect(category.id)}
              className={`whitespace-nowrap heading text-sm md:text-base font-bold transition-colors py-1 px-3 md:px-0 rounded-full md:rounded-none md:border-b-2 ${
                activeCategory === category.id
                  ? 'bg-primary text-white md:bg-transparent md:text-primary md:border-primary'
                  : 'text-foreground/70 hover:text-primary md:border-transparent md:hover:border-primary/50'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </nav>

      <div
        className={`container mx-auto px-4 md:hidden overflow-hidden transition-all duration-200 ${
          isMobileSearchOpen ? 'max-h-24 pb-3 opacity-100' : 'max-h-0 pb-0 opacity-0 pointer-events-none'
        }`}
      >
        <Input
          id={mobileSearchInputId}
          placeholder={
            isNikken
              ? 'Buscar agua, descanso, nutricion...'
              : 'Buscar perfumes, cremas, maquillaje...'
          }
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full rounded-2xl bg-secondary/10 border-transparent focus-visible:ring-primary/20 text-sm body"
        />
      </div>
    </header>
  );
}
