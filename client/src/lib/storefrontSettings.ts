import { CONFIG } from '@/config';
import type { Brand } from '@/contexts/BrandContext';

export interface StorefrontSettings {
  siteName: string;
  slogan: string;
  sellerPhone: string;
  sellerMessageTemplate: string;
}

const DEFAULT_MESSAGE_TEMPLATE = 'Hola, me interesa realizar el siguiente pedido:';

const DEFAULT_SETTINGS_BY_BRAND: Record<Brand, StorefrontSettings> = {
  natura: {
    siteName: 'Natura Catalogo',
    slogan: 'Belleza que cuida de ti',
    sellerPhone: CONFIG.SELLER.PHONE,
    sellerMessageTemplate: DEFAULT_MESSAGE_TEMPLATE,
  },
  nikken: {
    siteName: 'Nikken Wellness Store',
    slogan: 'Descubre el bienestar con tecnologia magnetica',
    sellerPhone: CONFIG.SELLER.PHONE,
    sellerMessageTemplate: 'Hola, me interesa conocer mas sobre estos productos Nikken:',
  },
};

function safeParseJson<T>(rawValue: string | null, fallbackValue: T): T {
  if (!rawValue) {
    return fallbackValue;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallbackValue;
  }
}

export function getStorefrontSettingsStorageKey(brand: Brand) {
  return `catalog_storefront_settings_${brand}`;
}

export function getDefaultStorefrontSettings(brand: Brand): StorefrontSettings {
  return DEFAULT_SETTINGS_BY_BRAND[brand];
}

export function normalizeSellerPhone(value: string) {
  const normalized = value.replace(/\D/g, '');
  return normalized || CONFIG.SELLER.PHONE;
}

function normalizeSettings(
  brand: Brand,
  settings: Partial<StorefrontSettings> | undefined
): StorefrontSettings {
  const defaults = getDefaultStorefrontSettings(brand);

  return {
    siteName: settings?.siteName?.trim() || defaults.siteName,
    slogan: settings?.slogan?.trim() || defaults.slogan,
    sellerPhone: normalizeSellerPhone(settings?.sellerPhone || defaults.sellerPhone),
    sellerMessageTemplate:
      settings?.sellerMessageTemplate?.trim() || defaults.sellerMessageTemplate,
  };
}

export function readStorefrontSettings(brand: Brand): StorefrontSettings {
  const defaults = getDefaultStorefrontSettings(brand);
  const parsed = safeParseJson<Partial<StorefrontSettings>>(
    localStorage.getItem(getStorefrontSettingsStorageKey(brand)),
    defaults
  );

  return normalizeSettings(brand, parsed);
}

export function saveStorefrontSettings(brand: Brand, settings: Partial<StorefrontSettings>) {
  const nextSettings = normalizeSettings(brand, {
    ...readStorefrontSettings(brand),
    ...settings,
  });

  localStorage.setItem(getStorefrontSettingsStorageKey(brand), JSON.stringify(nextSettings));
  window.dispatchEvent(new CustomEvent('catalog-storefront-settings-changed', { detail: { brand } }));

  return nextSettings;
}
