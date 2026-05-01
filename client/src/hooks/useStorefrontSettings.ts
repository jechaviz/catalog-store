import { useEffect, useState } from 'react';
import type { Brand } from '@/contexts/BrandContext';
import {
  getStorefrontSettingsStorageKey,
  readStorefrontSettings,
  type StorefrontSettings,
} from '@/lib/storefrontSettings';

export function useStorefrontSettings(brand: Brand) {
  const [settings, setSettings] = useState<StorefrontSettings>(() => readStorefrontSettings(brand));

  useEffect(() => {
    const syncSettings = () => {
      setSettings(readStorefrontSettings(brand));
    };

    const handleSettingsChanged = (event: Event) => {
      const eventBrand = (event as CustomEvent<{ brand?: Brand }>).detail?.brand;

      if (!eventBrand || eventBrand === brand) {
        syncSettings();
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      const storageKey = getStorefrontSettingsStorageKey(brand);

      if (!event.key || event.key === storageKey) {
        syncSettings();
      }
    };

    syncSettings();
    window.addEventListener('catalog-storefront-settings-changed', handleSettingsChanged as EventListener);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(
        'catalog-storefront-settings-changed',
        handleSettingsChanged as EventListener
      );
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [brand]);

  return settings;
}
