import { useEffect, useRef } from 'react';
import { useBrand, type Brand } from '@/contexts/BrandContext';
import { hydrateStorefrontRemoteState } from '@/lib/storefrontRemoteState';

const FOCUS_SYNC_DEBOUNCE_MS = 1_500;

export function StorefrontStateSync() {
  const { brand } = useBrand();
  const brandRef = useRef<Brand>(brand);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeBrandRef = useRef<Brand | null>(null);
  const lastSyncStartedAtRef = useRef(0);

  useEffect(() => {
    brandRef.current = brand;
  }, [brand]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      activeBrandRef.current = null;
    };
  }, []);

  useEffect(() => {
    const requestSync = (reason: 'brand' | 'focus') => {
      if (typeof window === 'undefined') {
        return;
      }

      const now = Date.now();

      if (reason === 'focus' && now - lastSyncStartedAtRef.current < FOCUS_SYNC_DEBOUNCE_MS) {
        return;
      }

      if (reason === 'focus' && activeBrandRef.current === brandRef.current) {
        return;
      }

      abortControllerRef.current?.abort();

      const controller = new AbortController();

      abortControllerRef.current = controller;
      activeBrandRef.current = brandRef.current;
      lastSyncStartedAtRef.current = now;

      void hydrateStorefrontRemoteState(brandRef.current, {
        signal: controller.signal,
      }).finally(() => {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
          activeBrandRef.current = null;
        }
      });
    };

    const handleWindowFocus = () => {
      if (document.visibilityState === 'visible') {
        requestSync('focus');
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestSync('focus');
      }
    };

    requestSync('brand');
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      activeBrandRef.current = null;
    };
  }, [brand]);

  return null;
}
