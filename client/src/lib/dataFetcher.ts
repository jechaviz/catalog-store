import { client as odooClient, getOdooImageUrl } from './odoo';
import { GET_PRODUCTS, GET_CATEGORIES } from './odooQueries';
import { applyLocalCatalogOverrides, readLocalCatalogOverrides } from './adminCatalogStorage';
import {
    applyLocalCategoryOverrides as applyStoredLocalCategoryOverrides,
    getLocalCategoryStorageKey,
    readLocalCategoryOverrides as readStoredLocalCategoryOverrides,
    type LocalCategoryOverrides as StoredLocalCategoryOverrides,
} from './adminCategoryStorage';

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
    gender: 'female' | 'male' | 'unisex';
    description: string;
    benefits: string[];
    price: number;
    imageUrl: string;
    inStock: boolean;
    paymentLink?: string;
    deliveryTime: string;
    deliveryMethods: string[];
}

export interface CatalogData {
    categories: Category[];
    products: CatalogProduct[];
}

type BrandKey = 'natura' | 'nikken';

const UNCATEGORIZED_CATEGORY_ID = 'uncategorized';
const LEGACY_LOCAL_CATEGORY_STORAGE_KEY_FACTORIES = [
    (brand: BrandKey) => `catalog-local-categories:${brand}`,
    (brand: BrandKey) => `catalog_local_category_${brand}`,
    (brand: BrandKey) => `catalog_local_category_overrides_${brand}`,
] as const;
const CATEGORY_ARRAY_KEYS = [
    'categories',
    'localCategories',
    'customCategories',
    'items',
    'list',
    'overrides',
] as const;
const CATEGORY_NAME_MAP_KEYS = [
    'renamedCategories',
    'categoryNames',
    'namesById',
] as const;
const CATEGORY_SORT_MAP_KEYS = [
    'sortOrders',
    'sortOrderById',
    'categorySortOrder',
    'categoryOrder',
] as const;
const CATEGORY_VISIBILITY_MAP_KEYS = [
    'categoryVisibility',
    'visibilityById',
    'visibleById',
] as const;
const CATEGORY_HIDDEN_MAP_KEYS = [
    'hiddenById',
    'hiddenCategories',
] as const;
const CATEGORY_VISIBLE_ID_LIST_KEYS = [
    'visibleCategoryIds',
    'shownCategoryIds',
] as const;
const CATEGORY_HIDDEN_ID_LIST_KEYS = [
    'hiddenCategoryIds',
    'hiddenIds',
] as const;
const CATEGORY_DELETED_ID_LIST_KEYS = [
    'deletedCategoryIds',
    'deletedIds',
    'removedCategoryIds',
] as const;

const NATURA_MOCK_DATA: CatalogData = {
    categories: [
        { id: '1', name: 'Perfumeria' },
        { id: '2', name: 'Maquillaje' },
        { id: '3', name: 'Cuerpo' },
        { id: '4', name: 'Cabello' },
    ],
    products: [
        {
            id: 'mock-1',
            name: 'Perfume Femenino Esencial',
            brand: 'Natura',
            subBrand: 'Esencial',
            categoryId: '1',
            gender: 'female',
            description: 'Una fragancia sofisticada para momentos especiales.',
            benefits: ['Duracion prolongada', 'Envase reciclable'],
            price: 1250,
            imageUrl: '/perfume_fem.png',
            inStock: true,
            deliveryTime: 'Entrega Inmediata',
            deliveryMethods: ['Envio a domicilio'],
        },
        {
            id: 'mock-2',
            name: 'Crema de Manos Ekos',
            brand: 'Natura',
            subBrand: 'Ekos',
            categoryId: '3',
            gender: 'unisex',
            description: 'Hidratacion profunda con ingredientes de la Amazonia.',
            benefits: ['Biodegradable', 'Cruelty Free'],
            price: 245,
            imageUrl: '/crema_manos.png',
            inStock: true,
            deliveryTime: 'Entrega Inmediata',
            deliveryMethods: ['Envio a domicilio'],
        },
        {
            id: 'mock-3',
            name: 'Perfume Masculino Kaiak',
            brand: 'Natura',
            subBrand: 'Kaiak',
            categoryId: '1',
            gender: 'male',
            description: 'Frescura vibrante inspirada en el movimiento del mar.',
            benefits: ['Frescuras intensas', 'Envase sustentable'],
            price: 890,
            imageUrl: '/perfume_masc.png',
            inStock: true,
            deliveryTime: 'Entrega Inmediata',
            deliveryMethods: ['Envio a domicilio'],
        },
    ],
};

const NIKKEN_MOCK_DATA: CatalogData = {
    categories: [
        { id: 'nikken-1', name: 'Agua (PiMag)' },
        { id: 'nikken-2', name: 'Nutricion (Kenzen)' },
        { id: 'nikken-3', name: 'Descanso (Kenko Sleep)' },
        { id: 'nikken-4', name: 'Aire (KenkoAir)' },
        { id: 'nikken-5', name: 'Piel (True Elements)' },
        { id: 'nikken-6', name: 'Joyas y Magnetismo' },
    ],
    products: [
        {
            id: '4934',
            name: 'PiMag Waterfall',
            brand: 'Nikken',
            subBrand: 'PiMag',
            categoryId: 'nikken-1',
            gender: 'unisex',
            description: 'Sistema de filtracion de agua que replica el ciclo de la naturaleza.',
            benefits: ['Agua alcalina', 'Mineralizada', 'Libre de sedimentos'],
            price: 9850,
            imageUrl: '/assets/nikken/products/4934.jpg',
            inStock: true,
            deliveryTime: '3-5 dias habiles',
            deliveryMethods: ['Envio nacional'],
        },
        {
            id: '1441',
            name: 'KenkoAir Purifier',
            brand: 'Nikken',
            subBrand: 'KenkoAir',
            categoryId: 'nikken-4',
            gender: 'unisex',
            description: 'Purificador de aire con filtracion HEPA de alta eficiencia.',
            benefits: ['Reduce alergenos', 'Silencioso', 'Bajo consumo'],
            price: 15924,
            imageUrl: '/assets/nikken/products/1441.jpg',
            inStock: true,
            deliveryTime: '3-5 dias habiles',
            deliveryMethods: ['Envio nacional'],
        },
        {
            id: '10320',
            name: 'Kenko Sleep Luxury Mattress King',
            brand: 'Nikken',
            subBrand: 'Kenko Sleep',
            categoryId: 'nikken-3',
            gender: 'unisex',
            description: 'Colchon de lujo con tecnologia magnetica y de infrarrojo lejano.',
            benefits: ['Soporte ergonomico', 'Regulacion termica', 'Relax profundo'],
            price: 40762,
            imageUrl: '/assets/nikken/products/10320.jpg',
            inStock: true,
            deliveryTime: '8-10 dias habiles',
            deliveryMethods: ['Envio especializado'],
        },
        {
            id: '18093',
            name: 'True Elements Beauty Mask',
            brand: 'Nikken',
            subBrand: 'True Elements',
            categoryId: 'nikken-5',
            gender: 'female',
            description: 'Mascara de belleza con Snow Lotus para hidratacion profunda.',
            benefits: ['Efecto rejuvenecedor', 'Luminosidad', 'Ingredientes naturales'],
            price: 2616,
            imageUrl: '/assets/nikken/products/18093.jpg',
            inStock: true,
            deliveryTime: 'Entrega Inmediata',
            deliveryMethods: ['Envio nacional'],
        },
        {
            id: '1372',
            name: 'Cartucho PiMag Water System',
            brand: 'Nikken',
            subBrand: 'PiMag',
            categoryId: 'nikken-1',
            gender: 'unisex',
            description: 'Repuesto de cartucho para el sistema de agua PiMag.',
            benefits: ['Filtracion de cloro', 'Sabor mejorado', 'Equilibrio pH'],
            price: 1453,
            imageUrl: '/assets/nikken/products/1372.jpg',
            inStock: true,
            deliveryTime: 'Entrega Inmediata',
            deliveryMethods: ['Envio nacional'],
        },
        {
            id: '4933',
            name: 'Paquete Repuestos Pi Water',
            brand: 'Nikken',
            subBrand: 'PiMag',
            categoryId: 'nikken-1',
            gender: 'unisex',
            description: 'Kit completo de repuestos para el sistema Pi Water.',
            benefits: ['Ahorro en paquete', 'Mantenimiento preventivo'],
            price: 1533,
            imageUrl: '/assets/nikken/products/4933.jpg',
            inStock: true,
            deliveryTime: 'Entrega Inmediata',
            deliveryMethods: ['Envio nacional'],
        },
    ],
};

function cloneCatalogData(data: CatalogData): CatalogData {
    return {
        categories: data.categories.map(category => ({ ...category })),
        products: data.products.map(product => ({
            ...product,
            benefits: [...product.benefits],
            deliveryMethods: [...product.deliveryMethods],
        })),
    };
}

function getFallbackData(brand: 'natura' | 'nikken') {
    return cloneCatalogData(brand === 'nikken' ? NIKKEN_MOCK_DATA : NATURA_MOCK_DATA);
}

function canUseBrowserStorage() {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

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

function normalizeCategoryText(value: unknown) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function normalizeCategorySortOrder(value: unknown) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
        const trimmedValue = value.trim();
        if (!trimmedValue) {
            return null;
        }

        const numericValue = Number(trimmedValue);
        return Number.isFinite(numericValue) ? numericValue : null;
    }

    return null;
}

function normalizeCategoryVisibility(value: unknown) {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        if (value === 1) {
            return true;
        }

        if (value === 0) {
            return false;
        }

        return null;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const normalizedValue = value.trim().toLowerCase();

    if (!normalizedValue) {
        return null;
    }

    if (['1', 'true', 'yes', 'on', 'visible', 'show', 'shown', 'active', 'enabled'].includes(normalizedValue)) {
        return true;
    }

    if (['0', 'false', 'no', 'off', 'hidden', 'hide', 'deleted', 'inactive', 'disabled'].includes(normalizedValue)) {
        return false;
    }

    return null;
}

function normalizeCategoryRecord(value: unknown): Category | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const candidate = value as Partial<Category>;
    const id = normalizeCategoryText(candidate.id);
    const name = normalizeCategoryText(candidate.name);

    if (!id || !name) {
        return null;
    }

    return { id, name };
}

function normalizeCategoryIdList(value: unknown) {
    const rawValues = Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? value.split(/[\n,;|]+/g)
          : [];

    return Array.from(new Set(
        rawValues
            .map(item => normalizeCategoryText(item))
            .filter(item => item.length > 0),
    ));
}

interface CategoryPresentationState {
    name?: string;
    sortOrder?: number;
    isVisible?: boolean;
}

interface ParsedLocalCategorySnapshot {
    overrides: StoredLocalCategoryOverrides;
    presentationById: Map<string, CategoryPresentationState>;
}

function createEmptyStoredLocalCategoryOverrides(): StoredLocalCategoryOverrides {
    return {
        categories: [],
        deletedCategoryIds: [],
    };
}

function mergeCategoryPresentationState(
    target: Map<string, CategoryPresentationState>,
    categoryId: string,
    patch: CategoryPresentationState,
) {
    if (!categoryId) {
        return;
    }

    const currentState = target.get(categoryId) ?? {};
    const nextState: CategoryPresentationState = { ...currentState };

    if (patch.name) {
        nextState.name = patch.name;
    }

    if (patch.sortOrder !== undefined) {
        nextState.sortOrder = patch.sortOrder;
    }

    if (patch.isVisible !== undefined) {
        nextState.isVisible = patch.isVisible;
    }

    target.set(categoryId, nextState);
}

function extractVisibilityFromCategoryRecord(record: Record<string, unknown>) {
    const visibleFlags = [record.visible, record.isVisible, record.active, record.enabled];

    for (const flag of visibleFlags) {
        const normalizedFlag = normalizeCategoryVisibility(flag);
        if (normalizedFlag !== null) {
            return normalizedFlag;
        }
    }

    const hiddenFlags = [record.hidden, record.isHidden, record.disabled];

    for (const flag of hiddenFlags) {
        const normalizedFlag = normalizeCategoryVisibility(flag);
        if (normalizedFlag !== null) {
            return !normalizedFlag;
        }
    }

    return undefined;
}

function extractSortOrderFromCategoryRecord(record: Record<string, unknown>) {
    const rawSortValues = [record.sortOrder, record.order, record.position, record.index];

    for (const rawSortValue of rawSortValues) {
        const normalizedSortOrder = normalizeCategorySortOrder(rawSortValue);
        if (normalizedSortOrder !== null) {
            return normalizedSortOrder;
        }
    }

    return null;
}

function collectCategoryArrayValues(candidate: Record<string, unknown>) {
    return CATEGORY_ARRAY_KEYS.flatMap(key =>
        Array.isArray(candidate[key]) ? candidate[key] : [],
    );
}

function parseCategoryNameMap(candidate: Record<string, unknown>) {
    const nameEntries = new Map<string, string>();

    CATEGORY_NAME_MAP_KEYS.forEach(key => {
        const rawValue = candidate[key];

        if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
            return;
        }

        Object.entries(rawValue).forEach(([categoryId, categoryName]) => {
            const normalizedCategoryId = normalizeCategoryText(categoryId);
            const normalizedCategoryName = normalizeCategoryText(categoryName);

            if (normalizedCategoryId && normalizedCategoryName) {
                nameEntries.set(normalizedCategoryId, normalizedCategoryName);
            }
        });
    });

    return nameEntries;
}

function parseCategorySortOrderMap(candidate: Record<string, unknown>) {
    const sortOrderEntries = new Map<string, number>();

    CATEGORY_SORT_MAP_KEYS.forEach(key => {
        const rawValue = candidate[key];

        if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
            return;
        }

        Object.entries(rawValue).forEach(([categoryId, sortOrder]) => {
            const normalizedCategoryId = normalizeCategoryText(categoryId);
            const normalizedSortOrder = normalizeCategorySortOrder(sortOrder);

            if (normalizedCategoryId && normalizedSortOrder !== null) {
                sortOrderEntries.set(normalizedCategoryId, normalizedSortOrder);
            }
        });
    });

    return sortOrderEntries;
}

function parseCategoryVisibilityMap(
    candidate: Record<string, unknown>,
    keys: readonly string[],
    invertVisibility = false,
) {
    const visibilityEntries = new Map<string, boolean>();

    keys.forEach(key => {
        const rawValue = candidate[key];

        if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
            return;
        }

        Object.entries(rawValue).forEach(([categoryId, rawVisibility]) => {
            const normalizedCategoryId = normalizeCategoryText(categoryId);
            const normalizedVisibility = normalizeCategoryVisibility(rawVisibility);

            if (normalizedCategoryId && normalizedVisibility !== null) {
                visibilityEntries.set(
                    normalizedCategoryId,
                    invertVisibility ? !normalizedVisibility : normalizedVisibility,
                );
            }
        });
    });

    return visibilityEntries;
}

function parseLocalCategorySnapshot(value: unknown): ParsedLocalCategorySnapshot {
    const categoryMap = new Map<string, Category>();
    const deletedCategoryIds = new Set<string>();
    const presentationById = new Map<string, CategoryPresentationState>();

    const registerCategory = (rawCategory: unknown) => {
        const normalizedCategory = normalizeCategoryRecord(rawCategory);

        if (!normalizedCategory) {
            return;
        }

        categoryMap.set(normalizedCategory.id, normalizedCategory);
        deletedCategoryIds.delete(normalizedCategory.id);

        mergeCategoryPresentationState(presentationById, normalizedCategory.id, {
            name: normalizedCategory.name,
            isVisible: true,
        });

        if (rawCategory && typeof rawCategory === 'object') {
            const categoryRecord = rawCategory as Record<string, unknown>;
            const sortOrder = extractSortOrderFromCategoryRecord(categoryRecord);
            const isVisible = extractVisibilityFromCategoryRecord(categoryRecord);

            mergeCategoryPresentationState(presentationById, normalizedCategory.id, {
                sortOrder: sortOrder ?? undefined,
                isVisible,
            });
        }
    };

    if (Array.isArray(value)) {
        value.forEach(registerCategory);

        return {
            overrides: {
                categories: Array.from(categoryMap.values()),
                deletedCategoryIds: [],
            },
            presentationById,
        };
    }

    if (!value || typeof value !== 'object') {
        return {
            overrides: createEmptyStoredLocalCategoryOverrides(),
            presentationById,
        };
    }

    const candidate = value as Record<string, unknown>;
    collectCategoryArrayValues(candidate).forEach(registerCategory);

    parseCategoryNameMap(candidate).forEach((categoryName, categoryId) => {
        mergeCategoryPresentationState(presentationById, categoryId, { name: categoryName });
    });

    parseCategorySortOrderMap(candidate).forEach((sortOrder, categoryId) => {
        mergeCategoryPresentationState(presentationById, categoryId, { sortOrder });
    });

    parseCategoryVisibilityMap(candidate, CATEGORY_VISIBILITY_MAP_KEYS).forEach((isVisible, categoryId) => {
        mergeCategoryPresentationState(presentationById, categoryId, { isVisible });
    });

    parseCategoryVisibilityMap(candidate, CATEGORY_HIDDEN_MAP_KEYS, true).forEach((isVisible, categoryId) => {
        mergeCategoryPresentationState(presentationById, categoryId, { isVisible });
    });

    CATEGORY_VISIBLE_ID_LIST_KEYS.forEach(key => {
        normalizeCategoryIdList(candidate[key]).forEach(categoryId => {
            mergeCategoryPresentationState(presentationById, categoryId, { isVisible: true });
        });
    });

    CATEGORY_HIDDEN_ID_LIST_KEYS.forEach(key => {
        normalizeCategoryIdList(candidate[key]).forEach(categoryId => {
            mergeCategoryPresentationState(presentationById, categoryId, { isVisible: false });
        });
    });

    CATEGORY_DELETED_ID_LIST_KEYS.forEach(key => {
        normalizeCategoryIdList(candidate[key]).forEach(categoryId => {
            deletedCategoryIds.add(categoryId);
            categoryMap.delete(categoryId);
            mergeCategoryPresentationState(presentationById, categoryId, { isVisible: false });
        });
    });

    return {
        overrides: {
            categories: Array.from(categoryMap.values()),
            deletedCategoryIds: Array.from(deletedCategoryIds),
        },
        presentationById,
    };
}

function getOrderedLocalCategoryStorageKeys(brand: BrandKey) {
    const canonicalStorageKey = getLocalCategoryStorageKey(brand);
    const knownStorageKeys = [
        ...LEGACY_LOCAL_CATEGORY_STORAGE_KEY_FACTORIES.map(factory => factory(brand)),
        canonicalStorageKey,
    ];

    if (!canUseBrowserStorage()) {
        return knownStorageKeys;
    }

    const discoveredStorageKeys = Object.keys(localStorage)
        .filter(storageKey => {
            const normalizedKey = storageKey.toLowerCase();
            return (
                normalizedKey.includes(brand) &&
                normalizedKey.includes('local') &&
                normalizedKey.includes('categor')
            );
        })
        .sort();

    return Array.from(new Set([...knownStorageKeys, ...discoveredStorageKeys]));
}

function sortCategoriesByPresentation(
    categories: Category[],
    presentationById: Map<string, CategoryPresentationState>,
) {
    return categories
        .map((category, index) => {
            const sortOrder = presentationById.get(category.id)?.sortOrder;
            return {
                category: { ...category },
                index,
                effectiveSortOrder: sortOrder ?? index,
            };
        })
        .sort((left, right) =>
            left.effectiveSortOrder - right.effectiveSortOrder ||
            left.index - right.index,
        )
        .map(item => item.category);
}

function ensureKnownProductCategories(categories: Category[], products: CatalogProduct[]) {
    const knownCategoryMap = new Map(categories.map(category => [category.id, { ...category }]));
    let hasUncategorizedProduct = false;

    const normalizedProducts = products.map(product => {
        const nextCategoryId = normalizeCategoryText(product.categoryId) || UNCATEGORIZED_CATEGORY_ID;

        if (nextCategoryId === UNCATEGORIZED_CATEGORY_ID) {
            hasUncategorizedProduct = true;
        } else if (!knownCategoryMap.has(nextCategoryId)) {
            knownCategoryMap.set(nextCategoryId, {
                id: nextCategoryId,
                name: nextCategoryId,
            });
        }

        return {
            ...product,
            categoryId: nextCategoryId,
            benefits: [...product.benefits],
            deliveryMethods: [...product.deliveryMethods],
        };
    });

    if (hasUncategorizedProduct && !knownCategoryMap.has(UNCATEGORIZED_CATEGORY_ID)) {
        knownCategoryMap.set(UNCATEGORIZED_CATEGORY_ID, {
            id: UNCATEGORIZED_CATEGORY_ID,
            name: 'Sin categoria',
        });
    }

    return {
        categories: Array.from(knownCategoryMap.values()),
        products: normalizedProducts,
    } satisfies CatalogData;
}

function applyBrandLocalCategoryOverrides(data: CatalogData, brand: BrandKey): CatalogData {
    if (!canUseBrowserStorage()) {
        return ensureKnownProductCategories(
            data.categories.map(category => ({ ...category })),
            data.products,
        );
    }

    try {
        const canonicalStorageKey = getLocalCategoryStorageKey(brand);
        const categoryOverrides = readStoredLocalCategoryOverrides(brand);
        const presentationById = new Map<string, CategoryPresentationState>();
        let mergedCategories = data.categories.map(category => ({ ...category }));

        getOrderedLocalCategoryStorageKeys(brand).forEach(storageKey => {
            const parsedSnapshot = parseLocalCategorySnapshot(
                safeParseJson<unknown>(localStorage.getItem(storageKey), null),
            );

            if (storageKey !== canonicalStorageKey) {
                mergedCategories = applyStoredLocalCategoryOverrides(
                    mergedCategories,
                    parsedSnapshot.overrides,
                ).map(category => ({ ...category }));
            }

            parsedSnapshot.presentationById.forEach((state, categoryId) => {
                mergeCategoryPresentationState(presentationById, categoryId, state);
            });
        });

        mergedCategories = applyStoredLocalCategoryOverrides(
            mergedCategories,
            categoryOverrides,
        ).map(category => ({ ...category }));

        const blockedCategoryIds = new Set<string>(
            Array.from(presentationById.entries())
                .filter(([, state]) => state.isVisible === false)
                .map(([categoryId]) => categoryId),
        );

        categoryOverrides.deletedCategoryIds.forEach(categoryId => {
            blockedCategoryIds.add(categoryId);
        });

        const visibleCategories = sortCategoriesByPresentation(
            mergedCategories
                .map(category => {
                    const presentation = presentationById.get(category.id);

                    return presentation?.name
                        ? { ...category, name: presentation.name }
                        : { ...category };
                })
                .filter(category => presentationById.get(category.id)?.isVisible !== false),
            presentationById,
        );

        const normalizedProducts = data.products.map(product => {
            const currentCategoryId = normalizeCategoryText(product.categoryId) || UNCATEGORIZED_CATEGORY_ID;
            const nextCategoryId = blockedCategoryIds.has(currentCategoryId)
                ? UNCATEGORIZED_CATEGORY_ID
                : currentCategoryId;

            return {
                ...product,
                categoryId: nextCategoryId,
                benefits: [...product.benefits],
                deliveryMethods: [...product.deliveryMethods],
            };
        });

        return ensureKnownProductCategories(visibleCategories, normalizedProducts);
    } catch (error) {
        console.error(`Error applying local category overrides for ${brand}:`, error);
        return ensureKnownProductCategories(
            data.categories.map(category => ({ ...category })),
            data.products,
        );
    }
}

function applyBrandLocalOverrides(data: CatalogData, brand: BrandKey): CatalogData {
    if (typeof window === 'undefined') {
        return ensureKnownProductCategories(
            data.categories.map(category => ({ ...category })),
            data.products,
        );
    }

    try {
        const nextProducts = applyLocalCatalogOverrides(
            data.products,
            readLocalCatalogOverrides(brand),
        ).map(product => ({
                ...product,
                benefits: [...product.benefits],
                deliveryMethods: [...product.deliveryMethods],
            }));

        return applyBrandLocalCategoryOverrides({
            categories: data.categories.map(category => ({ ...category })),
            products: nextProducts,
        }, brand);
    } catch (error) {
        console.error(`Error applying local catalog overrides for ${brand}:`, error);
        return ensureKnownProductCategories(
            data.categories.map(category => ({ ...category })),
            data.products,
        );
    }
}

export async function fetchCatalogData(brand: 'natura' | 'nikken' = 'natura'): Promise<CatalogData | null> {
    try {
        if (brand === 'nikken') {
            return applyBrandLocalOverrides(getFallbackData('nikken'), 'nikken');
        }

        const [productsRes, categoriesRes] = await Promise.all([
            odooClient.query({ query: GET_PRODUCTS, variables: { pageSize: 100 } }),
            odooClient.query({ query: GET_CATEGORIES }),
        ]);

        const odooProducts = (productsRes.data as any)?.products?.products || [];
        const odooCategories = (categoriesRes.data as any)?.categories?.categories || [];

        const products: CatalogProduct[] = odooProducts.map((product: any) => ({
            id: String(product.id),
            name: product.name,
            brand: 'Natura',
            subBrand: product.sku || '',
            categoryId: product.categories?.[0]?.id?.toString() || 'uncategorized',
            gender: 'unisex',
            description: product.description || '',
            benefits: [],
            price: product.price?.regular || 0,
            imageUrl: product.image || getOdooImageUrl('product.template', product.id),
            inStock: product.isInStock ?? true,
            deliveryTime: 'Entrega Inmediata',
            deliveryMethods: ['Envio por paqueteria'],
        }));

        const categories: Category[] = odooCategories.map((category: any) => ({
            id: String(category.id),
            name: category.name,
        }));

        if (products.length === 0) {
            console.warn('No products found in Odoo, using mock data fallback.');
            return applyBrandLocalOverrides(getFallbackData('natura'), 'natura');
        }

        return applyBrandLocalOverrides({
            categories: categories.length > 0 ? categories : cloneCatalogData(NATURA_MOCK_DATA).categories,
            products,
        }, 'natura');
    } catch (error) {
        console.error('Error fetching Odoo catalog data, using mock data fallback:', error);
        return applyBrandLocalOverrides(getFallbackData(brand), brand);
    }
}
