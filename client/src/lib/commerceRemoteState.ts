import type { Brand } from '@/contexts/BrandContext';
import {
  getOrdersRemotePayload,
  hydrateOrdersFromRemoteSnapshot,
} from '@/lib/orderStorage';
import { normalizeStorageScopeId } from '@/lib/storageScope';
import {
  getBrandCartRemotePayload,
  getBrandLikesRemotePayload,
  hydrateCartFromRemoteSnapshot,
  hydrateLikesFromRemoteSnapshot,
} from '@/lib/storefrontStorage';

const SNAPSHOT_PATHS = [
  '/api/customer-state/{brand}/{scopeId}',
  '/api/customer-state/{brand}?scopeId={scopeId}',
  '/api/customer-state?brand={brand}&scopeId={scopeId}',
] as const;
const RESOURCE_PATHS = [
  '/api/customer-state/{brand}/{scopeId}/{resource}',
  '/api/customer-state/{brand}/{resource}?scopeId={scopeId}',
  '/api/customer-state?brand={brand}&scopeId={scopeId}&resource={resource}',
] as const;
const API_UNAVAILABLE_RETRY_MS = 60_000;

type CommerceResource = 'orders' | 'likes' | 'cart';
type RemoteSnapshotRecord = Record<string, unknown>;

export interface CommerceRemoteHydrationResult {
  status: 'applied' | 'noop' | 'unavailable' | 'error';
  appliedOrders: boolean;
  appliedLikes: boolean;
  appliedCart: boolean;
  endpoint?: string;
  reason?: string;
  error?: unknown;
}

let preferredSnapshotPath: string | null = null;
let preferredResourcePath: string | null = null;
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

function buildEndpointUrl(
  pathTemplate: string,
  brand: Brand,
  scopeId: string,
  resource?: CommerceResource,
) {
  const normalizedTemplate = pathTemplate
    .replaceAll('{brand}', brand)
    .replaceAll('{scopeId}', scopeId)
    .replaceAll('{resource}', resource || '');
  const url = new URL(normalizedTemplate, window.location.origin);

  if (!normalizedTemplate.includes('{brand}') && !url.searchParams.has('brand')) {
    url.searchParams.set('brand', brand);
  }

  if (!normalizedTemplate.includes('{scopeId}') && !url.searchParams.has('scopeId')) {
    url.searchParams.set('scopeId', scopeId);
  }

  if (resource && !normalizedTemplate.includes('{resource}') && !url.searchParams.has('resource')) {
    url.searchParams.set('resource', resource);
  }

  return url.toString();
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
  scopeId: string,
  signal?: AbortSignal,
): Promise<{ payload: unknown; endpoint: string } | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const now = Date.now();

  if (!preferredSnapshotPath && now < skipRemoteUntil) {
    return null;
  }

  const orderedCandidates = preferredSnapshotPath
    ? [preferredSnapshotPath, ...SNAPSHOT_PATHS.filter((path) => path !== preferredSnapshotPath)]
    : [...SNAPSHOT_PATHS];

  for (const pathTemplate of orderedCandidates) {
    const endpoint = buildEndpointUrl(pathTemplate, brand, scopeId);

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
        throw new Error(`Customer snapshot request failed with status ${response.status}.`);
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
    console.info('Customer state API is not available; keeping local commerce state.');
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

    if (isRecord(current.result)) {
      queue.push(current.result);
    }
  }

  return roots;
}

function extractCollectionPayload(roots: RemoteSnapshotRecord[], key: CommerceResource) {
  for (const root of roots) {
    const candidate = root[key];

    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getCollectionCount(brand: Brand, resource: CommerceResource, payload: unknown) {
  const collection = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)[resource]
      : null;

  if (!Array.isArray(collection)) {
    return 0;
  }

  switch (resource) {
    case 'orders':
      return collection.filter((order) => (
        isRecord(order) &&
        order.brand === brand &&
        typeof order.id === 'string' &&
        typeof order.createdAt === 'string' &&
        typeof order.status === 'string' &&
        Array.isArray(order.items)
      )).length;
    case 'likes':
      return collection.filter((value) => typeof value === 'string' && value.trim().length > 0).length;
    case 'cart':
      return collection.filter((item) => {
        if (!isRecord(item) || typeof item.quantity !== 'number' || item.quantity <= 0) {
          return false;
        }

        const product = item.product;

        return (
          isRecord(product) &&
          typeof product.id === 'string' &&
          typeof product.brand === 'string' &&
          product.brand.trim().toLowerCase() === brand
        );
      }).length;
    default:
      return collection.length;
  }
}

function getRemotePayload(brand: Brand, userId: string | null | undefined, resource: CommerceResource) {
  switch (resource) {
    case 'orders':
      return getOrdersRemotePayload(brand, userId);
    case 'likes':
      return getBrandLikesRemotePayload(brand, userId);
    case 'cart':
      return getBrandCartRemotePayload(brand, userId);
    default:
      return null;
  }
}

async function persistResource(
  brand: Brand,
  scopeId: string,
  resource: CommerceResource,
  payload: unknown,
) {
  const orderedCandidates = preferredResourcePath
    ? [preferredResourcePath, ...RESOURCE_PATHS.filter((path) => path !== preferredResourcePath)]
    : [...RESOURCE_PATHS];

  for (const pathTemplate of orderedCandidates) {
    const endpoint = buildEndpointUrl(pathTemplate, brand, scopeId, resource);

    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });

      if (response.status === 404 || response.status === 405) {
        continue;
      }

      if (!response.ok) {
        throw new Error(`Customer ${resource} sync failed with status ${response.status}.`);
      }

      preferredResourcePath = pathTemplate;
      skipRemoteUntil = 0;
      warnedMissingApi = false;
      return true;
    } catch (error) {
      if (error instanceof Error && error.message === 'Expected JSON but received HTML.') {
        continue;
      }

      if (error instanceof SyntaxError) {
        continue;
      }

      throw error;
    }
  }

  preferredResourcePath = null;
  skipRemoteUntil = Date.now() + API_UNAVAILABLE_RETRY_MS;

  if (!warnedMissingApi) {
    console.info('Customer state API is not available for writes; keeping local commerce state.');
    warnedMissingApi = true;
  }

  return false;
}

export async function hydrateCustomerRemoteState(
  brand: Brand,
  userId?: string | null,
  options: { signal?: AbortSignal } = {},
): Promise<CommerceRemoteHydrationResult> {
  const scopeId = normalizeStorageScopeId(userId);

  try {
    const response = await fetchSnapshotPayload(brand, scopeId, options.signal);

    if (!response) {
      return {
        status: skipRemoteUntil > Date.now() ? 'unavailable' : 'noop',
        appliedOrders: false,
        appliedLikes: false,
        appliedCart: false,
        reason: 'snapshot-unavailable',
      };
    }

    const roots = collectSnapshotRoots(response.payload);
    const ordersPayload = extractCollectionPayload(roots, 'orders');
    const likesPayload = extractCollectionPayload(roots, 'likes');
    const cartPayload = extractCollectionPayload(roots, 'cart');
    const localOrdersPayload = getOrdersRemotePayload(brand, userId);
    const localLikesPayload = getBrandLikesRemotePayload(brand, userId);
    const localCartPayload = getBrandCartRemotePayload(brand, userId);
    const resourcesToBackfill: CommerceResource[] = [];
    const remoteOrdersCount = getCollectionCount(brand, 'orders', ordersPayload);
    const remoteLikesCount = getCollectionCount(brand, 'likes', likesPayload);
    const remoteCartCount = getCollectionCount(brand, 'cart', cartPayload);
    const localOrdersCount = getCollectionCount(brand, 'orders', localOrdersPayload);
    const localLikesCount = getCollectionCount(brand, 'likes', localLikesPayload);
    const localCartCount = getCollectionCount(brand, 'cart', localCartPayload);
    const shouldApplyOrders =
      Array.isArray(ordersPayload) &&
      (remoteOrdersCount > 0 || localOrdersCount === 0);
    const shouldApplyLikes =
      Array.isArray(likesPayload) &&
      (remoteLikesCount > 0 || localLikesCount === 0);
    const shouldApplyCart =
      Array.isArray(cartPayload) &&
      (remoteCartCount > 0 || localCartCount === 0);
    const appliedOrders = shouldApplyOrders;
    const appliedLikes = shouldApplyLikes;
    const appliedCart = shouldApplyCart;

    if (shouldApplyOrders && ordersPayload) {
      hydrateOrdersFromRemoteSnapshot(brand, { orders: ordersPayload }, userId);
    } else if (localOrdersCount > 0) {
      resourcesToBackfill.push('orders');
    }

    if (shouldApplyLikes && likesPayload) {
      hydrateLikesFromRemoteSnapshot(brand, { likes: likesPayload }, userId);
    } else if (localLikesCount > 0) {
      resourcesToBackfill.push('likes');
    }

    if (shouldApplyCart && cartPayload) {
      hydrateCartFromRemoteSnapshot(brand, { cart: cartPayload }, userId);
    } else if (localCartCount > 0) {
      resourcesToBackfill.push('cart');
    }

    if (resourcesToBackfill.length > 0) {
      void syncCustomerRemoteState(brand, userId, resourcesToBackfill).catch((error) => {
        console.warn(`Failed to backfill customer state for ${brand}/${scopeId}.`, error);
      });
    }

    return {
      status:
        appliedOrders || appliedLikes || appliedCart || resourcesToBackfill.length > 0
          ? 'applied'
          : 'noop',
      appliedOrders,
      appliedLikes,
      appliedCart,
      endpoint: response.endpoint,
      reason:
        appliedOrders || appliedLikes || appliedCart || resourcesToBackfill.length > 0
          ? undefined
          : 'snapshot-did-not-contain-supported-sections',
    };
  } catch (error) {
    if (isAbortError(error)) {
      return {
        status: 'noop',
        appliedOrders: false,
        appliedLikes: false,
        appliedCart: false,
        reason: 'aborted',
      };
    }

    console.warn(`Failed to hydrate customer state for ${brand}/${scopeId}.`, error);

    return {
      status: 'error',
      appliedOrders: false,
      appliedLikes: false,
      appliedCart: false,
      error,
    };
  }
}

export async function syncCustomerRemoteState(
  brand: Brand,
  userId?: string | null,
  resources: CommerceResource[] = ['orders', 'likes', 'cart'],
) {
  if (typeof window === 'undefined') {
    return false;
  }

  if (!preferredResourcePath && Date.now() < skipRemoteUntil) {
    return false;
  }

  const scopeId = normalizeStorageScopeId(userId);
  const uniqueResources = uniqueStrings(resources) as CommerceResource[];
  let syncedAtLeastOne = false;

  for (const resource of uniqueResources) {
    const payload = getRemotePayload(brand, userId, resource);

    if (!payload) {
      continue;
    }

    const didSync = await persistResource(brand, scopeId, resource, payload);
    syncedAtLeastOne = syncedAtLeastOne || didSync;
  }

  return syncedAtLeastOne;
}
