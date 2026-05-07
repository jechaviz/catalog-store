import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useBrand } from '@/contexts/BrandContext';
import { useAuth } from '@/contexts/AuthContext';
import type { CatalogProduct } from '@/lib/dataFetcher';
import { normalizeStorageScopeId } from '@/lib/storageScope';
import {
  CART_CHANGED_EVENT,
  getCartStorageKey,
  getLegacyBrandCartStorageKey,
  getLegacyCartStorageKey,
  readStoredCartItems,
  writeStoredCartItems,
} from '@/lib/storefrontStorage';

export interface CartItem {
  product: CatalogProduct;
  quantity: number;
}

type CartChangedEventDetail = {
  storageKey?: string;
  scopeId?: string;
  source?: 'local' | 'remote';
  originId?: string;
};

interface CartContextType {
  items: CartItem[];
  addItem: (product: CatalogProduct, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
  itemCount: number;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (isOpen: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function serializeCartItems(items: CartItem[]) {
  return JSON.stringify(items);
}

function mergeCartItems(baseItems: CartItem[], extraItems: CartItem[]) {
  const mergedItems = [...baseItems];

  extraItems.forEach((extraItem) => {
    const existingIndex = mergedItems.findIndex((item) => item.product.id === extraItem.product.id);

    if (existingIndex >= 0) {
      mergedItems[existingIndex] = {
        ...mergedItems[existingIndex],
        quantity: mergedItems[existingIndex].quantity + extraItem.quantity,
      };
      return;
    }

    mergedItems.push(extraItem);
  });

  return mergedItems;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { brand } = useBrand();
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [peekTimeout, setPeekTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const userId = user?.id ?? null;
  const scopeId = normalizeStorageScopeId(userId);
  const storageKey = getCartStorageKey(brand, userId);
  const hydratedStorageKeyRef = useRef<string | null>(null);
  const serializedItemsRef = useRef('[]');
  const providerOriginIdRef = useRef(
    `cart-provider-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
  );

  const applyItemsSnapshot = (nextItems: CartItem[]) => {
    const nextSerialized = serializeCartItems(nextItems);
    serializedItemsRef.current = nextSerialized;
    setItems((currentItems) =>
      serializeCartItems(currentItems) === nextSerialized ? currentItems : nextItems,
    );
  };

  useEffect(() => {
    if (!canUseBrowserStorage()) {
      applyItemsSnapshot([]);
      hydratedStorageKeyRef.current = storageKey;
      return;
    }

    const readCartSnapshot = (key: string) => ({
      hasStoredValue: localStorage.getItem(key) !== null,
      items: readStoredCartItems(key, brand),
    });

    try {
      const activeSnapshot = readCartSnapshot(storageKey);

      if (activeSnapshot.hasStoredValue) {
        applyItemsSnapshot(activeSnapshot.items);
        hydratedStorageKeyRef.current = storageKey;
        return;
      }

      const guestStorageKey = getCartStorageKey(brand);
      const guestSnapshot =
        guestStorageKey === storageKey ? activeSnapshot : readCartSnapshot(guestStorageKey);
      const legacyBrandKey = getLegacyBrandCartStorageKey(brand);
      const legacyBrandSnapshot = readCartSnapshot(legacyBrandKey);
      const naturaLegacySnapshot = brand === 'natura'
        ? readCartSnapshot(getLegacyCartStorageKey())
        : { hasStoredValue: false, items: [] as CartItem[] };

      let nextItems: CartItem[] = [];

      if (userId) {
        if (guestSnapshot.hasStoredValue) {
          nextItems = mergeCartItems(nextItems, guestSnapshot.items);
        }

        if (legacyBrandSnapshot.hasStoredValue) {
          nextItems = mergeCartItems(nextItems, legacyBrandSnapshot.items);
        }

        if (naturaLegacySnapshot.hasStoredValue) {
          nextItems = mergeCartItems(nextItems, naturaLegacySnapshot.items);
        }
      } else if (guestSnapshot.hasStoredValue) {
        nextItems = guestSnapshot.items;
      } else if (legacyBrandSnapshot.hasStoredValue) {
        nextItems = legacyBrandSnapshot.items;
      } else if (naturaLegacySnapshot.hasStoredValue) {
        nextItems = naturaLegacySnapshot.items;
      }

      applyItemsSnapshot(nextItems);

      if (
        nextItems.length > 0 ||
        userId ||
        legacyBrandSnapshot.hasStoredValue ||
        naturaLegacySnapshot.hasStoredValue
      ) {
        writeStoredCartItems(storageKey, brand, nextItems, {
          userId,
          originId: providerOriginIdRef.current,
        });
      }
    } catch (error) {
      console.error('Failed to hydrate cart state', error);
      applyItemsSnapshot([]);
    }

    hydratedStorageKeyRef.current = storageKey;
  }, [brand, storageKey, userId]);

  useEffect(() => {
    if (!canUseBrowserStorage() || hydratedStorageKeyRef.current !== storageKey) {
      return;
    }

    const nextSerialized = serializeCartItems(items);
    const persistedSerialized = localStorage.getItem(storageKey);

    if (persistedSerialized === nextSerialized) {
      serializedItemsRef.current = nextSerialized;
      return;
    }

    writeStoredCartItems(storageKey, brand, items, {
      userId,
      originId: providerOriginIdRef.current,
    });
    serializedItemsRef.current = nextSerialized;
  }, [brand, items, storageKey, userId]);

  useEffect(() => {
    if (!canUseBrowserStorage()) {
      return;
    }

    const syncFromStorage = () => {
      try {
        applyItemsSnapshot(readStoredCartItems(storageKey, brand));
        hydratedStorageKeyRef.current = storageKey;
      } catch (error) {
        console.error('Failed to sync cart from storage', error);
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === storageKey) {
        syncFromStorage();
      }
    };

    const handleCartChanged = (event: Event) => {
      const detail = (event as CustomEvent<CartChangedEventDetail>).detail;

      if (detail?.originId && detail.originId === providerOriginIdRef.current) {
        return;
      }

      if (detail?.scopeId && detail.scopeId !== scopeId) {
        return;
      }

      if (!detail?.storageKey || detail.storageKey === storageKey) {
        syncFromStorage();
      }
    };

    window.addEventListener(CART_CHANGED_EVENT, handleCartChanged as EventListener);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(CART_CHANGED_EVENT, handleCartChanged as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [brand, scopeId, storageKey]);

  useEffect(() => {
    return () => {
      if (peekTimeout) {
        clearTimeout(peekTimeout);
      }
    };
  }, [peekTimeout]);

  const addItem = (product: CatalogProduct, quantity = 1) => {
    setItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.product.id === product.id);

      if (existingItem) {
        return currentItems.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }

      return [...currentItems, { product, quantity }];
    });

    setIsDrawerOpen(true);

    if (peekTimeout) {
      clearTimeout(peekTimeout);
    }

    const timeout = setTimeout(() => {
      setIsDrawerOpen(false);
    }, 2000);

    setPeekTimeout(timeout);
  };

  const removeItem = (productId: string) => {
    setItems((currentItems) => currentItems.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(productId);
      return;
    }

    setItems((currentItems) =>
      currentItems.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item,
      ),
    );
  };

  const clearCart = () => setItems([]);

  const subtotal = items.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        subtotal,
        itemCount,
        isDrawerOpen,
        setIsDrawerOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }

  return context;
}
