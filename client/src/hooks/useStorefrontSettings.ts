import { useSyncExternalStore } from 'react';
import type { Brand } from '@/contexts/BrandContext';
import {
  STOREFRONT_SETTINGS_CHANGED_EVENT,
  getDefaultStorefrontSettings,
  getStorefrontSettingsStorageKey,
  readStorefrontSettings,
  type StorefrontSettings,
} from '@/lib/storefrontSettings';

const storefrontSettingsSnapshotCache = new Map<
  Brand,
  { rawStorageValue: string | null; snapshot: StorefrontSettings }
>();
const defaultStorefrontSettingsSnapshotCache = new Map<Brand, StorefrontSettings>();

function getDefaultStorefrontSettingsSnapshot(brand: Brand) {
  const cachedSnapshot = defaultStorefrontSettingsSnapshotCache.get(brand);

  if (cachedSnapshot) {
    return cachedSnapshot;
  }

  const snapshot = getDefaultStorefrontSettings(brand);
  defaultStorefrontSettingsSnapshotCache.set(brand, snapshot);
  return snapshot;
}

function readRawStorefrontSettingsStorageValue(brand: Brand) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }

  return localStorage.getItem(getStorefrontSettingsStorageKey(brand));
}

function getStorefrontSettingsSnapshot(brand: Brand) {
  if (typeof window === 'undefined') {
    return getDefaultStorefrontSettingsSnapshot(brand);
  }

  const rawStorageValue = readRawStorefrontSettingsStorageValue(brand);
  const cachedSnapshot = storefrontSettingsSnapshotCache.get(brand);

  if (cachedSnapshot?.rawStorageValue === rawStorageValue) {
    return cachedSnapshot.snapshot;
  }

  const snapshot = readStorefrontSettings(brand);
  storefrontSettingsSnapshotCache.set(brand, {
    rawStorageValue,
    snapshot,
  });
  return snapshot;
}

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
    () => getStorefrontSettingsSnapshot(brand),
    () => getDefaultStorefrontSettingsSnapshot(brand)
  );
}
