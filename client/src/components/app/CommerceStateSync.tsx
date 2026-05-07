import { useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand, type Brand } from '@/contexts/BrandContext';
import { syncCustomerRemoteState, hydrateCustomerRemoteState } from '@/lib/commerceRemoteState';
import { normalizeStorageScopeId } from '@/lib/storageScope';

const FOCUS_SYNC_DEBOUNCE_MS = 1_500;
const RESOURCE_SYNC_DEBOUNCE_MS = 300;

type CommerceResource = 'orders' | 'likes' | 'cart';
type CommerceEventDetail = {
  brand?: Brand;
  scopeId?: string;
  source?: 'local' | 'remote';
};

export function CommerceStateSync() {
  const { brand } = useBrand();
  const { user } = useAuth();
  const brandRef = useRef<Brand>(brand);
  const userIdRef = useRef<string | null>(user?.id ?? null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRequestKeyRef = useRef<string | null>(null);
  const lastSyncStartedAtRef = useRef(0);
  const resourceTimersRef = useRef<Partial<Record<CommerceResource, ReturnType<typeof setTimeout>>>>({});
  const syncKey = useMemo(() => `${brand}:${user?.id ?? 'guest'}`, [brand, user?.id]);

  useEffect(() => {
    brandRef.current = brand;
    userIdRef.current = user?.id ?? null;
  }, [brand, user?.id]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      activeRequestKeyRef.current = null;
      Object.values(resourceTimersRef.current).forEach((timerId) => {
        if (timerId) {
          clearTimeout(timerId);
        }
      });
      resourceTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    const requestHydration = (reason: 'scope' | 'focus') => {
      if (typeof window === 'undefined') {
        return;
      }

      const now = Date.now();

      if (reason === 'focus' && now - lastSyncStartedAtRef.current < FOCUS_SYNC_DEBOUNCE_MS) {
        return;
      }

      if (reason === 'focus' && activeRequestKeyRef.current === syncKey) {
        return;
      }

      abortControllerRef.current?.abort();

      const controller = new AbortController();

      abortControllerRef.current = controller;
      activeRequestKeyRef.current = syncKey;
      lastSyncStartedAtRef.current = now;

      void hydrateCustomerRemoteState(brandRef.current, userIdRef.current, {
        signal: controller.signal,
      }).finally(() => {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
          activeRequestKeyRef.current = null;
        }
      });
    };

    const handleWindowFocus = () => {
      if (document.visibilityState === 'visible') {
        requestHydration('focus');
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestHydration('focus');
      }
    };

    requestHydration('scope');
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      activeRequestKeyRef.current = null;
    };
  }, [syncKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const scheduleResourceSync = (resource: CommerceResource) => {
      const existingTimer = resourceTimersRef.current[resource];

      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      resourceTimersRef.current[resource] = setTimeout(() => {
        void syncCustomerRemoteState(brandRef.current, userIdRef.current, [resource]);
        delete resourceTimersRef.current[resource];
      }, RESOURCE_SYNC_DEBOUNCE_MS);
    };

    const createHandler =
      (resource: CommerceResource) =>
      (event: Event) => {
        const detail = (event as CustomEvent<CommerceEventDetail>).detail;

        if (detail?.source === 'remote') {
          return;
        }

        if (detail?.brand && detail.brand !== brandRef.current) {
          return;
        }

        if (detail?.scopeId) {
          const activeScopeId = normalizeStorageScopeId(userIdRef.current);

          if (detail.scopeId !== activeScopeId) {
            return;
          }
        }

        scheduleResourceSync(resource);
      };

    const handleOrdersChanged = createHandler('orders');
    const handleLikesChanged = createHandler('likes');
    const handleCartChanged = createHandler('cart');

    window.addEventListener('catalog-orders-changed', handleOrdersChanged as EventListener);
    window.addEventListener('catalog-likes-changed', handleLikesChanged as EventListener);
    window.addEventListener('catalog-cart-changed', handleCartChanged as EventListener);

    return () => {
      window.removeEventListener('catalog-orders-changed', handleOrdersChanged as EventListener);
      window.removeEventListener('catalog-likes-changed', handleLikesChanged as EventListener);
      window.removeEventListener('catalog-cart-changed', handleCartChanged as EventListener);
      Object.values(resourceTimersRef.current).forEach((timerId) => {
        if (timerId) {
          clearTimeout(timerId);
        }
      });
      resourceTimersRef.current = {};
    };
  }, []);

  return null;
}
