export const STOREFRONT_BRANDS = ["natura", "nikken"] as const;

export type StorefrontBrand = (typeof STOREFRONT_BRANDS)[number];

export interface Category {
  id: string;
  name: string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  brand: string;
  subBrand: string;
  categoryId: string;
  gender: "female" | "male" | "unisex";
  description: string;
  benefits: string[];
  price: number;
  imageUrl: string;
  inStock: boolean;
  paymentLink?: string;
  deliveryTime: string;
  deliveryMethods: string[];
}

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

export interface LocalCategoryMetadata {
  sortOrder?: number;
  isHidden?: boolean;
}

export interface LocalCategory extends Category, LocalCategoryMetadata {}

export interface LocalCategoryOverrides {
  categories: LocalCategory[];
  deletedCategoryIds: string[];
  metadataById: Record<string, LocalCategoryMetadata>;
}

export interface LocalCatalogOverrides {
  products: CatalogProduct[];
  deletedProductIds: string[];
}

export interface StorefrontStateSnapshot {
  brand: StorefrontBrand;
  settings: StorefrontSettings;
  categoryOverrides: LocalCategoryOverrides;
  productOverrides: LocalCatalogOverrides;
  updatedAt: string | null;
}

export interface StorefrontStateFile {
  version: number;
  brands: Partial<Record<StorefrontBrand, StorefrontStateSnapshot>>;
  updatedAt: string | null;
}

const DEFAULT_MESSAGE_TEMPLATE = "Hola, me interesa realizar el siguiente pedido:";
const DEFAULT_CONNECTIA_LINK = "https://connectia.mx/tu-tienda";
const DEFAULT_PAYPAL_USERNAME = "tuusuario";
const DEFAULT_TRANSFER_INSTRUCTIONS =
  "Realiza tu transferencia y comparte tu comprobante por WhatsApp para confirmar el pedido.";

const DEFAULT_SETTINGS_BY_BRAND: Record<StorefrontBrand, StorefrontSettings> = {
  natura: {
    siteName: "Natura Catalogo",
    slogan: "Belleza que cuida de ti",
    logoImageUrl: "",
    heroImageUrl: "/perfume_fem.png",
    heroEyebrow: "Catalogo Natura",
    heroDescription:
      "Fragancias, cuidado personal y regalos listos para compartir desde una vitrina simple y confiable.",
    sellerPhone: "",
    sellerMessageTemplate: DEFAULT_MESSAGE_TEMPLATE,
    connectiaPaymentLink: DEFAULT_CONNECTIA_LINK,
    paypalPaymentLink: `https://paypal.me/${DEFAULT_PAYPAL_USERNAME}`,
    paypalUsername: DEFAULT_PAYPAL_USERNAME,
    transferClabe: "",
    transferInstructions: DEFAULT_TRANSFER_INSTRUCTIONS,
  },
  nikken: {
    siteName: "Nikken Wellness Store",
    slogan: "Descubre el bienestar con tecnologia magnetica",
    logoImageUrl: "",
    heroImageUrl: "/assets/nikken/products/100.jpg",
    heroEyebrow: "Bienestar Nikken",
    heroDescription:
      "Soluciones de descanso, confort y estilo de vida para una experiencia de compra mas cercana.",
    sellerPhone: "",
    sellerMessageTemplate: "Hola, me interesa conocer mas sobre estos productos Nikken:",
    connectiaPaymentLink: DEFAULT_CONNECTIA_LINK,
    paypalPaymentLink: `https://paypal.me/${DEFAULT_PAYPAL_USERNAME}`,
    paypalUsername: DEFAULT_PAYPAL_USERNAME,
    transferClabe: "",
    transferInstructions: DEFAULT_TRANSFER_INSTRUCTIONS,
  },
};

const MAX_TEXT_LENGTH = 4000;
const MAX_SHORT_TEXT_LENGTH = 250;
const MAX_URL_LENGTH = 2048;
const MAX_LIST_ITEMS = 50;

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

function normalizeId(value: unknown) {
  return normalizeOptionalText(value, MAX_SHORT_TEXT_LENGTH);
}

function normalizeBoolean(value: unknown, fallbackValue: boolean) {
  return typeof value === "boolean" ? value : fallbackValue;
}

function normalizeOptionalUrl(
  value: unknown,
  fallbackValue = "",
  options: { allowImageData?: boolean } = {},
) {
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

  if (/^data:/i.test(normalized)) {
    return options.allowImageData && /^data:image\//i.test(normalized)
      ? normalized
      : fallbackValue;
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

function normalizePhone(value: unknown, fallbackValue = "") {
  const digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
  return digits.slice(0, 20) || fallbackValue;
}

function normalizePrice(value: unknown, fallbackValue = 0) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : fallbackValue;
}

function normalizeGender(
  value: unknown,
  fallbackValue: CatalogProduct["gender"] = "unisex",
): CatalogProduct["gender"] {
  return value === "female" || value === "male" || value === "unisex"
    ? value
    : fallbackValue;
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

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function extractPaypalUsernameFromLink(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";

  if (!normalized) {
    return "";
  }

  const match = normalized.match(/paypal\.me\/([^/?#]+)/i);
  return normalizeOptionalText(match?.[1], MAX_SHORT_TEXT_LENGTH).replace(/^@+/, "");
}

function normalizeCategoryMetadata(value: unknown): LocalCategoryMetadata {
  if (!value || typeof value !== "object") {
    return {};
  }

  const candidate = value as Record<string, unknown>;
  const rawSortOrder =
    typeof candidate.sortOrder === "number" || typeof candidate.sortOrder === "string"
      ? Number(candidate.sortOrder)
      : typeof candidate.order === "number" || typeof candidate.order === "string"
        ? Number(candidate.order)
        : Number.NaN;
  const sortOrder = Number.isFinite(rawSortOrder) ? Math.trunc(rawSortOrder) : undefined;
  const isHidden = typeof candidate.isHidden === "boolean"
    ? candidate.isHidden
    : typeof candidate.hidden === "boolean"
      ? candidate.hidden
      : undefined;

  return {
    ...(sortOrder !== undefined ? { sortOrder } : {}),
    ...(isHidden === true ? { isHidden: true } : {}),
  };
}

function mergeCategoryMetadata(
  currentMetadata: LocalCategoryMetadata | undefined,
  nextMetadata: LocalCategoryMetadata | undefined,
) {
  return {
    ...(currentMetadata?.sortOrder !== undefined ? { sortOrder: currentMetadata.sortOrder } : {}),
    ...(nextMetadata?.sortOrder !== undefined ? { sortOrder: nextMetadata.sortOrder } : {}),
    ...(currentMetadata?.isHidden === true ? { isHidden: true } : {}),
    ...(nextMetadata?.isHidden === true ? { isHidden: true } : {}),
  } satisfies LocalCategoryMetadata;
}

function hasCategoryMetadata(metadata: LocalCategoryMetadata | undefined) {
  return Boolean(metadata && (metadata.sortOrder !== undefined || metadata.isHidden === true));
}

function sanitizeLocalCategory(value: unknown): LocalCategory | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const id = normalizeId(candidate.id ?? candidate.categoryId ?? candidate.key);
  const name = normalizeText(candidate.name ?? candidate.label ?? candidate.title, "");

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    ...normalizeCategoryMetadata(candidate),
  };
}

function sanitizeCatalogProduct(
  brand: StorefrontBrand,
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
    benefits: normalizeStringList(candidate.benefits ?? fallbackValue?.benefits),
    price: normalizePrice(candidate.price, fallbackValue?.price ?? 0),
    imageUrl: normalizeOptionalUrl(
      candidate.imageUrl ?? fallbackValue?.imageUrl,
      fallbackValue?.imageUrl ?? "",
      { allowImageData: true },
    ),
    inStock: normalizeBoolean(candidate.inStock, fallbackValue?.inStock ?? true),
    ...(paymentLink ? { paymentLink } : {}),
    deliveryTime: normalizeOptionalText(
      candidate.deliveryTime ?? fallbackValue?.deliveryTime,
      MAX_SHORT_TEXT_LENGTH,
    ),
    deliveryMethods: normalizeStringList(candidate.deliveryMethods ?? fallbackValue?.deliveryMethods),
  };
}

export function isStorefrontBrand(value: unknown): value is StorefrontBrand {
  return typeof value === "string" && STOREFRONT_BRANDS.includes(value as StorefrontBrand);
}

export function normalizeStorefrontBrand(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return isStorefrontBrand(normalized) ? normalized : null;
}

export function getDefaultStorefrontSettings(brand: StorefrontBrand): StorefrontSettings {
  return { ...DEFAULT_SETTINGS_BY_BRAND[brand] };
}

export function sanitizeStorefrontSettings(
  brand: StorefrontBrand,
  value: Partial<StorefrontSettings> | undefined,
  currentSettings?: StorefrontSettings,
): StorefrontSettings {
  const defaults = currentSettings ?? getDefaultStorefrontSettings(brand);
  const paypalUsername =
    normalizeOptionalText(value?.paypalUsername, MAX_SHORT_TEXT_LENGTH).replace(/^@+/, "") ||
    extractPaypalUsernameFromLink(value?.paypalPaymentLink) ||
    defaults.paypalUsername;

  return {
    siteName: normalizeText(value?.siteName, defaults.siteName, MAX_SHORT_TEXT_LENGTH),
    slogan: normalizeText(value?.slogan, defaults.slogan, MAX_SHORT_TEXT_LENGTH),
    logoImageUrl: normalizeOptionalUrl(value?.logoImageUrl, defaults.logoImageUrl, {
      allowImageData: true,
    }),
    heroImageUrl: normalizeOptionalUrl(value?.heroImageUrl, defaults.heroImageUrl, {
      allowImageData: true,
    }),
    heroEyebrow: normalizeText(value?.heroEyebrow, defaults.heroEyebrow, MAX_SHORT_TEXT_LENGTH),
    heroDescription: normalizeText(value?.heroDescription, defaults.heroDescription),
    sellerPhone: normalizePhone(value?.sellerPhone, defaults.sellerPhone),
    sellerMessageTemplate: normalizeText(
      value?.sellerMessageTemplate,
      defaults.sellerMessageTemplate,
    ),
    connectiaPaymentLink: normalizeOptionalUrl(
      value?.connectiaPaymentLink,
      defaults.connectiaPaymentLink,
    ),
    paypalPaymentLink: normalizeOptionalUrl(
      value?.paypalPaymentLink,
      paypalUsername ? `https://paypal.me/${paypalUsername}` : defaults.paypalPaymentLink,
    ),
    paypalUsername,
    transferClabe: normalizeOptionalText(value?.transferClabe, MAX_SHORT_TEXT_LENGTH),
    transferInstructions: normalizeText(
      value?.transferInstructions,
      defaults.transferInstructions,
    ),
  };
}

export function createEmptyLocalCategoryOverrides(): LocalCategoryOverrides {
  return {
    categories: [],
    deletedCategoryIds: [],
    metadataById: {},
  };
}

export function sanitizeLocalCategoryOverrides(
  value: Partial<LocalCategoryOverrides> | null | undefined,
): LocalCategoryOverrides {
  const categoryMap = new Map<string, LocalCategory>();
  const metadataMap = new Map<string, LocalCategoryMetadata>();

  for (const rawCategory of Array.isArray(value?.categories) ? value.categories : []) {
    const category = sanitizeLocalCategory(rawCategory);

    if (!category) {
      continue;
    }

    const currentCategory = categoryMap.get(category.id);
    const mergedMetadata = mergeCategoryMetadata(currentCategory, category);

    categoryMap.set(category.id, {
      id: category.id,
      name: category.name,
      ...mergedMetadata,
    });

    if (hasCategoryMetadata(mergedMetadata)) {
      metadataMap.set(category.id, mergedMetadata);
    }
  }

  const deletedCategoryIds = normalizeStringList(value?.deletedCategoryIds, 500);

  if (value?.metadataById && typeof value.metadataById === "object") {
    for (const [categoryId, metadataValue] of Object.entries(value.metadataById)) {
      const normalizedId = normalizeId(categoryId);
      const metadata = normalizeCategoryMetadata(metadataValue);

      if (!normalizedId || !hasCategoryMetadata(metadata)) {
        continue;
      }

      metadataMap.set(
        normalizedId,
        mergeCategoryMetadata(metadataMap.get(normalizedId), metadata),
      );
    }
  }

  for (const categoryId of deletedCategoryIds) {
    metadataMap.set(categoryId, mergeCategoryMetadata(metadataMap.get(categoryId), { isHidden: true }));
  }

  const categories = Array.from(categoryMap.values()).map((category) => ({
    ...category,
    ...(metadataMap.get(category.id) ?? {}),
  }));

  return {
    categories,
    deletedCategoryIds,
    metadataById: Object.fromEntries(
      Array.from(metadataMap.entries()).flatMap(([categoryId, metadata]) =>
        hasCategoryMetadata(metadata)
          ? [[categoryId, metadata] as [string, LocalCategoryMetadata]]
          : [],
      ),
    ),
  };
}

export function createEmptyLocalCatalogOverrides(): LocalCatalogOverrides {
  return {
    products: [],
    deletedProductIds: [],
  };
}

export function sanitizeLocalCatalogOverrides(
  brand: StorefrontBrand,
  value: Partial<LocalCatalogOverrides> | null | undefined,
): LocalCatalogOverrides {
  const productMap = new Map<string, CatalogProduct>();

  for (const rawProduct of Array.isArray(value?.products) ? value.products : []) {
    const product = sanitizeCatalogProduct(brand, rawProduct);

    if (!product) {
      continue;
    }

    productMap.set(product.id, product);
  }

  return {
    products: Array.from(productMap.values()),
    deletedProductIds: normalizeStringList(value?.deletedProductIds, 1000),
  };
}

export function createDefaultStorefrontSnapshot(
  brand: StorefrontBrand,
): StorefrontStateSnapshot {
  return {
    brand,
    settings: getDefaultStorefrontSettings(brand),
    categoryOverrides: createEmptyLocalCategoryOverrides(),
    productOverrides: createEmptyLocalCatalogOverrides(),
    updatedAt: null,
  };
}

export function sanitizeStorefrontSnapshot(
  brand: StorefrontBrand,
  value: Partial<StorefrontStateSnapshot> | null | undefined,
  currentSnapshot?: StorefrontStateSnapshot,
): StorefrontStateSnapshot {
  const baseSnapshot = currentSnapshot ?? createDefaultStorefrontSnapshot(brand);

  return {
    brand,
    settings: sanitizeStorefrontSettings(brand, value?.settings, baseSnapshot.settings),
    categoryOverrides: sanitizeLocalCategoryOverrides(
      value?.categoryOverrides ?? baseSnapshot.categoryOverrides,
    ),
    productOverrides: sanitizeLocalCatalogOverrides(
      brand,
      value?.productOverrides ?? baseSnapshot.productOverrides,
    ),
    updatedAt: normalizeTimestamp(value?.updatedAt) ?? baseSnapshot.updatedAt,
  };
}

export function createEmptyStorefrontStateFile(): StorefrontStateFile {
  return {
    version: 1,
    brands: {},
    updatedAt: null,
  };
}

export function sanitizeStorefrontStateFile(
  value: unknown,
  currentState?: StorefrontStateFile,
): StorefrontStateFile {
  const baseState = currentState ?? createEmptyStorefrontStateFile();
  const candidate = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawBrands =
    candidate.brands && typeof candidate.brands === "object"
      ? (candidate.brands as Record<string, unknown>)
      : {};
  const brands: Partial<Record<StorefrontBrand, StorefrontStateSnapshot>> = {};

  for (const brand of STOREFRONT_BRANDS) {
    const currentSnapshot = baseState.brands[brand] ?? createDefaultStorefrontSnapshot(brand);
    const rawSnapshot =
      rawBrands[brand] && typeof rawBrands[brand] === "object"
        ? (rawBrands[brand] as Partial<StorefrontStateSnapshot>)
        : undefined;

    if (rawSnapshot || baseState.brands[brand]) {
      brands[brand] = sanitizeStorefrontSnapshot(brand, rawSnapshot, currentSnapshot);
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
