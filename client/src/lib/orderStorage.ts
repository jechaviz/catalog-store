import type { Brand } from '@/contexts/BrandContext';
import type { CartItem } from '@/hooks/useCart';
import type { CatalogProduct } from '@/lib/dataFetcher';
import {
  buildScopedBrandStorageKey,
  getLegacyBrandStorageKey,
  hasUserScope,
  isStorageKeyForBrandPrefix,
  listScopedBrandStorageKeys,
  normalizeStorageScopeId,
} from '@/lib/storageScope';

const ORDERS_STORAGE_PREFIX = 'catalog_orders';
const DEFAULT_CARRIER = 'Confirmacion por WhatsApp';

export type StoredOrderStatus = 'pending' | 'processing' | 'paid' | 'shipped' | 'delivered';
export type StoredPaymentMethod = 'whatsapp_cash' | 'transfer' | 'connectia' | 'paypal';

export interface StoredOrderItem {
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

export interface StoredOrderRecord {
  id: string;
  brand: Brand;
  createdAt: string;
  updatedAt: string;
  status: StoredOrderStatus;
  paymentMethod: StoredPaymentMethod;
  subtotal: number;
  shippingCost: number;
  total: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: StoredOrderItem[];
  carrier?: string;
  trackingNumber?: string;
  notes?: string;
}

type NewOrderInput = Omit<StoredOrderRecord, 'createdAt' | 'updatedAt'> & {
  createdAt?: string;
  updatedAt?: string;
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

function isStoredOrderRecord(candidate: unknown, brand: Brand): candidate is StoredOrderRecord {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const order = candidate as Partial<StoredOrderRecord>;
  return (
    order.brand === brand &&
    typeof order.id === 'string' &&
    typeof order.createdAt === 'string' &&
    typeof order.status === 'string' &&
    Array.isArray(order.items)
  );
}

function readOrdersForStorageKey(storageKey: string, brand: Brand) {
  const parsed = safeParseJson<unknown[]>(localStorage.getItem(storageKey), []);
  return parsed.filter((candidate): candidate is StoredOrderRecord =>
    isStoredOrderRecord(candidate, brand),
  );
}

function sortOrders(orders: StoredOrderRecord[]) {
  return orders
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function buildOrderFingerprint(order: StoredOrderRecord) {
  return [
    order.id,
    order.createdAt,
    order.customerPhone.trim(),
    order.total.toFixed(2),
  ].join('|');
}

function hydrateGuestOrdersFromLegacy(brand: Brand) {
  const guestStorageKey = getOrdersStorageKey(brand);
  const legacyStorageKey = getLegacyBrandOrdersStorageKey(brand);
  const legacyOrders = readOrdersForStorageKey(legacyStorageKey, brand);

  if (legacyOrders.length > 0 || localStorage.getItem(legacyStorageKey)) {
    localStorage.setItem(guestStorageKey, JSON.stringify(sortOrders(legacyOrders)));
    return legacyOrders;
  }

  return [];
}

export function getOrdersStorageKey(brand: Brand, userId?: string | null) {
  return buildScopedBrandStorageKey(ORDERS_STORAGE_PREFIX, brand, userId);
}

export function getLegacyBrandOrdersStorageKey(brand: Brand) {
  return getLegacyBrandStorageKey(ORDERS_STORAGE_PREFIX, brand);
}

export function isOrdersStorageKeyForBrand(key: string | null | undefined, brand: Brand) {
  return isStorageKeyForBrandPrefix(key, ORDERS_STORAGE_PREFIX, brand);
}

export function listOrderStorageKeysForBrand(brand: Brand) {
  return listScopedBrandStorageKeys(ORDERS_STORAGE_PREFIX, brand);
}

export function listOrdersByBrand(brand: Brand, userId?: string | null) {
  const storageKey = getOrdersStorageKey(brand, userId);
  const scopedOrders = readOrdersForStorageKey(storageKey, brand);

  if (scopedOrders.length > 0 || localStorage.getItem(storageKey)) {
    return sortOrders(scopedOrders);
  }

  if (hasUserScope(userId)) {
    return [];
  }

  return sortOrders(hydrateGuestOrdersFromLegacy(brand));
}

export function listAllOrdersByBrand(brand: Brand) {
  const dedupedOrders = new Map<string, StoredOrderRecord>();

  for (const storageKey of listOrderStorageKeysForBrand(brand)) {
    const scopedOrders = readOrdersForStorageKey(storageKey, brand);

    for (const order of scopedOrders) {
      const fingerprint = buildOrderFingerprint(order);
      const existingOrder = dedupedOrders.get(fingerprint);

      if (!existingOrder || existingOrder.updatedAt.localeCompare(order.updatedAt) < 0) {
        dedupedOrders.set(fingerprint, order);
      }
    }
  }

  return sortOrders(Array.from(dedupedOrders.values()));
}

export function saveOrdersByBrand(brand: Brand, orders: StoredOrderRecord[], userId?: string | null) {
  const normalizedOrders = sortOrders(orders.filter(order => order.brand === brand));
  const storageKey = getOrdersStorageKey(brand, userId);

  localStorage.setItem(storageKey, JSON.stringify(normalizedOrders));
  window.dispatchEvent(new CustomEvent('catalog-orders-changed', {
    detail: {
      brand,
      scopeId: normalizeStorageScopeId(userId),
      storageKey,
    },
  }));
}

export function upsertOrder(order: NewOrderInput, userId?: string | null) {
  const createdAt = order.createdAt || new Date().toISOString();
  const updatedAt = order.updatedAt || createdAt;
  const fullOrder: StoredOrderRecord = {
    ...order,
    createdAt,
    updatedAt,
  };

  const currentOrders = listOrdersByBrand(order.brand, userId);
  const withoutCurrent = currentOrders.filter(existingOrder => existingOrder.id !== order.id);
  saveOrdersByBrand(order.brand, [fullOrder, ...withoutCurrent], userId);

  return fullOrder;
}

export function getOrderById(brand: Brand, orderId?: string | null, userId?: string | null) {
  if (!orderId) {
    return null;
  }

  return listOrdersByBrand(brand, userId).find(order => order.id === orderId) || null;
}

export function createFallbackOrderId(brand: Brand) {
  const prefix = brand === 'nikken' ? 'NIK' : 'NAT';
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

export function mapCartItemsToOrderItems(items: CartItem[]): StoredOrderItem[] {
  return items.map(item => ({
    productId: item.product.id,
    name: item.product.name,
    brand: item.product.brand,
    subBrand: item.product.subBrand,
    imageUrl: item.product.imageUrl,
    quantity: item.quantity,
    unitPrice: item.product.price,
    lineTotal: item.product.price * item.quantity,
    productSnapshot: item.product,
  }));
}

export function getOrderStatusLabel(status: StoredOrderStatus) {
  switch (status) {
    case 'pending':
      return 'Pendiente';
    case 'processing':
      return 'Procesando';
    case 'paid':
      return 'Pagado';
    case 'shipped':
      return 'En camino';
    case 'delivered':
      return 'Entregado';
    default:
      return 'Procesando';
  }
}

export function getOrderStatusClasses(status: StoredOrderStatus) {
  switch (status) {
    case 'delivered':
      return 'bg-emerald-100 text-emerald-700';
    case 'shipped':
      return 'bg-blue-100 text-blue-700';
    case 'paid':
      return 'bg-violet-100 text-violet-700';
    case 'pending':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-orange-100 text-orange-700';
  }
}

export function getPaymentMethodLabel(paymentMethod: StoredPaymentMethod) {
  switch (paymentMethod) {
    case 'transfer':
      return 'Transferencia';
    case 'connectia':
      return 'Connectia';
    case 'paypal':
      return 'PayPal';
    default:
      return 'Pago a la entrega';
  }
}

export function getCarrierLabel(order: StoredOrderRecord) {
  if (order.carrier) {
    return order.carrier;
  }

  return order.status === 'shipped' || order.status === 'delivered'
    ? 'Mensajeria asignada'
    : DEFAULT_CARRIER;
}

export function getEstimatedDeliveryLabel(order: StoredOrderRecord) {
  if (order.status === 'delivered') {
    return 'Entregado';
  }

  if (order.status === 'shipped') {
    return 'En ruta';
  }

  return 'Confirmacion pendiente';
}

export function getTrackingTimeline(order: StoredOrderRecord) {
  const baseDate = new Date(order.createdAt);
  const steps = [
    {
      title: 'Pedido confirmado',
      date: formatTimelineDate(baseDate),
      status: 'completed',
    },
    {
      title: 'En procesamiento',
      date: formatTimelineDate(addHours(baseDate, 4)),
      status: order.status === 'pending' ? 'active' : 'completed',
    },
    {
      title: 'Pago validado',
      date: formatTimelineDate(addHours(baseDate, 8)),
      status:
        order.status === 'pending' || order.paymentMethod === 'whatsapp_cash'
          ? 'pending'
          : order.status === 'paid'
            ? 'active'
            : 'completed',
    },
    {
      title: 'En camino',
      date: formatTimelineDate(addDays(baseDate, 1)),
      status:
        order.status === 'shipped'
          ? 'active'
          : order.status === 'delivered'
            ? 'completed'
            : 'pending',
    },
    {
      title: 'Entregado',
      date: order.status === 'delivered' ? formatTimelineDate(addDays(baseDate, 2)) : 'Por confirmar',
      status: order.status === 'delivered' ? 'completed' : 'pending',
    },
  ];

  return steps;
}

function addHours(date: Date, hours: number) {
  const nextDate = new Date(date);
  nextDate.setHours(nextDate.getHours() + hours);
  return nextDate;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function formatTimelineDate(date: Date) {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
