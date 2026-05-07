import {
  STOREFRONT_BRANDS,
  type CatalogProduct,
  type StorefrontBrand,
} from "./storefrontState";

export const CUSTOMER_STATE_SCOPE_GUEST = "guest";

export type CustomerStateBrand = StorefrontBrand;
export type CustomerOrderStatus =
  | "pending"
  | "processing"
  | "paid"
  | "shipped"
  | "delivered";
export type CustomerPaymentMethod =
  | "whatsapp_cash"
  | "transfer"
  | "connectia"
  | "paypal";
export type CustomerStateResourceKey = "orders" | "likes" | "cart";

export interface CustomerStateResourceMetaEntry {
  count: number;
  updatedAt: string | null;
}

export interface CustomerStateResourceMeta {
  orders: CustomerStateResourceMetaEntry;
  likes: CustomerStateResourceMetaEntry;
  cart: CustomerStateResourceMetaEntry;
}

export interface CustomerCartItem {
  product: CatalogProduct;
  quantity: number;
}

export interface CustomerOrderItem {
  productId: string;
  name: string;
  brand: string;
  subBrand: string;
  imageUrl: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  productSnapshot: CatalogProduct;
}

export interface CustomerOrderRecord {
  id: string;
  brand: CustomerStateBrand;
  createdAt: string;
  updatedAt: string;
  status: CustomerOrderStatus;
  paymentMethod: CustomerPaymentMethod;
  subtotal: number;
  shippingCost: number;
  total: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: CustomerOrderItem[];
  carrier?: string;
  trackingNumber?: string;
  notes?: string;
}

export interface CustomerStateSnapshot {
  brand: CustomerStateBrand;
  scopeId: string;
  likes: string[];
  cart: CustomerCartItem[];
  orders: CustomerOrderRecord[];
  updatedAt: string | null;
  resourceMeta: CustomerStateResourceMeta;
}

export interface CustomerStateFile {
  version: number;
  brands: Partial<Record<CustomerStateBrand, Record<string, CustomerStateSnapshot>>>;
  updatedAt: string | null;
}

const ORDER_STATUS_VALUES: readonly CustomerOrderStatus[] = [
  "pending",
  "processing",
  "paid",
  "shipped",
  "delivered",
] as const;
const PAYMENT_METHOD_VALUES: readonly CustomerPaymentMethod[] = [
  "whatsapp_cash",
  "transfer",
  "connectia",
  "paypal",
] as const;
const CUSTOMER_STATE_RESOURCE_KEYS: readonly CustomerStateResourceKey[] = [
  "orders",
  "likes",
  "cart",
] as const;
const MAX_TEXT_LENGTH = 4000;
const MAX_SHORT_TEXT_LENGTH = 250;
const MAX_URL_LENGTH = 2048;
const MAX_LIST_ITEMS = 250;

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeText(value: unknown, fallbackValue = "", maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") {
    return fallbackValue;
  }

  const normalized = normalizeWhitespace(value);
  return normalized.slice(0, maxLength) || fallbackValue;
}

function normalizeOptionalText(value: unknown, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") {
    return "";
  }

  return normalizeWhitespace(value).slice(0, maxLength);
}

function normalizePhone(value: unknown, fallbackValue = "") {
  const digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
  return digits.slice(0, 20) || fallbackValue;
}

function normalizeBoolean(value: unknown, fallbackValue: boolean) {
  return typeof value === "boolean" ? value : fallbackValue;
}

function normalizeId(value: unknown) {
  return normalizeOptionalText(value, MAX_SHORT_TEXT_LENGTH);
}

function normalizeOptionalUrl(value: unknown, fallbackValue = "") {
  if (typeof value !== "string") {
    return fallbackValue;
  }

  const normalized = value.trim().slice(0, MAX_URL_LENGTH);

  if (!normalized) {
    return fallbackValue;
  }

  if (/^(javascript|vbscript):/i.test(normalized)) {
    return fallbackValue;
  }

  if (
    normalized.startsWith("/") ||
    normalized.startsWith("./") ||
    normalized.startsWith("../") ||
    normalized.startsWith("#")
  ) {
    return normalized;
  }

  try {
    const parsed = new URL(normalized);
    return ["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol)
      ? normalized
      : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function normalizePrice(value: unknown, fallbackValue = 0) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : fallbackValue;
}

function normalizeQuantity(value: unknown, fallbackValue = 1) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.trunc(numericValue) : fallbackValue;
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function createDefaultCustomerStateResourceMeta(): CustomerStateResourceMeta {
  return {
    orders: {
      count: 0,
      updatedAt: null,
    },
    likes: {
      count: 0,
      updatedAt: null,
    },
    cart: {
      count: 0,
      updatedAt: null,
    },
  };
}

function getCustomerStateResourceCount(
  snapshot: Pick<CustomerStateSnapshot, CustomerStateResourceKey>,
  resource: CustomerStateResourceKey,
) {
  return snapshot[resource].length;
}

function normalizeCustomerStateResourceMeta(
  value: unknown,
  snapshot: Pick<CustomerStateSnapshot, CustomerStateResourceKey | "updatedAt">,
  fallbackValue?: CustomerStateResourceMeta,
): CustomerStateResourceMeta {
  const candidate = isRecord(value) ? value : {};
  const baseMeta = fallbackValue ?? createDefaultCustomerStateResourceMeta();
  const nextMeta = createDefaultCustomerStateResourceMeta();

  for (const resource of CUSTOMER_STATE_RESOURCE_KEYS) {
    const resourceCandidate = isRecord(candidate[resource]) ? candidate[resource] : {};
    const resourceCount = getCustomerStateResourceCount(snapshot, resource);
    const explicitUpdatedAt = normalizeTimestamp(resourceCandidate.updatedAt);

    nextMeta[resource] = {
      count: resourceCount,
      updatedAt:
        explicitUpdatedAt ??
        baseMeta[resource].updatedAt ??
        (resourceCount > 0 ? snapshot.updatedAt : null),
    };
  }

  return nextMeta;
}

function normalizeStringList(value: unknown, maxItems = MAX_LIST_ITEMS) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,;|]+/g)
      : [];

  return Array.from(
    new Set(
      rawValues
        .map((item) => normalizeOptionalText(item, MAX_SHORT_TEXT_LENGTH))
        .filter((item) => item.length > 0),
    ),
  ).slice(0, maxItems);
}

function normalizeGender(
  value: unknown,
  fallbackValue: CatalogProduct["gender"] = "unisex",
): CatalogProduct["gender"] {
  return value === "female" || value === "male" || value === "unisex"
    ? value
    : fallbackValue;
}

function normalizeCatalogProduct(
  brand: CustomerStateBrand,
  value: unknown,
  fallbackValue?: CatalogProduct,
): CatalogProduct | null {
  if (!value || typeof value !== "object") {
    return fallbackValue ?? null;
  }

  const candidate = value as Record<string, unknown>;
  const id = normalizeId(candidate.id ?? fallbackValue?.id);
  const name = normalizeText(candidate.name ?? fallbackValue?.name, "");

  if (!id || !name) {
    return fallbackValue ?? null;
  }

  const paymentLink = normalizeOptionalUrl(
    candidate.paymentLink ?? fallbackValue?.paymentLink,
    "",
  );

  return {
    id,
    name,
    brand: normalizeText(
      candidate.brand ?? fallbackValue?.brand,
      brand === "nikken" ? "Nikken" : "Natura",
      MAX_SHORT_TEXT_LENGTH,
    ),
    subBrand: normalizeOptionalText(candidate.subBrand ?? fallbackValue?.subBrand, MAX_SHORT_TEXT_LENGTH),
    categoryId: normalizeId(candidate.categoryId ?? fallbackValue?.categoryId) || "uncategorized",
    gender: normalizeGender(candidate.gender, fallbackValue?.gender ?? "unisex"),
    description: normalizeOptionalText(candidate.description ?? fallbackValue?.description),
    benefits: normalizeStringList(candidate.benefits ?? fallbackValue?.benefits, 50),
    price: normalizePrice(candidate.price, fallbackValue?.price ?? 0),
    imageUrl: normalizeOptionalUrl(candidate.imageUrl ?? fallbackValue?.imageUrl, fallbackValue?.imageUrl ?? ""),
    inStock: normalizeBoolean(candidate.inStock, fallbackValue?.inStock ?? true),
    ...(paymentLink ? { paymentLink } : {}),
    deliveryTime: normalizeOptionalText(
      candidate.deliveryTime ?? fallbackValue?.deliveryTime,
      MAX_SHORT_TEXT_LENGTH,
    ),
    deliveryMethods: normalizeStringList(candidate.deliveryMethods ?? fallbackValue?.deliveryMethods, 20),
  };
}

function normalizeCustomerCartItem(
  brand: CustomerStateBrand,
  value: unknown,
): CustomerCartItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const product = normalizeCatalogProduct(brand, candidate.product);

  if (!product) {
    return null;
  }

  return {
    product,
    quantity: normalizeQuantity(candidate.quantity, 1),
  };
}

function normalizeCustomerOrderItem(
  brand: CustomerStateBrand,
  value: unknown,
): CustomerOrderItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const productSnapshot = normalizeCatalogProduct(brand, candidate.productSnapshot);
  const productId = normalizeId(candidate.productId ?? productSnapshot?.id);
  const name = normalizeText(candidate.name ?? productSnapshot?.name, "");

  if (!productId || !name || !productSnapshot) {
    return null;
  }

  const quantity = normalizeQuantity(candidate.quantity, 1);
  const unitPrice = normalizePrice(candidate.unitPrice ?? productSnapshot.price, productSnapshot.price);

  return {
    productId,
    name,
    brand: normalizeText(candidate.brand ?? productSnapshot.brand, productSnapshot.brand, MAX_SHORT_TEXT_LENGTH),
    subBrand: normalizeOptionalText(candidate.subBrand ?? productSnapshot.subBrand, MAX_SHORT_TEXT_LENGTH),
    imageUrl: normalizeOptionalUrl(candidate.imageUrl ?? productSnapshot.imageUrl, productSnapshot.imageUrl),
    quantity,
    unitPrice,
    lineTotal: normalizePrice(candidate.lineTotal, unitPrice * quantity),
    productSnapshot,
  };
}

function normalizeCustomerOrderStatus(
  value: unknown,
  fallbackValue: CustomerOrderStatus = "processing",
) {
  return ORDER_STATUS_VALUES.includes(value as CustomerOrderStatus)
    ? (value as CustomerOrderStatus)
    : fallbackValue;
}

function normalizeCustomerPaymentMethod(
  value: unknown,
  fallbackValue: CustomerPaymentMethod = "whatsapp_cash",
) {
  return PAYMENT_METHOD_VALUES.includes(value as CustomerPaymentMethod)
    ? (value as CustomerPaymentMethod)
    : fallbackValue;
}

function normalizeCustomerOrderRecord(
  brand: CustomerStateBrand,
  value: unknown,
): CustomerOrderRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const id = normalizeId(candidate.id);
  const createdAt = normalizeTimestamp(candidate.createdAt) ?? new Date().toISOString();
  const updatedAt = normalizeTimestamp(candidate.updatedAt) ?? createdAt;
  const items = Array.isArray(candidate.items)
    ? candidate.items
      .map((item) => normalizeCustomerOrderItem(brand, item))
      .filter((item): item is CustomerOrderItem => item !== null)
    : [];

  if (!id || items.length === 0) {
    return null;
  }

  return {
    id,
    brand,
    createdAt,
    updatedAt,
    status: normalizeCustomerOrderStatus(candidate.status),
    paymentMethod: normalizeCustomerPaymentMethod(candidate.paymentMethod),
    subtotal: normalizePrice(candidate.subtotal),
    shippingCost: normalizePrice(candidate.shippingCost),
    total: normalizePrice(candidate.total),
    customerName: normalizeText(candidate.customerName, "", MAX_SHORT_TEXT_LENGTH),
    customerPhone: normalizePhone(candidate.customerPhone),
    customerAddress: normalizeText(candidate.customerAddress),
    items,
    ...(normalizeOptionalText(candidate.carrier, MAX_SHORT_TEXT_LENGTH)
      ? { carrier: normalizeOptionalText(candidate.carrier, MAX_SHORT_TEXT_LENGTH) }
      : {}),
    ...(normalizeOptionalText(candidate.trackingNumber, MAX_SHORT_TEXT_LENGTH)
      ? { trackingNumber: normalizeOptionalText(candidate.trackingNumber, MAX_SHORT_TEXT_LENGTH) }
      : {}),
    ...(normalizeOptionalText(candidate.notes)
      ? { notes: normalizeOptionalText(candidate.notes) }
      : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function looksLikeCustomerSnapshot(value: unknown) {
  return isRecord(value) && ("orders" in value || "likes" in value || "cart" in value || "scopeId" in value);
}

export function normalizeCustomerScopeId(value: unknown) {
  if (typeof value !== "string") {
    return CUSTOMER_STATE_SCOPE_GUEST;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || CUSTOMER_STATE_SCOPE_GUEST;
}

export function createDefaultCustomerStateSnapshot(
  brand: CustomerStateBrand,
  scopeId = CUSTOMER_STATE_SCOPE_GUEST,
): CustomerStateSnapshot {
  return {
    brand,
    scopeId: normalizeCustomerScopeId(scopeId),
    likes: [],
    cart: [],
    orders: [],
    updatedAt: null,
    resourceMeta: createDefaultCustomerStateResourceMeta(),
  };
}

export function sanitizeCustomerStateSnapshot(
  brand: CustomerStateBrand,
  scopeId: string,
  value: Partial<CustomerStateSnapshot> | null | undefined,
  currentSnapshot?: CustomerStateSnapshot,
): CustomerStateSnapshot {
  const baseSnapshot = currentSnapshot ?? createDefaultCustomerStateSnapshot(brand, scopeId);
  const likes = normalizeStringList(value?.likes ?? baseSnapshot.likes, 1000);
  const cart = Array.isArray(value?.cart)
    ? value.cart
      .map((item) => normalizeCustomerCartItem(brand, item))
      .filter((item): item is CustomerCartItem => item !== null)
    : baseSnapshot.cart;
  const orders = Array.isArray(value?.orders)
    ? value.orders
      .map((order) => normalizeCustomerOrderRecord(brand, order))
      .filter((order): order is CustomerOrderRecord => order !== null)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    : baseSnapshot.orders;
  const updatedAt = normalizeTimestamp(value?.updatedAt) ?? baseSnapshot.updatedAt;

  return {
    brand,
    scopeId: normalizeCustomerScopeId(value?.scopeId ?? scopeId),
    likes,
    cart,
    orders,
    updatedAt,
    resourceMeta: normalizeCustomerStateResourceMeta(
      value?.resourceMeta,
      {
        likes,
        cart,
        orders,
        updatedAt,
      },
      baseSnapshot.resourceMeta,
    ),
  };
}

export function createEmptyCustomerStateFile(): CustomerStateFile {
  return {
    version: 1,
    brands: {},
    updatedAt: null,
  };
}

export function sanitizeCustomerStateFile(
  value: unknown,
  currentState?: CustomerStateFile,
): CustomerStateFile {
  const baseState = currentState ?? createEmptyCustomerStateFile();
  const candidate = isRecord(value) ? value : {};
  const rawBrands = isRecord(candidate.brands) ? candidate.brands : {};
  const brands: Partial<Record<CustomerStateBrand, Record<string, CustomerStateSnapshot>>> = {};

  for (const brand of STOREFRONT_BRANDS) {
    const currentScopes = baseState.brands[brand] ?? {};
    const rawBrandValue = rawBrands[brand];
    const rawScopes = looksLikeCustomerSnapshot(rawBrandValue)
      ? { [normalizeCustomerScopeId((rawBrandValue as Partial<CustomerStateSnapshot>).scopeId)]: rawBrandValue }
      : isRecord(rawBrandValue)
        ? rawBrandValue
        : {};
    const scopeSnapshots: Record<string, CustomerStateSnapshot> = {};

    for (const [rawScopeId, rawSnapshot] of Object.entries(rawScopes)) {
      const scopeId = normalizeCustomerScopeId(rawScopeId);
      scopeSnapshots[scopeId] = sanitizeCustomerStateSnapshot(
        brand,
        scopeId,
        isRecord(rawSnapshot) ? (rawSnapshot as Partial<CustomerStateSnapshot>) : undefined,
        currentScopes[scopeId],
      );
    }

    if (Object.keys(scopeSnapshots).length > 0) {
      brands[brand] = scopeSnapshots;
    }
  }

  return {
    version:
      typeof candidate.version === "number" && Number.isFinite(candidate.version)
        ? candidate.version
        : baseState.version,
    brands,
    updatedAt: normalizeTimestamp(candidate.updatedAt) ?? baseState.updatedAt,
  };
}
