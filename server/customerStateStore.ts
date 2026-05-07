import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  createDefaultCustomerStateSnapshot,
  createEmptyCustomerStateFile,
  normalizeCustomerScopeId,
  sanitizeCustomerStateFile,
  type CustomerCartItem,
  type CustomerOrderRecord,
  type CustomerStateBrand,
  type CustomerStateFile,
  type CustomerStateResourceKey,
  type CustomerStateSnapshot,
} from "../shared/customerState";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RUNTIME_DIRECTORY = path.resolve(__dirname, "..", ".runtime");
const STATE_FILE_PATH = path.join(RUNTIME_DIRECTORY, "customer-state.json");

let writeQueue: Promise<void> = Promise.resolve();

function cloneStateFile(state: CustomerStateFile): CustomerStateFile {
  return {
    version: state.version,
    brands: Object.fromEntries(
      Object.entries(state.brands).map(([brand, scopes]) => [brand, { ...(scopes ?? {}) }]),
    ) as CustomerStateFile["brands"],
    updatedAt: state.updatedAt,
  };
}

async function ensureStateFile() {
  await fs.mkdir(RUNTIME_DIRECTORY, { recursive: true });

  try {
    await fs.access(STATE_FILE_PATH);
  } catch {
    await fs.writeFile(
      STATE_FILE_PATH,
      `${JSON.stringify(createEmptyCustomerStateFile(), null, 2)}\n`,
      "utf8",
    );
  }
}

async function readStateFile(): Promise<CustomerStateFile> {
  await ensureStateFile();

  try {
    const rawValue = await fs.readFile(STATE_FILE_PATH, "utf8");
    const parsedValue = rawValue.trim() ? JSON.parse(rawValue) : {};
    return sanitizeCustomerStateFile(parsedValue);
  } catch (error) {
    console.warn("Unable to read customer state file, falling back to defaults.", error);
    return createEmptyCustomerStateFile();
  }
}

async function writeStateFile(state: CustomerStateFile) {
  await ensureStateFile();

  const tempFilePath = `${STATE_FILE_PATH}.tmp`;
  const normalizedState = sanitizeCustomerStateFile(state);

  await fs.writeFile(tempFilePath, `${JSON.stringify(normalizedState, null, 2)}\n`, "utf8");
  await fs.rename(tempFilePath, STATE_FILE_PATH);
}

async function withWriteLock<T>(operation: () => Promise<T>) {
  const resultPromise = writeQueue.then(operation, operation);
  writeQueue = resultPromise.then(
    () => undefined,
    () => undefined,
  );
  return resultPromise;
}

function getResourceCount(snapshot: CustomerStateSnapshot, resource: CustomerStateResourceKey) {
  return snapshot[resource].length;
}

function applyResourceUpdate(
  snapshot: CustomerStateSnapshot,
  resource: CustomerStateResourceKey,
  updatedAt: string,
): CustomerStateSnapshot {
  return {
    ...snapshot,
    resourceMeta: {
      ...snapshot.resourceMeta,
      [resource]: {
        count: getResourceCount(snapshot, resource),
        updatedAt,
      },
    },
  };
}

async function updateSnapshot(
  brand: CustomerStateBrand,
  scopeId: string,
  resource: CustomerStateResourceKey,
  updater: (currentSnapshot: CustomerStateSnapshot) => CustomerStateSnapshot,
) {
  return withWriteLock(async () => {
    const currentState = await readStateFile();
    const nextState = cloneStateFile(currentState);
    const normalizedScopeId = normalizeCustomerScopeId(scopeId);
    const currentBrandScopes = currentState.brands[brand] ?? {};
    const currentSnapshot =
      currentBrandScopes[normalizedScopeId] ??
      createDefaultCustomerStateSnapshot(brand, normalizedScopeId);
    const updatedAt = new Date().toISOString();
    const nextSnapshot = applyResourceUpdate(updater(currentSnapshot), resource, updatedAt);
    const nextBrandScopes = {
      ...(nextState.brands[brand] ?? {}),
      [normalizedScopeId]: {
        ...nextSnapshot,
        brand,
        scopeId: normalizedScopeId,
        updatedAt,
      },
    };

    nextState.brands[brand] = nextBrandScopes;
    nextState.updatedAt = updatedAt;

    await writeStateFile(nextState);

    return nextBrandScopes[normalizedScopeId] as CustomerStateSnapshot;
  });
}

export async function readCustomerStateSnapshot(brand: CustomerStateBrand, scopeId: string) {
  const state = await readStateFile();
  const normalizedScopeId = normalizeCustomerScopeId(scopeId);
  return (
    state.brands[brand]?.[normalizedScopeId] ??
    createDefaultCustomerStateSnapshot(brand, normalizedScopeId)
  );
}

export async function saveCustomerOrders(
  brand: CustomerStateBrand,
  scopeId: string,
  orders: CustomerOrderRecord[],
) {
  return updateSnapshot(brand, scopeId, "orders", (currentSnapshot) => ({
    ...currentSnapshot,
    orders,
  }));
}

export async function saveCustomerLikes(
  brand: CustomerStateBrand,
  scopeId: string,
  likes: string[],
) {
  return updateSnapshot(brand, scopeId, "likes", (currentSnapshot) => ({
    ...currentSnapshot,
    likes,
  }));
}

export async function saveCustomerCart(
  brand: CustomerStateBrand,
  scopeId: string,
  cart: CustomerCartItem[],
) {
  return updateSnapshot(brand, scopeId, "cart", (currentSnapshot) => ({
    ...currentSnapshot,
    cart,
  }));
}

export function getCustomerStateFilePath() {
  return STATE_FILE_PATH;
}
