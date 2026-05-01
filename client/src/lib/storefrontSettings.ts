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

export interface StorefrontSettingsRemoteSyncOptions {
  endpoint?: string | null;
  fetcher?: typeof fetch;
  requestInit?: Omit<RequestInit, 'body' | 'headers' | 'method'>;
  headers?: HeadersInit;
  method?: 'POST' | 'PUT' | 'PATCH';
}

export interface StorefrontSettingsRemoteSyncResult {
  settings: StorefrontSettings;
  persistedRemotely: boolean;
  usedLocalFallback: boolean;
  response?: Response;
  error?: unknown;
}

export type StorefrontSettingsRemoteSnapshot =
  | Partial<StorefrontSettings>
  | Partial<Record<Brand, Partial<StorefrontSettings> | null | undefined>>
  | {
      brand?: Brand;
      settings?: Partial<StorefrontSettings> | null;
      storefrontSettings?: Partial<StorefrontSettings> | null;
      snapshot?: Partial<StorefrontSettings> | null;
      data?: unknown;
      brands?: Partial<Record<Brand, Partial<StorefrontSettings> | null | undefined>>;
      byBrand?: Partial<Record<Brand, Partial<StorefrontSettings> | null | undefined>>;
    }
  | null
  | undefined;

const DEFAULT_MESSAGE_TEMPLATE = 'Hola, me interesa realizar el siguiente pedido:';
const DEFAULT_CONNECTIA_LINK = 'https://connectia.mx/tu-tienda';
const DEFAULT_PAYPAL_USERNAME = 'tuusuario';
const DEFAULT_TRANSFER_INSTRUCTIONS =
  'Realiza tu transferencia y comparte tu comprobante por WhatsApp para confirmar el pedido.';
const DEFAULT_LOGO_IMAGE_URL = '';
export const STOREFRONT_SETTINGS_CHANGED_EVENT = 'catalog-storefront-settings-changed';

const STOREFRONT_SETTINGS_REMOTE_SYNC_ENDPOINT = getTrimmedString(
  import.meta.env.VITE_STOREFRONT_SETTINGS_SYNC_ENDPOINT
);
const STOREFRONT_SETTINGS_FIELD_KEYS = [
  'siteName',
  'slogan',
  'logoImageUrl',
  'heroImageUrl',
  'heroEyebrow',
  'heroDescription',
  'sellerPhone',
  'sellerMessageTemplate',
  'connectiaPaymentLink',
  'paypalPaymentLink',
  'paypalUsername',
  'transferClabe',
  'transferInstructions',
] as const;

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

function isStorefrontSettingsRecord(value: unknown): value is Partial<StorefrontSettings> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return STOREFRONT_SETTINGS_FIELD_KEYS.some((key) => key in value);
}

function getRecordValue(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return (value as Record<string, unknown>)[key];
}

function getSnapshotFromBrandMap(brand: Brand, value: unknown) {
  const candidate = getRecordValue(value, brand);
  return isStorefrontSettingsRecord(candidate) ? candidate : null;
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

function dispatchStorefrontSettingsChanged(brand: Brand) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(STOREFRONT_SETTINGS_CHANGED_EVENT, {
      detail: { brand },
    })
  );
}

function resolveStorefrontSettingsSnapshot(
  brand: Brand,
  snapshot: StorefrontSettingsRemoteSnapshot
): Partial<StorefrontSettings> | null {
  if (isStorefrontSettingsRecord(snapshot)) {
    return snapshot;
  }

  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return null;
  }

  const topLevelBrandSnapshot = getSnapshotFromBrandMap(brand, snapshot);
  if (topLevelBrandSnapshot) {
    return topLevelBrandSnapshot;
  }

  const nestedCandidates = [
    getRecordValue(snapshot, 'brands'),
    getRecordValue(snapshot, 'byBrand'),
    getRecordValue(snapshot, 'data'),
    getRecordValue(snapshot, 'settings'),
    getRecordValue(snapshot, 'storefrontSettings'),
    getRecordValue(snapshot, 'snapshot'),
  ];

  for (const candidate of nestedCandidates) {
    if (isStorefrontSettingsRecord(candidate)) {
      const snapshotBrand = getRecordValue(snapshot, 'brand');
      if (!snapshotBrand || snapshotBrand === brand) {
        return candidate;
      }
    }

    const nestedBrandSnapshot = getSnapshotFromBrandMap(brand, candidate);
    if (nestedBrandSnapshot) {
      return nestedBrandSnapshot;
    }
  }

  return null;
}

function writeStorefrontSettingsCache(
  brand: Brand,
  settings: StorefrontSettings,
  shouldPersist = true
) {
  if (canUseLocalStorage() && shouldPersist) {
    localStorage.setItem(getStorefrontSettingsStorageKey(brand), JSON.stringify(settings));
  }

  dispatchStorefrontSettingsChanged(brand);
  return settings;
}

function clearStorefrontSettingsCache(brand: Brand) {
  const defaultSettings = getDefaultStorefrontSettings(brand);

  if (canUseLocalStorage()) {
    localStorage.removeItem(getStorefrontSettingsStorageKey(brand));
  }

  dispatchStorefrontSettingsChanged(brand);
  return defaultSettings;
}

async function readRemoteSyncResponse(response: Response) {
  const rawText = await response.text();

  if (!rawText.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawText) as StorefrontSettingsRemoteSnapshot;
  } catch {
    return null;
  }
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

export function hydrateStorefrontSettingsCache(
  brand: Brand,
  snapshot: StorefrontSettingsRemoteSnapshot
) {
  const parsedSnapshot = resolveStorefrontSettingsSnapshot(brand, snapshot);

  if (!parsedSnapshot) {
    return readStorefrontSettings(brand);
  }

  const nextSettings = normalizeSettings(brand, {
    ...readStorefrontSettings(brand),
    ...parsedSnapshot,
  });

  return writeStorefrontSettingsCache(brand, nextSettings);
}

export function replaceStorefrontSettingsCache(
  brand: Brand,
  snapshot: StorefrontSettingsRemoteSnapshot
) {
  const parsedSnapshot = resolveStorefrontSettingsSnapshot(brand, snapshot);

  if (!parsedSnapshot) {
    return clearStorefrontSettingsCache(brand);
  }

  return writeStorefrontSettingsCache(brand, normalizeSettings(brand, parsedSnapshot));
}

export function saveStorefrontSettings(brand: Brand, settings: Partial<StorefrontSettings>) {
  const nextSettings = normalizeSettings(brand, {
    ...readStorefrontSettings(brand),
    ...settings,
  });

  return writeStorefrontSettingsCache(brand, nextSettings, canUseLocalStorage());
}

export async function saveStorefrontSettingsRemotely(
  brand: Brand,
  settings: Partial<StorefrontSettings>,
  options: StorefrontSettingsRemoteSyncOptions = {}
): Promise<StorefrontSettingsRemoteSyncResult> {
  const nextSettings = normalizeSettings(brand, {
    ...readStorefrontSettings(brand),
    ...settings,
  });
  const endpoint = getTrimmedString(options.endpoint) || STOREFRONT_SETTINGS_REMOTE_SYNC_ENDPOINT;
  const fetcher = options.fetcher ?? (typeof fetch === 'function' ? fetch : null);

  if (!endpoint || !fetcher) {
    return {
      settings: saveStorefrontSettings(brand, nextSettings),
      persistedRemotely: false,
      usedLocalFallback: true,
    };
  }

  try {
    const response = await fetcher(endpoint, {
      ...options.requestInit,
      method: options.method || 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify({
        brand,
        settings: nextSettings,
      }),
    });

    if (!response.ok) {
      throw new Error(`Remote storefront settings sync failed with status ${response.status}`);
    }

    const remoteSnapshot = await readRemoteSyncResponse(response);
    const persistedSettings = replaceStorefrontSettingsCache(
      brand,
      remoteSnapshot ?? nextSettings
    );

    return {
      settings: persistedSettings,
      persistedRemotely: true,
      usedLocalFallback: false,
      response,
    };
  } catch (error) {
    return {
      settings: saveStorefrontSettings(brand, nextSettings),
      persistedRemotely: false,
      usedLocalFallback: true,
      error,
    };
  }
}
