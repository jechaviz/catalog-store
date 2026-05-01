import { CONFIG } from '@/config';
import type { Brand } from '@/contexts/BrandContext';

export interface StorefrontSettings {
  siteName: string;
  slogan: string;
  logoImageUrl: string;
  heroImageUrl: string;
  heroEyebrow: string;
  heroDescription: string;
  sellerPhone: string;
  sellerMessageTemplate: string;
  connectiaPaymentLink: string;
  paypalPaymentLink: string;
  paypalUsername: string;
  transferClabe: string;
  transferInstructions: string;
}

const DEFAULT_MESSAGE_TEMPLATE = 'Hola, me interesa realizar el siguiente pedido:';
const DEFAULT_CONNECTIA_LINK = 'https://connectia.mx/tu-tienda';
const DEFAULT_PAYPAL_USERNAME = 'tuusuario';
const DEFAULT_TRANSFER_INSTRUCTIONS =
  'Realiza tu transferencia y comparte tu comprobante por WhatsApp para confirmar el pedido.';
const DEFAULT_LOGO_IMAGE_URL = '';

const DEFAULT_SETTINGS_BY_BRAND: Record<Brand, StorefrontSettings> = {
  natura: {
    siteName: 'Natura Catalogo',
    slogan: 'Belleza que cuida de ti',
    logoImageUrl: DEFAULT_LOGO_IMAGE_URL,
    heroImageUrl: '/perfume_fem.png',
    heroEyebrow: 'Catalogo Natura',
    heroDescription:
      'Fragancias, cuidado personal y regalos listos para compartir desde una vitrina simple y confiable.',
    sellerPhone: CONFIG.SELLER.PHONE,
    sellerMessageTemplate: DEFAULT_MESSAGE_TEMPLATE,
    connectiaPaymentLink: DEFAULT_CONNECTIA_LINK,
    paypalPaymentLink: `https://paypal.me/${DEFAULT_PAYPAL_USERNAME}`,
    paypalUsername: DEFAULT_PAYPAL_USERNAME,
    transferClabe: CONFIG.SELLER.CLABE,
    transferInstructions: DEFAULT_TRANSFER_INSTRUCTIONS,
  },
  nikken: {
    siteName: 'Nikken Wellness Store',
    slogan: 'Descubre el bienestar con tecnologia magnetica',
    logoImageUrl: DEFAULT_LOGO_IMAGE_URL,
    heroImageUrl: '/assets/nikken/products/100.jpg',
    heroEyebrow: 'Bienestar Nikken',
    heroDescription:
      'Soluciones de descanso, confort y estilo de vida para una experiencia de compra mas cercana.',
    sellerPhone: CONFIG.SELLER.PHONE,
    sellerMessageTemplate: 'Hola, me interesa conocer mas sobre estos productos Nikken:',
    connectiaPaymentLink: DEFAULT_CONNECTIA_LINK,
    paypalPaymentLink: `https://paypal.me/${DEFAULT_PAYPAL_USERNAME}`,
    paypalUsername: DEFAULT_PAYPAL_USERNAME,
    transferClabe: CONFIG.SELLER.CLABE,
    transferInstructions: DEFAULT_TRANSFER_INSTRUCTIONS,
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
  return { ...DEFAULT_SETTINGS_BY_BRAND[brand] };
}

function getTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function normalizeSellerPhone(value: unknown) {
  const normalized = getTrimmedString(value).replace(/\D/g, '');
  return normalized || CONFIG.SELLER.PHONE;
}

function normalizeTextValue(value: unknown, fallbackValue: string) {
  return getTrimmedString(value) || fallbackValue;
}

function normalizeOptionalUrlValue(value: unknown, fallbackValue: string) {
  const normalized = getTrimmedString(value);

  if (!normalized) {
    return fallbackValue;
  }

  if (/^(javascript|vbscript):/i.test(normalized) || /^data:(?!image\/)/i.test(normalized)) {
    return fallbackValue;
  }

  return normalized;
}

function normalizePaypalUsername(value: unknown, fallbackValue: string) {
  const normalized = getTrimmedString(value).replace(/^@+/, '');
  return normalized || fallbackValue;
}

function extractPaypalUsernameFromLink(value: unknown) {
  const normalizedValue = getTrimmedString(value).replace(/\/+$/, '');

  if (!normalizedValue) {
    return '';
  }

  const match = normalizedValue.match(/paypal\.me\/([^/?#]+)/i);
  return match?.[1]?.trim() || '';
}

function normalizePaypalLink(value: unknown, username: string, fallbackValue: string) {
  const normalized = normalizeOptionalUrlValue(value, '');

  if (normalized) {
    return normalized;
  }

  if (username) {
    return `https://paypal.me/${username}`;
  }

  return fallbackValue;
}

function normalizeSettings(
  brand: Brand,
  settings: Partial<StorefrontSettings> | undefined
): StorefrontSettings {
  const defaults = getDefaultStorefrontSettings(brand);
  const paypalUsername =
    normalizePaypalUsername(settings?.paypalUsername, '') ||
    extractPaypalUsernameFromLink(settings?.paypalPaymentLink) ||
    defaults.paypalUsername;

  return {
    siteName: normalizeTextValue(settings?.siteName, defaults.siteName),
    slogan: normalizeTextValue(settings?.slogan, defaults.slogan),
    logoImageUrl: normalizeOptionalUrlValue(settings?.logoImageUrl, defaults.logoImageUrl),
    heroImageUrl: normalizeOptionalUrlValue(settings?.heroImageUrl, defaults.heroImageUrl),
    heroEyebrow: normalizeTextValue(settings?.heroEyebrow, defaults.heroEyebrow),
    heroDescription: normalizeTextValue(settings?.heroDescription, defaults.heroDescription),
    sellerPhone: normalizeSellerPhone(settings?.sellerPhone || defaults.sellerPhone),
    sellerMessageTemplate: normalizeTextValue(
      settings?.sellerMessageTemplate,
      defaults.sellerMessageTemplate
    ),
    connectiaPaymentLink: normalizeTextValue(
      settings?.connectiaPaymentLink,
      defaults.connectiaPaymentLink
    ),
    paypalPaymentLink: normalizePaypalLink(
      settings?.paypalPaymentLink,
      paypalUsername,
      defaults.paypalPaymentLink
    ),
    paypalUsername,
    transferClabe: normalizeTextValue(settings?.transferClabe, defaults.transferClabe),
    transferInstructions: normalizeTextValue(
      settings?.transferInstructions,
      defaults.transferInstructions
    ),
  };
}

export function readStorefrontSettings(brand: Brand): StorefrontSettings {
  const defaults = getDefaultStorefrontSettings(brand);

  if (!canUseLocalStorage()) {
    return defaults;
  }

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

  if (!canUseLocalStorage()) {
    return nextSettings;
  }

  localStorage.setItem(getStorefrontSettingsStorageKey(brand), JSON.stringify(nextSettings));
  window.dispatchEvent(new CustomEvent('catalog-storefront-settings-changed', { detail: { brand } }));

  return nextSettings;
}
