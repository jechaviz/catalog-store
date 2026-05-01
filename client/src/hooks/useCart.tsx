import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import type { CatalogProduct } from '@/lib/dataFetcher';
import { useBrand } from '@/contexts/BrandContext';
import { useAuth } from '@/contexts/AuthContext';
import {
    getCartStorageKey,
    getLegacyBrandCartStorageKey,
    getLegacyCartStorageKey,
    isCartStorageKeyForBrand,
    readStoredCartItems,
} from '@/lib/storefrontStorage';

export interface CartItem {
    product: CatalogProduct;
    quantity: number;
}

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

export function CartProvider({ children }: { children: ReactNode }) {
    const { brand } = useBrand();
    const { user } = useAuth();
    const [items, setItems] = useState<CartItem[]>([]);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [peekTimeout, setPeekTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
    const userId = user?.id ?? null;
    const storageKey = getCartStorageKey(brand, userId);
    const hydratedStorageKeyRef = useRef<string | null>(null);

    useEffect(() => {
        const readCartSnapshot = (key: string) => {
            const storedItems = readStoredCartItems(key, brand);
            return {
                hasStoredValue: localStorage.getItem(key) !== null,
                items: storedItems,
            };
        };

        const mergeCartItems = (baseItems: CartItem[], extraItems: CartItem[]) => {
            const mergedItems = [...baseItems];

            extraItems.forEach(extraItem => {
                const existingIndex = mergedItems.findIndex(item => item.product.id === extraItem.product.id);

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
        };

        try {
            const activeSnapshot = readCartSnapshot(storageKey);

            if (activeSnapshot.hasStoredValue) {
                setItems(activeSnapshot.items);
                hydratedStorageKeyRef.current = storageKey;
                return;
            }

            const guestStorageKey = getCartStorageKey(brand);
            const guestSnapshot = guestStorageKey === storageKey ? activeSnapshot : readCartSnapshot(guestStorageKey);
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

            setItems(nextItems);

            if (nextItems.length > 0 || userId || legacyBrandSnapshot.hasStoredValue || naturaLegacySnapshot.hasStoredValue) {
                localStorage.setItem(storageKey, JSON.stringify(nextItems));
            }
        } catch (e) {
            console.error('Failed to parse cart from local storage', e);
            setItems([]);
        }
        hydratedStorageKeyRef.current = storageKey;
    }, [brand, storageKey, userId]);

    useEffect(() => {
        if (hydratedStorageKeyRef.current === storageKey) {
            localStorage.setItem(storageKey, JSON.stringify(items));
        }
    }, [items, storageKey]);

    useEffect(() => {
        const handleStorageChange = (event: StorageEvent) => {
            if (!isCartStorageKeyForBrand(event.key, brand)) {
                return;
            }

            try {
                setItems(readStoredCartItems(storageKey, brand));
                hydratedStorageKeyRef.current = storageKey;
            } catch (e) {
                console.error('Failed to sync cart from local storage', e);
            }
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [brand, storageKey]);

    useEffect(() => {
        return () => {
            if (peekTimeout) {
                clearTimeout(peekTimeout);
            }
        };
    }, [peekTimeout]);

    const addItem = (product: CatalogProduct, quantity: number = 1) => {
        setItems(currentItems => {
            const existingItem = currentItems.find(item => item.product.id === product.id);
            if (existingItem) {
                return currentItems.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
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
        setItems(currentItems => currentItems.filter(item => item.product.id !== productId));
    };

    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity < 1) {
            removeItem(productId);
            return;
        }
        setItems(currentItems =>
            currentItems.map(item =>
                item.product.id === productId ? { ...item, quantity } : item
            )
        );
    };

    const clearCart = () => setItems([]);

    const subtotal = items.reduce((total, item) => total + (item.product.price * item.quantity), 0);
    const itemCount = items.reduce((count, item) => count + item.quantity, 0);

    return (
        <CartContext.Provider value= {{
        items,
            addItem,
            removeItem,
            updateQuantity,
            clearCart,
            subtotal,
            itemCount,
            isDrawerOpen,
            setIsDrawerOpen
    }
}>
    { children }
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
