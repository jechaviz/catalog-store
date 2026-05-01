import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  createDefaultStorefrontSnapshot,
  createEmptyStorefrontStateFile,
  sanitizeLocalCatalogOverrides,
  sanitizeLocalCategoryOverrides,
  sanitizeStorefrontSettings,
  sanitizeStorefrontStateFile,
  type LocalCatalogOverrides,
  type LocalCategoryOverrides,
  type StorefrontBrand,
  type StorefrontSettings,
  type StorefrontStateFile,
  type StorefrontStateSnapshot,
} from "../shared/storefrontState";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RUNTIME_DIRECTORY = path.resolve(__dirname, "..", ".runtime");
const STATE_FILE_PATH = path.join(RUNTIME_DIRECTORY, "storefront-state.json");

let writeQueue: Promise<void> = Promise.resolve();

function cloneStateFile(state: StorefrontStateFile): StorefrontStateFile {
  return {
    version: state.version,
    brands: { ...state.brands },
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
      `${JSON.stringify(createEmptyStorefrontStateFile(), null, 2)}\n`,
      "utf8",
    );
  }
}

async function readStateFile(): Promise<StorefrontStateFile> {
  await ensureStateFile();

  try {
    const rawValue = await fs.readFile(STATE_FILE_PATH, "utf8");
    const parsedValue = rawValue.trim() ? JSON.parse(rawValue) : {};
    return sanitizeStorefrontStateFile(parsedValue);
  } catch (error) {
    console.warn("Unable to read storefront state file, falling back to defaults.", error);
    return createEmptyStorefrontStateFile();
  }
}

async function writeStateFile(state: StorefrontStateFile) {
  await ensureStateFile();

  const tempFilePath = `${STATE_FILE_PATH}.tmp`;
  const normalizedState = sanitizeStorefrontStateFile(state);

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

async function updateSnapshot(
  brand: StorefrontBrand,
  updater: (currentSnapshot: StorefrontStateSnapshot) => StorefrontStateSnapshot,
) {
  return withWriteLock(async () => {
    const currentState = await readStateFile();
    const nextState = cloneStateFile(currentState);
    const currentSnapshot = currentState.brands[brand] ?? createDefaultStorefrontSnapshot(brand);
    const updatedAt = new Date().toISOString();
    const nextSnapshot = updater(currentSnapshot);

    nextState.brands[brand] = {
      ...nextSnapshot,
      brand,
      updatedAt,
    };
    nextState.updatedAt = updatedAt;

    await writeStateFile(nextState);

    return nextState.brands[brand] as StorefrontStateSnapshot;
  });
}

export async function readStorefrontSnapshot(brand: StorefrontBrand) {
  const state = await readStateFile();
  return state.brands[brand] ?? createDefaultStorefrontSnapshot(brand);
}

export async function saveStorefrontSettings(
  brand: StorefrontBrand,
  patch: Partial<StorefrontSettings>,
) {
  return updateSnapshot(brand, (currentSnapshot) => ({
    ...currentSnapshot,
    settings: sanitizeStorefrontSettings(brand, patch, currentSnapshot.settings),
  }));
}

export async function saveCategoryOverrides(
  brand: StorefrontBrand,
  patch: Partial<LocalCategoryOverrides>,
) {
  return updateSnapshot(brand, (currentSnapshot) => ({
    ...currentSnapshot,
    categoryOverrides: sanitizeLocalCategoryOverrides(patch),
  }));
}

export async function saveProductOverrides(
  brand: StorefrontBrand,
  patch: Partial<LocalCatalogOverrides>,
) {
  return updateSnapshot(brand, (currentSnapshot) => ({
    ...currentSnapshot,
    productOverrides: sanitizeLocalCatalogOverrides(brand, patch),
  }));
}

export function getStorefrontStateFilePath() {
  return STATE_FILE_PATH;
}
