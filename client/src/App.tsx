import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/shared/ui/sonner";
import { TooltipProvider } from "@/components/shared/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "@/components/shared/ui/ErrorBoundary";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CartProvider } from "./hooks/useCart";
import Home from "./pages/Home";
import { BrandProvider } from "./contexts/BrandContext";

const Checkout = lazy(() => import("./pages/Checkout"));
const Profile = lazy(() => import("./pages/Profile"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const ProductManager = lazy(() => import("./pages/admin/ProductManager"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const OrderHistory = lazy(() => import("./pages/account/OrderHistory"));
const OrderTracking = lazy(() => import("./pages/account/OrderTracking"));
const ReturnsPortal = lazy(() => import("./pages/account/ReturnsPortal"));
const Favorites = lazy(() => import("./pages/account/Favorites"));

function RouteFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background/50">
      <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
      <p className="heading text-lg font-bold text-primary">Cargando vista...</p>
    </div>
  );
}

function AdminRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const isNikkenRoute = location.startsWith("/nikken");

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!user) {
      setLocation(isNikkenRoute ? "/nikken" : "/");
      return;
    }

    if (user.role !== "admin") {
      setLocation(isNikkenRoute ? "/nikken/profile" : "/profile");
    }
  }, [isLoading, isNikkenRoute, setLocation, user]);

  if (isLoading) {
    return <RouteFallback />;
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  return <Component />;
}


function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/nikken" component={Home} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/nikken/checkout" component={Checkout} />
        <Route path="/profile" component={Profile} />
        <Route path="/nikken/profile" component={Profile} />
        
        {/* Admin Routes */}
        <Route path="/admin">
          <AdminRoute component={AdminDashboard} />
        </Route>
        <Route path="/nikken/admin">
          <AdminRoute component={AdminDashboard} />
        </Route>
        <Route path="/admin/products">
          <AdminRoute component={ProductManager} />
        </Route>
        <Route path="/nikken/admin/products">
          <AdminRoute component={ProductManager} />
        </Route>
        <Route path="/admin/settings">
          <AdminRoute component={AdminSettings} />
        </Route>
        <Route path="/nikken/admin/settings">
          <AdminRoute component={AdminSettings} />
        </Route>

        
        {/* Customer Account Routes */}
        <Route path="/account/orders" component={OrderHistory} />
        <Route path="/nikken/account/orders" component={OrderHistory} />
        <Route path="/account/tracking/:id" component={OrderTracking} />
        <Route path="/nikken/account/tracking/:id" component={OrderTracking} />
        <Route path="/account/returns" component={ReturnsPortal} />
        <Route path="/nikken/account/returns" component={ReturnsPortal} />
        <Route path="/account/favorites" component={Favorites} />
        <Route path="/nikken/account/favorites" component={Favorites} />

        <Route path="/404" component={NotFound} />

        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <BrandProvider>
            <CartProvider>
              <TooltipProvider>
                <Toaster />
                <Router />
              </TooltipProvider>
            </CartProvider>
          </BrandProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
