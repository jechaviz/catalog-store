import type { Brand } from '@/contexts/BrandContext';
import { hydrateLocalCatalogOverridesFromSnapshot } from '@/lib/adminCatalogStorage';
import { hydrateLocalCategoryOverridesFromRemoteSnapshot } from '@/lib/adminCategoryStorage';
import {
  hydrateStorefrontSettingsCache,
  type StorefrontSettings,
} from '@/lib/storefrontSettings';

const DEFAULT_SNAPSHOT_PATHS = [
  '/api/storefront-state/{brand}',
  '/api/storefront/snapshot',
  '/api/storefront-state',
  '/api/storefront/{brand}/snapshot',
] as const;
const PRODUCT_COLLECTION_KEYS = ['products', 'items', 'list', 'localProducts', 'overrides'] as const;
const PRODUCT_DELETED_KEYS = [
  'deletedProductIds',
  'deletedIds',
  'removedProductIds',
  'hiddenProductIds',
] as const;
const SETTINGS_KEYS = ['settings', 'storefrontSettings', 'branding', 'brandSettings'] as const;
const CATEGORY_KEYS = ['categories', 'storefrontCategories', 'categoryOverrides'] as const;
const PRODUCT_KEYS = ['products', 'productOverrides', 'catalogProducts'] as const;
const SETTINGS_FIELD_KEYS = [
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
const API_UNAVAILABLE_RETRY_MS = 60_000;

type RemoteSnapshotRecord = Record<string, unknown>;

export interface StorefrontRemoteHydrationResult {
  status: 'applied' | 'noop' | 'unavailable' | 'error';
  appliedSettings: boolean;
  appliedCategories: boolean;
  appliedProducts: boolean;
  endpoint?: string;
  reason?: string;
  error?: unknown;
}

let preferredSnapshotPath: string | null = null;
let skipRemoteUntil = 0;
let warnedMissingApi = false;

function isRecord(value: unknown): value is RemoteSnapshotRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function looksLikeHtmlDocument(value: string) {
  const trimmedValue = value.trim().toLowerCase();
  return (
    trimmedValue.startsWith('<!doctype html') ||
    trimmedValue.startsWith('<html') ||
    trimmedValue.startsWith('<head') ||
    trimmedValue.startsWith('<body')
  );
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

function toTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function toStringList(value: unknown) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,;|]+/g)
      : [];

  return uniqueStrings(
    rawValues
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry.trim();
        }

        if (typeof entry === 'number' && Number.isFinite(entry)) {
          return String(entry);
        }

        return '';
      })
      .filter((entry) => entry.length > 0),
  );
}

function buildEndpointUrl(pathTemplate: string, brand: Brand) {
  const normalizedTemplate = pathTemplate.includes('{brand}')
    ? pathTemplate.replaceAll('{brand}', brand)
    : pathTemplate;
  const url = new URL(normalizedTemplate, window.location.origin);

  if (!normalizedTemplate.includes('{brand}') && !url.searchParams.has('brand')) {
    url.searchParams.set('brand', brand);
  }

  return url.toString();
}

function getSnapshotPathCandidates() {
  const envPath = toTrimmedString(import.meta.env.VITE_STOREFRONT_SNAPSHOT_URL);

  return uniqueStrings([
    ...(envPath ? [envPath] : []),
    ...DEFAULT_SNAPSHOT_PATHS,
  ]);
}

async function readJsonResponse(response: Response) {
  const rawBody = await response.text();

  if (!rawBody.trim()) {
    return null;
  }

  if (looksLikeHtmlDocument(rawBody)) {
    throw new Error('Expected JSON but received HTML.');
  }

  return JSON.parse(rawBody) as unknown;
}

async function fetchSnapshotPayload(
  brand: Brand,
  signal?: AbortSignal,
): Promise<{ payload: unknown; endpoint: string } | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const now = Date.now();

  if (!preferredSnapshotPath && now < skipRemoteUntil) {
    return null;
  }

  const pathCandidates = getSnapshotPathCandidates();
  const orderedCandidates = preferredSnapshotPath
    ? [preferredSnapshotPath, ...pathCandidates.filter((path) => path !== preferredSnapshotPath)]
    : pathCandidates;

  for (const pathTemplate of orderedCandidates) {
    const endpoint = buildEndpointUrl(pathTemplate, brand);

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'same-origin',
        signal,
      });

      if (response.status === 404 || response.status === 405) {
        continue;
      }

      if (!response.ok) {
        throw new Error(`Snapshot request failed with status ${response.status}.`);
      }

      const payload = await readJsonResponse(response);

      if (!payload || !isRecord(payload)) {
        preferredSnapshotPath = pathTemplate;
        warnedMissingApi = false;
        return null;
      }

      preferredSnapshotPath = pathTemplate;
      skipRemoteUntil = 0;
      warnedMissingApi = false;
      return { payload, endpoint };
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      if (error instanceof SyntaxError) {
        continue;
      }

      if (error instanceof Error && error.message === 'Expected JSON but received HTML.') {
        continue;
      }

      throw error;
    }
  }

  preferredSnapshotPath = null;
  skipRemoteUntil = Date.now() + API_UNAVAILABLE_RETRY_MS;

  if (!warnedMissingApi) {
    console.info('Storefront snapshot API is not available; keeping local storefront state.');
    warnedMissingApi = true;
  }

  return null;
}

function collectSnapshotRoots(payload: unknown) {
  const roots: RemoteSnapshotRecord[] = [];
  const queue: unknown[] = [payload];
  const seen = new Set<RemoteSnapshotRecord>();

  while (queue.length > 0) {
    const current = queue.shift();

    if (!isRecord(current) || seen.has(current)) {
      continue;
    }

    seen.add(current);
    roots.push(current);

    if (isRecord(current.snapshot)) {
      queue.push(current.snapshot);
    }

    if (isRecord(current.data)) {
      queue.push(current.data);
    }

    if (isRecord(current.storefront)) {
      queue.push(current.storefront);
    }

    if (isRecord(current.catalog)) {
      queue.push(current.catalog);
    }

    if (isRecord(current.result)) {
      queue.push(current.result);
    }
  }

  return roots;
}

function hasAnySettingsField(value: unknown): value is Partial<StorefrontSettings> {
  return isRecord(value) && SETTINGS_FIELD_KEYS.some((key) => key in value);
}

function extractSettingsPayload(roots: RemoteSnapshotRecord[]) {
  for (const root of roots) {
    for (const key of SETTINGS_KEYS) {
      const candidate = root[key];

      if (hasAnySettingsField(candidate)) {
        return candidate;
      }
    }

    if (hasAnySettingsField(root)) {
      return root;
    }
  }

  return null;
}

function extractCategoryPayload(roots: RemoteSnapshotRecord[]) {
  for (const root of roots) {
    for (const key of CATEGORY_KEYS) {
      const candidate = root[key];

      if (Array.isArray(candidate)) {
        return { categories: candidate, deletedCategoryIds: [] };
      }

      if (isRecord(candidate)) {
        return candidate;
      }
    }

    if (Array.isArray(root.categories)) {
      return { categories: root.categories, deletedCategoryIds: [] };
    }
  }

  return null;
}

function normalizeProductPayload(value: unknown) {
  if (Array.isArray(value)) {
    return {
      products: value,
      deletedProductIds: [],
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  const products = PRODUCT_COLLECTION_KEYS.flatMap((key) =>
    Array.isArray(value[key]) ? value[key] : [],
  );
  const deletedProductIds = uniqueStrings(
    PRODUCT_DELETED_KEYS.flatMap((key) => toStringList(value[key])),
  );

  if (products.length === 0 && deletedProductIds.length === 0) {
    return null;
  }

  return {
    products,
    deletedProductIds,
  };
}

function extractProductPayload(roots: RemoteSnapshotRecord[]) {
  for (const root of roots) {
    for (const key of PRODUCT_KEYS) {
      const candidate = normalizeProductPayload(root[key]);

      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

export async function hydrateStorefrontRemoteState(
  brand: Brand,
  options: { signal?: AbortSignal } = {},
): Promise<StorefrontRemoteHydrationResult> {
  try {
    const response = await fetchSnapshotPayload(brand, options.signal);

    if (!response) {
      return {
        status: skipRemoteUntil > Date.now() ? 'unavailable' : 'noop',
        appliedSettings: false,
        appliedCategories: false,
        appliedProducts: false,
        reason: 'snapshot-unavailable',
      };
    }

    const roots = collectSnapshotRoots(response.payload);
    const settingsPayload = extractSettingsPayload(roots);
    const categoryPayload = extractCategoryPayload(roots);
    const productPayload = extractProductPayload(roots);

    const appliedSettings = Boolean(settingsPayload);
    const appliedCategories = Boolean(categoryPayload);
    const appliedProducts = Boolean(productPayload);

    if (settingsPayload) {
      hydrateStorefrontSettingsCache(brand, settingsPayload);
    }

    if (categoryPayload) {
      hydrateLocalCategoryOverridesFromRemoteSnapshot(brand, categoryPayload);
    }

    if (productPayload) {
      hydrateLocalCatalogOverridesFromSnapshot(brand, productPayload);
    }

    return {
      status: appliedSettings || appliedCategories || appliedProducts ? 'applied' : 'noop',
      appliedSettings,
      appliedCategories,
      appliedProducts,
      endpoint: response.endpoint,
      reason:
        appliedSettings || appliedCategories || appliedProducts
          ? undefined
          : 'snapshot-did-not-contain-supported-sections',
    };
  } catch (error) {
    if (isAbortError(error)) {
      return {
        status: 'noop',
        appliedSettings: false,
        appliedCategories: false,
        appliedProducts: false,
        reason: 'aborted',
      };
    }

    console.warn(`Failed to hydrate storefront snapshot for ${brand}.`, error);

    return {
      status: 'error',
      appliedSettings: false,
      appliedCategories: false,
      appliedProducts: false,
      error,
    };
  }
}
