import React from 'react';
import { Link, useLocation } from 'wouter';
import {
  ArrowLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserCircle,
} from 'lucide-react';
import { useBrand } from '@/contexts/BrandContext';
import { Button } from '@/components/shared/ui/button';
import { ScrollArea } from '@/components/shared/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/shared/ui/alert';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const { brand } = useBrand();
  const { user, isLoading, logout } = useAuth();
  const isNikken = brand === 'nikken';
  const basePath = isNikken ? '/nikken' : '';
  const isAdmin = user?.role === 'admin';
  const profileName = user?.name?.trim() || user?.email || 'Invitado';
  const roleLabel = user?.role === 'admin' ? 'Administrador' : user?.role === 'user' ? 'Usuario' : 'Sin rol';

  const menuItems = [
    { icon: LayoutDashboard, label: 'Resumen', href: `${basePath}/admin` },
    { icon: Package, label: 'Productos', href: `${basePath}/admin/products` },
    { icon: Settings, label: 'Configuracion', href: `${basePath}/admin/settings` },
  ];

  const handleLogout = () => {
    logout();
    setLocation(basePath || '/');
  };

  return (
    <div className={`min-h-screen flex bg-slate-50 ${isNikken ? 'theme-nikken' : ''}`}>
      <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="mb-4 p-6 border-bottom border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-white">
              {brand[0].toUpperCase()}
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800">
              Admin <span className="text-primary">{brand}</span>
            </span>
          </div>
        </div>

        <ScrollArea className="flex-1 px-4">
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const isActive = location === item.href;

              return (
                <Link key={item.href} href={item.href}>
                  <a
                    className={`group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
                      isActive
                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-primary'
                    }`}
                  >
                    <item.icon size={20} className={isActive ? 'text-white' : 'group-hover:text-primary'} />
                    <span className="font-medium">{item.label}</span>
                    {isActive && <ChevronRight size={16} className="ml-auto" />}
                  </a>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="mt-auto border-t border-slate-100 p-4">
          <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
                {user?.avatar ? (
                  <img src={user.avatar} alt={profileName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold">{profileName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{profileName}</p>
                <p className="truncate text-xs text-slate-500">{user?.email || 'Sin sesion activa'}</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-slate-600 transition-all hover:bg-red-50/50 hover:text-red-500"
          >
            <LogOut size={20} />
            <span className="font-medium">Cerrar sesion</span>
          </button>
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-8 backdrop-blur-md">
          <div className="flex items-center gap-4 md:hidden">
            <Button variant="ghost" size="icon">
              <Menu size={24} />
            </Button>
            <span className="text-lg font-bold">Admin Panel</span>
          </div>

          <div className="hidden md:flex flex-col">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Dashboard</h2>
            <p className="font-medium text-slate-800">
              {isLoading ? 'Cargando perfil...' : `Bienvenido de nuevo, ${profileName}`}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden items-end leading-tight sm:flex sm:flex-col">
              <span className="text-sm font-semibold text-slate-700">{profileName}</span>
              <span className="text-xs text-slate-500">{user?.email || 'Sin sesion activa'}</span>
            </div>
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
                isAdmin ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {isAdmin ? <ShieldCheck size={18} /> : <UserCircle size={18} />}
              <span>{roleLabel}</span>
            </div>
          </div>
        </header>

        <div className="p-8">
          {!isLoading && !isAdmin ? (
            <div className="mx-auto max-w-2xl">
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <ShieldAlert />
                <AlertTitle>Acceso restringido al panel administrativo</AlertTitle>
                <AlertDescription>
                  <p>
                    Tu perfil activo es <strong>{profileName}</strong> y actualmente tiene rol de{' '}
                    <strong>{roleLabel.toLowerCase()}</strong>.
                  </p>
                  <p>
                    Si necesitas permisos de administracion, inicia sesion con un perfil admin o pide acceso al equipo responsable.
                  </p>
                </AlertDescription>
              </Alert>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button onClick={() => setLocation(`${basePath}/profile`)}>
                    <UserCircle className="mr-2 h-4 w-4" />
                    Ir a mi perfil
                  </Button>
                  <Button variant="outline" onClick={() => setLocation(basePath || '/')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver al catalogo
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleLogout}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar sesion
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}
