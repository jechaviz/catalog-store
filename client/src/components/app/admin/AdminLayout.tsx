import React from 'react';
import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, 
  Package, 
  Settings, 
  LogOut, 
  Menu,
  ChevronRight,
  UserCircle
} from 'lucide-react';
import { useBrand } from '@/contexts/BrandContext';
import { Button } from '@/components/shared/ui/button';
import { ScrollArea } from '@/components/shared/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const { brand } = useBrand();
  const { logout } = useAuth();
  const isNikken = brand === 'nikken';

  const menuItems = [
    { icon: LayoutDashboard, label: 'Resumen', href: isNikken ? '/nikken/admin' : '/admin' },
    { icon: Package, label: 'Productos', href: isNikken ? '/nikken/admin/products' : '/admin/products' },
    { icon: Settings, label: 'Configuración', href: isNikken ? '/nikken/admin/settings' : '/admin/settings' },
  ];

  const handleLogout = () => {
    logout();
    setLocation(isNikken ? '/nikken' : '/');
  };

  return (
    <div className={`min-h-screen flex bg-slate-50 ${isNikken ? 'theme-nikken' : ''}`}>
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col sticky top-0 h-screen">
        <div className="p-6 border-bottom border-slate-100 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold">
              {brand[0].toUpperCase()}
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">
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
                  <a className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive 
                      ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-primary'
                  }`}>
                    <item.icon size={20} className={isActive ? 'text-white' : 'group-hover:text-primary'} />
                    <span className="font-medium">{item.label}</span>
                    {isActive && <ChevronRight size={16} className="ml-auto" />}
                  </a>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="p-4 mt-auto border-t border-slate-100">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-3 text-slate-600 hover:text-red-500 hover:bg-red-50/50 rounded-xl transition-all"
          >
            <LogOut size={20} />
            <span className="font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 px-8 flex items-center justify-between">
          <div className="md:hidden flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <Menu size={24} />
            </Button>
            <span className="font-bold text-lg">Admin Panel</span>
          </div>
          
          <div className="hidden md:flex flex-col">
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Dashboard</h2>
            <p className="font-medium text-slate-800">Bienvenido de nuevo, Deni</p>
          </div>

          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-sm font-medium">
               <UserCircle size={18} />
               <span>Administrador</span>
             </div>
          </div>
        </header>

        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
