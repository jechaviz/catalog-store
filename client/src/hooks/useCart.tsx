import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import type { CatalogProduct } from '@/lib/dataFetcher';
import { useBrand } from '@/contexts/BrandContext';
import {
    getCartStorageKey,
    getLegacyCartStorageKey,
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
    const [items, setItems] = useState<CartItem[]>([]);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [peekTimeout, setPeekTimeout] = useState<NodeJS.Timeout | null>(null);
    const storageKey = getCartStorageKey(brand);
    const hydratedStorageKeyRef = useRef<string | null>(null);

    useEffect(() => {
        try {
            const currentBrandItems = readStoredCartItems(storageKey, brand);
            if (currentBrandItems.length > 0 || localStorage.getItem(storageKey)) {
                setItems(currentBrandItems);
            } else {
                const legacyItems = readStoredCartItems(getLegacyCartStorageKey(), brand);
                setItems(legacyItems);

                if (legacyItems.length > 0) {
                    localStorage.setItem(storageKey, JSON.stringify(legacyItems));
                }
            }
        } catch (e) {
            console.error('Failed to parse cart from local storage', e);
            setItems([]);
        }
        hydratedStorageKeyRef.current = storageKey;
    }, [brand, storageKey]);

    useEffect(() => {
        if (hydratedStorageKeyRef.current === storageKey) {
            localStorage.setItem(storageKey, JSON.stringify(items));
        }
    }, [items, storageKey]);

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
