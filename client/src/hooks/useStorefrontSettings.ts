import { useSyncExternalStore } from 'react';
import type { Brand } from '@/contexts/BrandContext';
import {
  STOREFRONT_SETTINGS_CHANGED_EVENT,
  getDefaultStorefrontSettings,
  getStorefrontSettingsStorageKey,
  readStorefrontSettings,
  type StorefrontSettings,
} from '@/lib/storefrontSettings';

function subscribeToStorefrontSettings(brand: Brand, onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleSettingsChanged = (event: Event) => {
    const eventBrand = (event as CustomEvent<{ brand?: Brand }>).detail?.brand;

    if (!eventBrand || eventBrand === brand) {
      onStoreChange();
    }
  };

  const handleStorageChange = (event: StorageEvent) => {
    const storageKey = getStorefrontSettingsStorageKey(brand);

    if (!event.key || event.key === storageKey) {
      onStoreChange();
    }
  };

  window.addEventListener(STOREFRONT_SETTINGS_CHANGED_EVENT, handleSettingsChanged as EventListener);
  window.addEventListener('storage', handleStorageChange);

  return () => {
    window.removeEventListener(
      STOREFRONT_SETTINGS_CHANGED_EVENT,
      handleSettingsChanged as EventListener
    );
    window.removeEventListener('storage', handleStorageChange);
  };
}

export function useStorefrontSettings(brand: Brand) {
  return useSyncExternalStore<StorefrontSettings>(
    (onStoreChange) => subscribeToStorefrontSettings(brand, onStoreChange),
    () => readStorefrontSettings(brand),
    () => getDefaultStorefrontSettings(brand)
  );
}
