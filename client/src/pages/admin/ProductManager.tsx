import React, { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/app/admin/AdminLayout";
import { fetchCatalogData, CatalogProduct, Category } from "@/lib/dataFetcher";
import { useBrand } from "@/contexts/BrandContext";
import {
  Search,
  Filter,
  Edit3,
  Trash2,
  Plus,
  MoreVertical,
  Download,
  ChevronDown,
  Copy,
  PackageCheck,
  PackageX,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/shared/ui/button";
import { Input } from "@/components/shared/ui/input";
import { Card, CardContent } from "@/components/shared/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shared/ui/dropdown-menu";
import {
  generateAmazonCsv,
  generateEbayCsv,
  generateMercadoLibreCsv,
  generateWhatsAppCsv,
} from "@/lib/sharingUtils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shared/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/ui/select";
import { Badge } from "@/components/shared/ui/badge";
import { Textarea } from "@/components/shared/ui/textarea";
import { Switch } from "@/components/shared/ui/switch";
import { ScrollArea } from "@/components/shared/ui/scroll-area";
import { getProductFallbackImage } from "@/lib/storefrontStorage";
import {
  clearLocalCatalogOverrides as clearLocalProductOverrides,
  deleteLocalCatalogProduct,
  isLocalCatalogStorageKeyForBrand,
  readLocalCatalogOverrides as readLocalProductOverrides,
  upsertLocalCatalogProduct,
} from "@/lib/adminCatalogStorage";
import {
  LOCAL_CATEGORY_EVENT_NAME,
  clearLocalCategoryOverrides,
  createLocalCategoryId,
  isCustomCatalogCategoryId,
  isLocalCategoryStorageKeyForBrand,
  readLocalCategoryOverrides,
  saveLocalCategoryOverrides,
  type LocalCategoryOverrides,
} from "@/lib/adminCategoryStorage";
import { client as odooClient } from "@/lib/odoo";
import { GET_CATEGORIES } from "@/lib/odooQueries";

type StockFilter = "all" | "in-stock" | "out-of-stock";
type EditorMode = "create" | "edit";
type BrandKey = "natura" | "nikken";
type CategoryEditorMode = "create" | "rename";

interface DraftProduct {
  name: string;
  subBrand: string;
  categoryId: string;
  description: string;
  price: string;
  imageUrl: string;
  inStock: boolean;
  deliveryTime: string;
  deliveryMethodsText: string;
  benefitsText: string;
}

interface CategoryAdminState {
  orderedVisibleCategoryIds: string[];
  hiddenCategories: Category[];
}

type OdooCategoriesQueryResult = {
  categories?: {
    categories?: Array<{
      id?: string | number;
      name?: string | null;
    }>;
  };
};

const NATURA_BASE_CATEGORIES: Category[] = [
  { id: "1", name: "Perfumeria" },
  { id: "2", name: "Maquillaje" },
  { id: "3", name: "Cuerpo" },
  { id: "4", name: "Cabello" },
];

const NIKKEN_BASE_CATEGORIES: Category[] = [
  { id: "nikken-1", name: "Agua (PiMag)" },
  { id: "nikken-2", name: "Nutricion (Kenzen)" },
  { id: "nikken-3", name: "Descanso (Kenko Sleep)" },
  { id: "nikken-4", name: "Aire (KenkoAir)" },
  { id: "nikken-5", name: "Piel (True Elements)" },
  { id: "nikken-6", name: "Joyas y Magnetismo" },
];

const baseCategoryCache = new Map<BrandKey, Category[]>();

function brandLabel(brand: string) {
  return brand === "nikken" ? "Nikken" : "Natura";
}

function cloneCategories(categories: Category[]) {
  return categories.map(category => ({ ...category }));
}

function createEmptyLocalCategoryOverrides(): LocalCategoryOverrides {
  return {
    categories: [],
    deletedCategoryIds: [],
  };
}

function createEmptyCategoryAdminState(): CategoryAdminState {
  return {
    orderedVisibleCategoryIds: [],
    hiddenCategories: [],
  };
}

function normalizeCategoryName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeCategoryRecord(value: unknown): Category | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<Category>;
  const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
  const name = normalizeCategoryName(
    typeof candidate.name === "string" ? candidate.name : ""
  );

  if (!id || !name) {
    return null;
  }

  return { id, name };
}

function normalizeCategoryIdList(value: unknown) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,;,|]+/g)
      : [];

  return Array.from(
    new Set(
      rawValues
        .map(item => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    )
  );
}

function getCategoryAdminStorageKey(brand: BrandKey) {
  return `catalog_local_category_admin_${brand}`;
}

function normalizeCategoryAdminState(value: unknown): CategoryAdminState {
  if (!value || typeof value !== "object") {
    return createEmptyCategoryAdminState();
  }

  const candidate = value as Partial<CategoryAdminState>;

  return {
    orderedVisibleCategoryIds: normalizeCategoryIdList(
      candidate.orderedVisibleCategoryIds
    ),
    hiddenCategories: Array.isArray(candidate.hiddenCategories)
      ? candidate.hiddenCategories
          .map(category => normalizeCategoryRecord(category))
          .filter((category): category is Category => category !== null)
      : [],
  };
}

function readCategoryAdminState(brand: BrandKey): CategoryAdminState {
  if (typeof window === "undefined") {
    return createEmptyCategoryAdminState();
  }

  try {
    const raw = window.localStorage.getItem(getCategoryAdminStorageKey(brand));
    if (!raw) {
      return createEmptyCategoryAdminState();
    }

    return normalizeCategoryAdminState(
      JSON.parse(raw) as Partial<CategoryAdminState>
    );
  } catch {
    return createEmptyCategoryAdminState();
  }
}

function saveCategoryAdminState(
  brand: BrandKey,
  adminState: CategoryAdminState
) {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = getCategoryAdminStorageKey(brand);
  window.localStorage.setItem(
    storageKey,
    JSON.stringify(normalizeCategoryAdminState(adminState))
  );
  window.dispatchEvent(
    new CustomEvent(LOCAL_CATEGORY_EVENT_NAME, {
      detail: { brand, storageKey },
    })
  );
}

function clearCategoryAdminState(brand: BrandKey) {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = getCategoryAdminStorageKey(brand);
  window.localStorage.removeItem(storageKey);
  window.dispatchEvent(
    new CustomEvent(LOCAL_CATEGORY_EVENT_NAME, {
      detail: { brand, storageKey },
    })
  );
}

function mergeBaseCategorySources(
  baseCategories: Category[],
  storefrontCategories: Category[]
): Category[] {
  const mergedCategories = cloneCategories(baseCategories);
  const knownCategoryIds = new Set(
    mergedCategories.map(category => category.id)
  );

  for (const category of storefrontCategories) {
    if (
      !knownCategoryIds.has(category.id) &&
      !isCustomCatalogCategoryId(category.id)
    ) {
      mergedCategories.push({ ...category });
      knownCategoryIds.add(category.id);
    }
  }

  return mergedCategories;
}

function buildVisibleCategories(
  baseCategories: Category[],
  overrides: LocalCategoryOverrides
): Category[] {
  const deletedCategoryIds = new Set(overrides.deletedCategoryIds);
  const baseCategoryIds = new Set(baseCategories.map(category => category.id));
  const categoryOverrides = new Map(
    overrides.categories.map(category => [category.id, category])
  );

  const visibleBaseCategories = baseCategories
    .filter(category => !deletedCategoryIds.has(category.id))
    .map(category => ({
      ...categoryOverrides.get(category.id),
      id: category.id,
      name: categoryOverrides.get(category.id)?.name ?? category.name,
    }));

  const visibleLocalCategories = overrides.categories.filter(
    category =>
      !baseCategoryIds.has(category.id) && !deletedCategoryIds.has(category.id)
  );

  return [
    ...visibleBaseCategories,
    ...visibleLocalCategories.map(category => ({ ...category })),
  ];
}

function buildHiddenCategories(
  baseCategories: Category[],
  overrides: LocalCategoryOverrides,
  adminState: CategoryAdminState
) {
  const deletedCategoryIds = new Set(overrides.deletedCategoryIds);
  const baseCategoryMap = new Map(
    baseCategories.map(category => [category.id, category])
  );
  const categoryOverrides = new Map(
    overrides.categories.map(category => [category.id, category])
  );
  const hiddenCategoryMap = new Map(
    adminState.hiddenCategories.map(category => [category.id, category])
  );

  const hiddenCategories = adminState.hiddenCategories
    .filter(category => deletedCategoryIds.has(category.id))
    .map(category => ({ ...category }));

  for (const categoryId of overrides.deletedCategoryIds) {
    if (hiddenCategoryMap.has(categoryId)) {
      continue;
    }

    const fallbackCategory = categoryOverrides.get(categoryId) ??
      baseCategoryMap.get(categoryId) ?? {
        id: categoryId,
        name: categoryId,
      };

    hiddenCategories.push({ ...fallbackCategory });
  }

  return hiddenCategories;
}

function orderCategories(categories: Category[], orderedCategoryIds: string[]) {
  if (orderedCategoryIds.length === 0) {
    return cloneCategories(categories);
  }

  const categoryMap = new Map(
    categories.map(category => [category.id, category])
  );
  const orderedCategories: Category[] = [];

  for (const categoryId of orderedCategoryIds) {
    const category = categoryMap.get(categoryId);
    if (!category) {
      continue;
    }

    orderedCategories.push({ ...category });
    categoryMap.delete(categoryId);
  }

  categoryMap.forEach(category => {
    orderedCategories.push({ ...category });
  });

  return orderedCategories;
}

function hasCustomVisibleCategoryOrder(
  adminState: CategoryAdminState,
  naturalVisibleCategories: Category[]
) {
  const naturalCategoryIds = naturalVisibleCategories.map(
    category => category.id
  );
  const orderedCategoryIds = orderCategories(
    naturalVisibleCategories,
    adminState.orderedVisibleCategoryIds
  ).map(category => category.id);

  return orderedCategoryIds.join("|") !== naturalCategoryIds.join("|");
}

function hasLocalCategoryChanges(
  overrides: LocalCategoryOverrides,
  adminState: CategoryAdminState,
  baseCategories: Category[]
) {
  return (
    overrides.categories.length > 0 ||
    overrides.deletedCategoryIds.length > 0 ||
    hasCustomVisibleCategoryOrder(
      adminState,
      buildVisibleCategories(baseCategories, overrides)
    )
  );
}

async function loadBaseCategories(brand: BrandKey) {
  const cachedCategories = baseCategoryCache.get(brand);
  if (cachedCategories) {
    return cloneCategories(cachedCategories);
  }

  const fallbackCategories =
    brand === "nikken"
      ? cloneCategories(NIKKEN_BASE_CATEGORIES)
      : cloneCategories(NATURA_BASE_CATEGORIES);

  if (brand === "nikken") {
    baseCategoryCache.set(brand, fallbackCategories);
    return fallbackCategories;
  }

  try {
    const response = await odooClient.query<OdooCategoriesQueryResult>({
      query: GET_CATEGORIES,
      fetchPolicy: "network-only",
    });
    const categories =
      response.data?.categories?.categories
        ?.map(category => ({
          id: String(category.id ?? "").trim(),
          name: normalizeCategoryName(category.name ?? ""),
        }))
        .filter(category => category.id && category.name) ?? [];

    if (categories.length > 0) {
      baseCategoryCache.set(brand, categories);
      return cloneCategories(categories);
    }
  } catch {
    // ProductManager falls back to the last known local-safe category list.
  }

  baseCategoryCache.set(brand, fallbackCategories);
  return fallbackCategories;
}

function getDefaultCategoryId(categories: Category[]) {
  return categories[0]?.id || "uncategorized";
}

function getDefaultDeliveryTime(brand: "natura" | "nikken") {
  return brand === "nikken" ? "3-5 dias habiles" : "Entrega Inmediata";
}

function getDefaultDeliveryMethodsText(brand: "natura" | "nikken") {
  return brand === "nikken" ? "Envio nacional" : "Envio a domicilio";
}

function createEmptyDraft(
  brand: "natura" | "nikken",
  categories: Category[]
): DraftProduct {
  return {
    name: "",
    subBrand: "",
    categoryId: getDefaultCategoryId(categories),
    description: "",
    price: "",
    imageUrl: "",
    inStock: true,
    deliveryTime: getDefaultDeliveryTime(brand),
    deliveryMethodsText: getDefaultDeliveryMethodsText(brand),
    benefitsText: "",
  };
}

function normalizeListInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map(item => item.trim())
        .filter(Boolean)
    )
  );
}

function buildDraftFromProduct(product: CatalogProduct): DraftProduct {
  return {
    name: product.name,
    subBrand: product.subBrand,
    categoryId: product.categoryId,
    description: product.description,
    price: String(product.price),
    imageUrl: product.imageUrl,
    inStock: product.inStock,
    deliveryTime: product.deliveryTime,
    deliveryMethodsText: product.deliveryMethods.join("\n"),
    benefitsText: product.benefits.join("\n"),
  };
}

export default function ProductManager() {
  const { brand } = useBrand();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [baseCategories, setBaseCategories] = useState<Category[]>([]);
  const [localCategoryOverrides, setLocalCategoryOverrides] =
    useState<LocalCategoryOverrides>(() => createEmptyLocalCategoryOverrides());
  const [categoryAdminState, setCategoryAdminState] =
    useState<CategoryAdminState>(() => createEmptyCategoryAdminState());
  const [loading, setLoading] = useState(true);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogProduct | null>(null);
  const [clearLocalChangesOpen, setClearLocalChangesOpen] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [categoryEditorMode, setCategoryEditorMode] =
    useState<CategoryEditorMode>("create");
  const [categoryDraftName, setCategoryDraftName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null
  );
  const [draft, setDraft] = useState<DraftProduct>(() =>
    createEmptyDraft(brand, [])
  );
  const naturalVisibleCategories = useMemo(
    () => buildVisibleCategories(baseCategories, localCategoryOverrides),
    [baseCategories, localCategoryOverrides]
  );
  const hiddenCategories = useMemo(
    () =>
      buildHiddenCategories(
        baseCategories,
        localCategoryOverrides,
        categoryAdminState
      ),
    [baseCategories, localCategoryOverrides, categoryAdminState]
  );
  const categories = useMemo(
    () =>
      orderCategories(
        naturalVisibleCategories,
        categoryAdminState.orderedVisibleCategoryIds
      ),
    [naturalVisibleCategories, categoryAdminState.orderedVisibleCategoryIds]
  );

  const loadCatalog = async (
    currentBrand: BrandKey = brand,
    options?: { preserveDraft?: boolean }
  ) => {
    setLoading(true);
    try {
      const [data, rawBaseCategories] = await Promise.all([
        fetchCatalogData(currentBrand),
        loadBaseCategories(currentBrand),
      ]);
      if (!data) return;

      const nextBaseCategories = mergeBaseCategorySources(
        rawBaseCategories,
        data.categories
      );
      const localProductOverrides = readLocalProductOverrides(currentBrand);
      const localCategories = readLocalCategoryOverrides(currentBrand);
      const nextCategoryAdminState = readCategoryAdminState(currentBrand);
      const visibleCategories = orderCategories(
        buildVisibleCategories(nextBaseCategories, localCategories),
        nextCategoryAdminState.orderedVisibleCategoryIds
      );
      const hiddenCategoryList = buildHiddenCategories(
        nextBaseCategories,
        localCategories,
        nextCategoryAdminState
      );
      const knownCategoryIds = new Set(
        [...visibleCategories, ...hiddenCategoryList].map(
          category => category.id
        )
      );

      setProducts(data.products);
      setBaseCategories(nextBaseCategories);
      setLocalCategoryOverrides(localCategories);
      setCategoryAdminState(nextCategoryAdminState);
      setHasLocalChanges(
        localProductOverrides.products.length > 0 ||
          localProductOverrides.deletedProductIds.length > 0 ||
          hasLocalCategoryChanges(
            localCategories,
            nextCategoryAdminState,
            nextBaseCategories
          )
      );

      if (!options?.preserveDraft) {
        setDraft(createEmptyDraft(currentBrand, visibleCategories));
      } else {
        setDraft(prev => ({
          ...prev,
          categoryId:
            prev.categoryId && knownCategoryIds.has(prev.categoryId)
              ? prev.categoryId
              : getDefaultCategoryId(visibleCategories),
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCategoryFilter("all");
    setSearchTerm("");
    setEditorOpen(false);
    setEditorMode("create");
    setEditingTargetId(null);
    setCategoryManagerOpen(false);
    setCategoryEditorMode("create");
    setCategoryDraftName("");
    setEditingCategoryId(null);
    setLocalCategoryOverrides(createEmptyLocalCategoryOverrides());
    setCategoryAdminState(createEmptyCategoryAdminState());
    setDeleteTarget(null);
    setClearLocalChangesOpen(false);
    setDraft(createEmptyDraft(brand, []));
    void loadCatalog(brand);
  }, [brand]);

  useEffect(() => {
    const syncCatalog = () => {
      void loadCatalog(brand, { preserveDraft: editorOpen });
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (
        isLocalCatalogStorageKeyForBrand(event.key, brand) ||
        isLocalCategoryStorageKeyForBrand(event.key, brand) ||
        event.key === getCategoryAdminStorageKey(brand)
      ) {
        syncCatalog();
      }
    };

    const handleLocalCatalogEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{
        brand?: string;
        storageKey?: string;
      }>;
      if (
        customEvent.detail?.brand === brand ||
        isLocalCatalogStorageKeyForBrand(customEvent.detail?.storageKey, brand)
      ) {
        syncCatalog();
      }
    };

    const handleLocalCategoryEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{
        brand?: string;
        storageKey?: string;
      }>;
      if (
        customEvent.detail?.brand === brand ||
        isLocalCategoryStorageKeyForBrand(
          customEvent.detail?.storageKey,
          brand
        ) ||
        customEvent.detail?.storageKey === getCategoryAdminStorageKey(brand)
      ) {
        syncCatalog();
      }
    };

    window.addEventListener("storage", handleStorageEvent);
    window.addEventListener(
      "catalog-local-products-changed",
      handleLocalCatalogEvent
    );
    window.addEventListener(
      LOCAL_CATEGORY_EVENT_NAME,
      handleLocalCategoryEvent
    );

    return () => {
      window.removeEventListener("storage", handleStorageEvent);
      window.removeEventListener(
        "catalog-local-products-changed",
        handleLocalCatalogEvent
      );
      window.removeEventListener(
        LOCAL_CATEGORY_EVENT_NAME,
        handleLocalCategoryEvent
      );
    };
  }, [brand, editorOpen]);

  useEffect(() => {
    if (
      categoryFilter !== "all" &&
      !categories.some(category => category.id === categoryFilter)
    ) {
      setCategoryFilter("all");
    }
  }, [categories, categoryFilter]);

  const categoryMap = useMemo(
    () => new Map(categories.map(category => [category.id, category.name])),
    [categories]
  );
  const hiddenCategoryMap = useMemo(
    () => new Map(hiddenCategories.map(category => [category.id, category])),
    [hiddenCategories]
  );
  const allCategoryMap = useMemo(
    () =>
      new Map(
        [...categories, ...hiddenCategories].map(category => [
          category.id,
          category,
        ])
      ),
    [categories, hiddenCategories]
  );
  const baseCategoryMap = useMemo(
    () => new Map(baseCategories.map(category => [category.id, category.name])),
    [baseCategories]
  );
  const hiddenCategoryIdSet = useMemo(
    () => new Set(hiddenCategories.map(category => category.id)),
    [hiddenCategories]
  );
  const localCategoryIdSet = useMemo(() => {
    const localCategoryIds = new Set<string>();

    for (const category of [...categories, ...hiddenCategories]) {
      if (
        !baseCategoryMap.has(category.id) ||
        isCustomCatalogCategoryId(category.id)
      ) {
        localCategoryIds.add(category.id);
      }
    }

    return localCategoryIds;
  }, [categories, hiddenCategories, baseCategoryMap]);
  const renamedCategoryCount = useMemo(() => {
    const renamedBaseIds = new Set<string>();

    for (const category of Array.from(allCategoryMap.values())) {
      const baseName = baseCategoryMap.get(category.id);
      if (baseName && baseName !== category.name) {
        renamedBaseIds.add(category.id);
      }
    }

    return renamedBaseIds.size;
  }, [allCategoryMap, baseCategoryMap]);
  const localCategoryCount = useMemo(
    () => localCategoryIdSet.size,
    [localCategoryIdSet]
  );
  const hiddenCategoryCount = hiddenCategories.length;
  const hasCustomCategoryOrder = useMemo(
    () =>
      hasCustomVisibleCategoryOrder(
        categoryAdminState,
        naturalVisibleCategories
      ),
    [categoryAdminState, naturalVisibleCategories]
  );
  const categoryUsageMap = useMemo(() => {
    const usage = new Map<string, number>();
    for (const product of products) {
      usage.set(product.categoryId, (usage.get(product.categoryId) ?? 0) + 1);
    }
    return usage;
  }, [products]);
  const hasLocalCategoryOverrides = hasLocalCategoryChanges(
    localCategoryOverrides,
    categoryAdminState,
    baseCategories
  );

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        product.name.toLowerCase().includes(search) ||
        product.subBrand.toLowerCase().includes(search) ||
        product.description.toLowerCase().includes(search);
      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "in-stock" && product.inStock) ||
        (stockFilter === "out-of-stock" && !product.inStock);
      const matchesCategory =
        categoryFilter === "all" || product.categoryId === categoryFilter;

      return matchesSearch && matchesStock && matchesCategory;
    });
  }, [products, searchTerm, stockFilter, categoryFilter]);

  const exportProducts = filteredProducts;
  const editingTarget = useMemo(
    () => products.find(product => product.id === editingTargetId) ?? null,
    [products, editingTargetId]
  );
  const previewBenefits = useMemo(
    () => normalizeListInput(draft.benefitsText),
    [draft.benefitsText]
  );
  const previewDeliveryMethods = useMemo(
    () => normalizeListInput(draft.deliveryMethodsText),
    [draft.deliveryMethodsText]
  );
  const draftHiddenCategory = useMemo(
    () => hiddenCategoryMap.get(draft.categoryId) ?? null,
    [hiddenCategoryMap, draft.categoryId]
  );
  const previewImageUrl =
    draft.imageUrl.trim() || getProductFallbackImage(brand);

  const syncHasLocalChanges = (
    nextCategoryOverrides: LocalCategoryOverrides,
    nextCategoryAdminState: CategoryAdminState
  ) => {
    const localProductOverrides = readLocalProductOverrides(brand);
    setHasLocalChanges(
      localProductOverrides.products.length > 0 ||
        localProductOverrides.deletedProductIds.length > 0 ||
        hasLocalCategoryChanges(
          nextCategoryOverrides,
          nextCategoryAdminState,
          baseCategories
        )
    );
  };

  const persistCategoryState = (
    nextOverrides: LocalCategoryOverrides,
    nextAdminState: CategoryAdminState
  ) => {
    const normalizedAdminState = normalizeCategoryAdminState(nextAdminState);
    setLocalCategoryOverrides(nextOverrides);
    setCategoryAdminState(normalizedAdminState);
    syncHasLocalChanges(nextOverrides, normalizedAdminState);
    saveLocalCategoryOverrides(brand, nextOverrides);
    saveCategoryAdminState(brand, normalizedAdminState);
  };

  const resetCategoryEditor = () => {
    setCategoryEditorMode("create");
    setCategoryDraftName("");
    setEditingCategoryId(null);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditorMode("create");
    setEditingTargetId(null);
    setDraft(createEmptyDraft(brand, categories));
  };

  const openCreateDialog = () => {
    setEditorMode("create");
    setEditingTargetId(null);
    setDraft(createEmptyDraft(brand, categories));
    setEditorOpen(true);
  };

  const openEditDialog = (product: CatalogProduct) => {
    setEditorMode("edit");
    setEditingTargetId(product.id);
    setDraft(buildDraftFromProduct(product));
    setEditorOpen(true);
  };

  const openDuplicateDialog = (product: CatalogProduct) => {
    setEditorMode("create");
    setEditingTargetId(null);
    setDraft({
      ...buildDraftFromProduct(product),
      name: `${product.name} Copia`,
    });
    setEditorOpen(true);
  };

  const handleCategoryManagerOpenChange = (open: boolean) => {
    setCategoryManagerOpen(open);
    if (!open) {
      resetCategoryEditor();
    }
  };

  const openRenameCategory = (category: Category) => {
    setCategoryManagerOpen(true);
    setCategoryEditorMode("rename");
    setEditingCategoryId(category.id);
    setCategoryDraftName(category.name);
  };

  const handleEditorOpenChange = (open: boolean) => {
    if (!open) {
      closeEditor();
      return;
    }

    setEditorOpen(true);
  };

  const handleSaveCategory = () => {
    const nextName = normalizeCategoryName(categoryDraftName);

    if (!nextName) {
      toast.error("Escribe un nombre para la categoria.");
      return;
    }

    const duplicateCategory = Array.from(allCategoryMap.values()).find(
      category => {
        if (
          categoryEditorMode === "rename" &&
          category.id === editingCategoryId
        ) {
          return false;
        }

        return category.name.trim().toLowerCase() === nextName.toLowerCase();
      }
    );

    if (duplicateCategory) {
      toast.error("Ya existe una categoria con ese nombre en esta marca.");
      return;
    }

    const nextOverrides: LocalCategoryOverrides = {
      categories: localCategoryOverrides.categories.map(category => ({
        ...category,
      })),
      deletedCategoryIds: [...localCategoryOverrides.deletedCategoryIds],
    };
    const nextAdminState: CategoryAdminState = {
      orderedVisibleCategoryIds: [
        ...categoryAdminState.orderedVisibleCategoryIds,
      ],
      hiddenCategories: categoryAdminState.hiddenCategories.map(category => ({
        ...category,
      })),
    };

    let createdCategory: Category | null = null;

    if (categoryEditorMode === "create") {
      createdCategory = {
        id: createLocalCategoryId(),
        name: nextName,
      };
      const createdCategoryId = createdCategory.id;
      nextOverrides.categories = [
        createdCategory,
        ...nextOverrides.categories.filter(
          category => category.id !== createdCategoryId
        ),
      ];
      nextOverrides.deletedCategoryIds =
        nextOverrides.deletedCategoryIds.filter(
          categoryId => categoryId !== createdCategoryId
        );
      nextAdminState.hiddenCategories = nextAdminState.hiddenCategories.filter(
        category => category.id !== createdCategoryId
      );
      nextAdminState.orderedVisibleCategoryIds = [
        createdCategoryId,
        ...nextAdminState.orderedVisibleCategoryIds.filter(
          categoryId => categoryId !== createdCategoryId
        ),
      ];
    } else {
      if (!editingCategoryId) {
        toast.error("No encontramos la categoria a renombrar.");
        return;
      }

      const currentCategory =
        allCategoryMap.get(editingCategoryId) ??
        ({
          id: editingCategoryId,
          name: nextName,
        } satisfies Category);

      if (hiddenCategoryIdSet.has(editingCategoryId)) {
        nextOverrides.categories = nextOverrides.categories.filter(
          category => category.id !== editingCategoryId
        );
        nextAdminState.hiddenCategories = [
          { ...currentCategory, name: nextName },
          ...nextAdminState.hiddenCategories.filter(
            category => category.id !== editingCategoryId
          ),
        ];
      } else if (localCategoryIdSet.has(editingCategoryId)) {
        nextOverrides.categories = [
          { ...currentCategory, name: nextName },
          ...nextOverrides.categories.filter(
            category => category.id !== editingCategoryId
          ),
        ];
      } else {
        const baseName = baseCategoryMap.get(editingCategoryId);
        if (!baseName) {
          toast.error("La categoria base ya no esta disponible.");
          return;
        }

        nextOverrides.categories = nextOverrides.categories.filter(
          category => category.id !== editingCategoryId
        );
        if (baseName !== nextName) {
          nextOverrides.categories = [
            { ...currentCategory, name: nextName },
            ...nextOverrides.categories,
          ];
        }
      }
    }

    persistCategoryState(nextOverrides, nextAdminState);

    if (createdCategory) {
      setDraft(prev => ({
        ...prev,
        categoryId:
          editorOpen || prev.categoryId === "uncategorized"
            ? createdCategory.id
            : prev.categoryId,
      }));
    }

    resetCategoryEditor();
    toast.success(
      categoryEditorMode === "create"
        ? `Categoria creada localmente para ${brandLabel(brand)}.`
        : `Categoria actualizada localmente para ${brandLabel(brand)}.`
    );
  };

  const moveCategory = (categoryId: string, direction: "up" | "down") => {
    const currentOrder = categories.map(category => category.id);
    const currentIndex = currentOrder.indexOf(categoryId);
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (
      currentIndex === -1 ||
      nextIndex < 0 ||
      nextIndex >= currentOrder.length
    ) {
      return;
    }

    const nextOrder = [...currentOrder];
    [nextOrder[currentIndex], nextOrder[nextIndex]] = [
      nextOrder[nextIndex],
      nextOrder[currentIndex],
    ];

    persistCategoryState(localCategoryOverrides, {
      ...categoryAdminState,
      orderedVisibleCategoryIds: nextOrder,
    });

    toast.success("Orden local de categorias actualizado.");
  };

  const toggleCategoryVisibility = (
    category: Category,
    shouldBeVisible: boolean
  ) => {
    const nextOverrides: LocalCategoryOverrides = {
      categories: localCategoryOverrides.categories.map(existingCategory => ({
        ...existingCategory,
      })),
      deletedCategoryIds: [...localCategoryOverrides.deletedCategoryIds],
    };
    const nextAdminState: CategoryAdminState = {
      orderedVisibleCategoryIds: [
        ...categoryAdminState.orderedVisibleCategoryIds,
      ],
      hiddenCategories: categoryAdminState.hiddenCategories.map(
        existingCategory => ({
          ...existingCategory,
        })
      ),
    };
    const baseName = baseCategoryMap.get(category.id);
    const hiddenSnapshot = hiddenCategoryMap.get(category.id);

    if (shouldBeVisible) {
      const restoredCategory = hiddenSnapshot ?? category;

      nextOverrides.deletedCategoryIds =
        nextOverrides.deletedCategoryIds.filter(
          categoryId => categoryId !== category.id
        );
      nextAdminState.hiddenCategories = nextAdminState.hiddenCategories.filter(
        hiddenCategory => hiddenCategory.id !== category.id
      );
      nextAdminState.orderedVisibleCategoryIds = [
        ...nextAdminState.orderedVisibleCategoryIds.filter(
          categoryId => categoryId !== category.id
        ),
        category.id,
      ];

      if (!baseName || isCustomCatalogCategoryId(category.id)) {
        nextOverrides.categories = [
          restoredCategory,
          ...nextOverrides.categories.filter(
            existingCategory => existingCategory.id !== category.id
          ),
        ];
      } else {
        nextOverrides.categories = nextOverrides.categories.filter(
          existingCategory => existingCategory.id !== category.id
        );

        if (restoredCategory.name !== baseName) {
          nextOverrides.categories = [
            restoredCategory,
            ...nextOverrides.categories,
          ];
        }
      }

      persistCategoryState(nextOverrides, nextAdminState);
      toast.success(`Categoria visible otra vez para ${brandLabel(brand)}.`);
      return;
    }

    nextOverrides.deletedCategoryIds = Array.from(
      new Set([...nextOverrides.deletedCategoryIds, category.id])
    );
    nextOverrides.categories = nextOverrides.categories.filter(
      existingCategory => existingCategory.id !== category.id
    );
    nextAdminState.hiddenCategories = [
      { ...category },
      ...nextAdminState.hiddenCategories.filter(
        hiddenCategory => hiddenCategory.id !== category.id
      ),
    ];
    nextAdminState.orderedVisibleCategoryIds =
      nextAdminState.orderedVisibleCategoryIds.filter(
        categoryId => categoryId !== category.id
      );

    if (categoryFilter === category.id) {
      setCategoryFilter("all");
    }

    persistCategoryState(nextOverrides, nextAdminState);
    toast.success(
      `Categoria oculta localmente. Si un draft la sigue usando, podras guardarlo, pero el storefront la tratara como "Sin categoria" mientras siga oculta.`
    );
  };

  const handleSaveProduct = () => {
    const parsedPrice = Number(draft.price);
    const deliveryMethods = normalizeListInput(draft.deliveryMethodsText);
    const benefits = normalizeListInput(draft.benefitsText);

    if (!draft.name.trim()) {
      toast.error("Agrega un nombre para el producto.");
      return;
    }

    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      toast.error("Ingresa un precio valido.");
      return;
    }

    if (!draft.description.trim()) {
      toast.error("Agrega una descripcion util para el producto.");
      return;
    }

    if (deliveryMethods.length === 0) {
      toast.error("Define al menos un metodo de entrega.");
      return;
    }

    const existingProduct =
      editorMode === "edit"
        ? (products.find(product => product.id === editingTargetId) ?? null)
        : null;

    if (editorMode === "edit" && !existingProduct) {
      toast.error("El producto ya no esta disponible para edicion.");
      closeEditor();
      return;
    }

    const nextProduct: CatalogProduct = {
      id: existingProduct?.id ?? `draft-${Date.now()}`,
      name: draft.name.trim(),
      brand: existingProduct?.brand ?? brandLabel(brand),
      subBrand: draft.subBrand.trim(),
      categoryId: draft.categoryId || getDefaultCategoryId(categories),
      gender: existingProduct?.gender ?? "unisex",
      description: draft.description.trim(),
      benefits,
      price: parsedPrice,
      imageUrl: draft.imageUrl.trim() || getProductFallbackImage(brand),
      inStock: draft.inStock,
      paymentLink: existingProduct?.paymentLink,
      deliveryTime: draft.deliveryTime.trim() || getDefaultDeliveryTime(brand),
      deliveryMethods,
    };

    setProducts(prev =>
      editorMode === "edit"
        ? prev.map(product =>
            product.id === nextProduct.id ? nextProduct : product
          )
        : [nextProduct, ...prev]
    );
    upsertLocalCatalogProduct(brand, nextProduct);
    setHasLocalChanges(true);
    closeEditor();
    toast.success(
      editorMode === "edit"
        ? `Producto actualizado localmente para ${brandLabel(brand)}.`
        : `Producto guardado localmente para ${brandLabel(brand)}.`
    );
  };

  const toggleStock = (productId: string) => {
    const targetProduct = products.find(product => product.id === productId);
    if (!targetProduct) return;

    const nextProduct = { ...targetProduct, inStock: !targetProduct.inStock };
    setProducts(prev =>
      prev.map(product => (product.id === productId ? nextProduct : product))
    );
    upsertLocalCatalogProduct(brand, nextProduct);
    setHasLocalChanges(true);
    toast.success(
      targetProduct.inStock
        ? "Producto marcado como agotado."
        : "Producto marcado como disponible."
    );
  };

  const deleteProduct = () => {
    if (!deleteTarget) return;

    setProducts(prev => prev.filter(product => product.id !== deleteTarget.id));
    deleteLocalCatalogProduct(brand, deleteTarget.id);
    setHasLocalChanges(true);
    toast.success(
      `Producto eliminado del catalogo local de ${brandLabel(brand)}.`
    );
    setDeleteTarget(null);
  };

  const resetLocalChanges = async () => {
    setLoading(true);
    try {
      clearLocalProductOverrides(brand);
      clearLocalCategoryOverrides(brand);
      clearCategoryAdminState(brand);
      closeEditor();
      setCategoryManagerOpen(false);
      resetCategoryEditor();
      setDeleteTarget(null);
      setClearLocalChangesOpen(false);
      await loadCatalog(brand);
      toast.success(`Cambios locales de ${brandLabel(brand)} limpiados.`);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setStockFilter("all");
    setCategoryFilter("all");
    setSearchTerm("");
  };

  const editorTitle =
    editorMode === "edit" ? "Editar producto local" : "Nuevo producto local";
  const editorDescription =
    editorMode === "edit"
      ? `Actualiza nombre, descripcion, imagen, entrega y precio. El cambio queda guardado en este navegador para ${brandLabel(brand)}.`
      : `Crea un producto local completo para ${brandLabel(brand)}. Esta alta no modifica Odoo ni el catalogo remoto.`;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Gestion de Productos
            </h1>
            <p className="text-slate-500">
              Administra el catalogo de {brandLabel(brand)} con altas y
              ediciones persistentes en este navegador para cada marca.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {hasLocalChanges && (
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setClearLocalChangesOpen(true)}
              >
                Limpiar cambios locales
              </Button>
            )}
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setCategoryManagerOpen(true)}
            >
              Gestionar categorias
            </Button>
            <Button
              className="rounded-xl flex items-center gap-2"
              onClick={openCreateDialog}
            >
              <Plus size={18} />
              Nuevo Producto
            </Button>
          </div>
        </div>

        <Card className="border-none shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="p-4 border-b border-slate-100 flex flex-col gap-4 bg-white">
              <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                <div className="relative w-full lg:w-96">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <Input
                    placeholder="Buscar por nombre, submarca o descripcion..."
                    className="pl-10 rounded-xl border-slate-200 focus:ring-primary/20"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                  <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                    <Filter size={16} />
                    <span>Filtros</span>
                  </div>

                  <Select
                    value={stockFilter}
                    onValueChange={value =>
                      setStockFilter(value as StockFilter)
                    }
                  >
                    <SelectTrigger className="rounded-xl border-slate-200 w-full sm:w-[180px]">
                      <SelectValue placeholder="Stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todo el stock</SelectItem>
                      <SelectItem value="in-stock">Solo disponibles</SelectItem>
                      <SelectItem value="out-of-stock">
                        Solo agotados
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={categoryFilter}
                    onValueChange={setCategoryFilter}
                  >
                    <SelectTrigger className="rounded-xl border-slate-200 w-full sm:w-[220px]">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las categorias</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    className="rounded-xl border-slate-200"
                    onClick={clearFilters}
                  >
                    Limpiar
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="rounded-xl flex items-center gap-2 border-slate-200"
                        disabled={exportProducts.length === 0}
                      >
                        <Download size={18} />
                        Exportar
                        <ChevronDown size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-64 rounded-xl p-2"
                    >
                      <DropdownMenuLabel className="px-3 py-2">
                        Exportar {exportProducts.length} producto
                        {exportProducts.length === 1 ? "" : "s"}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => generateWhatsAppCsv(exportProducts)}
                        className="rounded-lg cursor-pointer"
                      >
                        Catalogo WhatsApp
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => generateMercadoLibreCsv(exportProducts)}
                        className="rounded-lg cursor-pointer"
                      >
                        CSV Mercado Libre
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => generateEbayCsv(exportProducts)}
                        className="rounded-lg cursor-pointer"
                      >
                        CSV eBay
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => generateAmazonCsv(exportProducts)}
                        className="rounded-lg cursor-pointer"
                      >
                        TXT Amazon
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="rounded-full border-slate-200 px-3 py-1 text-slate-500"
                >
                  {exportProducts.length} de {products.length} productos
                  visibles
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-full border-slate-200 px-3 py-1 text-slate-500"
                >
                  {categories.length} categorias activas
                </Badge>
                {hasLocalChanges && (
                  <Badge
                    variant="outline"
                    className="rounded-full border-amber-200 px-3 py-1 text-amber-700"
                  >
                    Cambios locales persistentes para {brandLabel(brand)}
                  </Badge>
                )}
                {hasLocalCategoryOverrides && (
                  <Badge
                    variant="outline"
                    className="rounded-full border-sky-200 px-3 py-1 text-sky-700"
                  >
                    Categorias locales: {localCategoryCount} locales,{" "}
                    {renamedCategoryCount} renombradas, {hiddenCategoryCount}{" "}
                    ocultas
                    {hasCustomCategoryOrder ? ", orden personalizado" : ""}
                  </Badge>
                )}
                {stockFilter !== "all" && (
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    {stockFilter === "in-stock" ? "Disponibles" : "Agotados"}
                  </Badge>
                )}
                {categoryFilter !== "all" && (
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    {categoryMap.get(categoryFilter) ?? "Categoria"}
                  </Badge>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 uppercase bg-slate-50/50 font-bold">
                  <tr>
                    <th className="px-6 py-4">Producto</th>
                    <th className="px-6 py-4">Categoria</th>
                    <th className="px-6 py-4">Precio</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-slate-400"
                      >
                        Cargando productos...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-slate-400"
                      >
                        No se encontraron productos.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(product => (
                      <tr
                        key={product.id}
                        className="hover:bg-slate-50/30 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                onError={e => {
                                  (e.target as HTMLImageElement).src =
                                    getProductFallbackImage(brand);
                                }}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 leading-tight">
                                {product.name}
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {product.subBrand || product.brand}
                              </p>
                              <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                                {product.description}
                              </p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <Badge
                                  variant="outline"
                                  className="rounded-full border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-500"
                                >
                                  {product.deliveryTime}
                                </Badge>
                                {product.benefits.length > 0 && (
                                  <Badge
                                    variant="secondary"
                                    className="rounded-full px-2.5 py-0.5 text-[11px]"
                                  >
                                    {product.benefits.length} beneficio
                                    {product.benefits.length === 1 ? "" : "s"}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          <p className="font-medium text-slate-700">
                            {allCategoryMap.get(product.categoryId)?.name ??
                              categoryMap.get(product.categoryId) ??
                              product.categoryId}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {product.deliveryMethods.join(" · ")}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-900">
                            ${product.price.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold ${
                              product.inStock
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {product.inStock ? "En Stock" : "Agotado"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg"
                              onClick={() => openEditDialog(product)}
                            >
                              <Edit3 size={14} />
                              Editar producto
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-slate-400 hover:text-primary hover:bg-primary/5"
                              onClick={() => toggleStock(product.id)}
                              title={
                                product.inStock
                                  ? "Marcar como agotado"
                                  : "Marcar como disponible"
                              }
                            >
                              {product.inStock ? (
                                <PackageX size={16} />
                              ) : (
                                <PackageCheck size={16} />
                              )}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-slate-400"
                                >
                                  <MoreVertical size={16} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-56 rounded-xl p-2"
                              >
                                <DropdownMenuItem
                                  onClick={() => openDuplicateDialog(product)}
                                  className="rounded-lg cursor-pointer gap-2"
                                >
                                  <Copy size={14} />
                                  Duplicar y editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setDeleteTarget(product)}
                                  className="rounded-lg cursor-pointer gap-2 text-rose-600 focus:text-rose-600"
                                >
                                  <Trash2 size={14} />
                                  Eliminar producto
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={categoryManagerOpen}
        onOpenChange={handleCategoryManagerOpenChange}
      >
        <DialogContent className="sm:max-w-5xl rounded-3xl">
          <DialogHeader>
            <DialogTitle>Gestionar categorias por marca</DialogTitle>
            <DialogDescription>
              Ordena, oculta o vuelve a mostrar categorias solo para{" "}
              {brandLabel(brand)} en este navegador. Ocultar si impacta el
              storefront local; el orden queda guardado en este admin y listo
              para conectarse cuando esa capa consuma esta preferencia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {categoryEditorMode === "create"
                      ? "Nueva categoria local"
                      : "Renombrar categoria"}
                  </label>
                  <Input
                    value={categoryDraftName}
                    onChange={event => setCategoryDraftName(event.target.value)}
                    className="mt-2 rounded-xl"
                    placeholder="Ej. Bienestar diario"
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    Base y local se distinguen aqui mismo. Nada de esto toca
                    backend ni catalogo remoto.
                  </p>
                </div>
                <div className="flex gap-2">
                  {categoryEditorMode === "rename" && (
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={resetCategoryEditor}
                    >
                      Cancelar
                    </Button>
                  )}
                  <Button className="rounded-xl" onClick={handleSaveCategory}>
                    {categoryEditorMode === "create"
                      ? "Guardar categoria"
                      : "Guardar nombre"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-4 text-sm text-amber-900">
              Ocultar una categoria la saca de filtros y navegacion del
              storefront local para esta marca en este navegador. Si un draft ya
              la trae seleccionada, podras terminar de guardarlo sin romper el
              flujo, pero el storefront la mostrara como "Sin categoria"
              mientras siga oculta.
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <Badge
                    variant="outline"
                    className="rounded-full border-slate-200 px-3 py-1"
                  >
                    {categories.length} visibles
                  </Badge>
                  <Badge
                    variant="outline"
                    className="rounded-full border-slate-200 px-3 py-1"
                  >
                    {Array.from(categoryUsageMap.values()).reduce(
                      (sum, count) => sum + count,
                      0
                    )}{" "}
                    asignaciones
                  </Badge>
                  {hasCustomCategoryOrder ? (
                    <Badge
                      variant="outline"
                      className="rounded-full border-sky-200 px-3 py-1 text-sky-700"
                    >
                      Orden local guardado
                    </Badge>
                  ) : null}
                </div>

                <ScrollArea className="max-h-[52vh] pr-3">
                  <div className="space-y-3">
                    {categories.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-sm text-slate-500">
                        No hay categorias visibles. Puedes crear una nueva o
                        volver a mostrar una oculta.
                      </div>
                    ) : (
                      categories.map((category, index) => {
                        const productCount =
                          categoryUsageMap.get(category.id) ?? 0;
                        const isLocalCategory = localCategoryIdSet.has(
                          category.id
                        );
                        const originalName = baseCategoryMap.get(category.id);
                        const wasRenamed = Boolean(
                          originalName && originalName !== category.name
                        );

                        return (
                          <div
                            key={category.id}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex flex-col gap-4">
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold text-slate-900">
                                      {category.name}
                                    </p>
                                    {isLocalCategory ? (
                                      <Badge className="rounded-full bg-sky-100 text-sky-700 hover:bg-sky-100">
                                        Local
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="rounded-full border-slate-200 text-slate-500"
                                      >
                                        Base
                                      </Badge>
                                    )}
                                    {wasRenamed ? (
                                      <Badge
                                        variant="outline"
                                        className="rounded-full border-amber-200 text-amber-700"
                                      >
                                        Renombrada
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <p className="mt-2 text-sm text-slate-500">
                                    {productCount} producto
                                    {productCount === 1 ? "" : "s"} asociado
                                    {productCount === 1 ? "" : "s"}
                                  </p>
                                  {wasRenamed && originalName ? (
                                    <p className="mt-1 text-xs text-slate-400">
                                      Nombre base: {originalName}
                                    </p>
                                  ) : null}
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 rounded-lg"
                                    onClick={() =>
                                      moveCategory(category.id, "up")
                                    }
                                    disabled={index === 0}
                                    title="Mover arriba"
                                  >
                                    <ArrowUp size={14} />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 rounded-lg"
                                    onClick={() =>
                                      moveCategory(category.id, "down")
                                    }
                                    disabled={index === categories.length - 1}
                                    title="Mover abajo"
                                  >
                                    <ArrowDown size={14} />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-lg"
                                    onClick={() => openRenameCategory(category)}
                                  >
                                    <Edit3 size={14} />
                                    Renombrar
                                  </Button>
                                  <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5">
                                    <span className="text-xs font-medium text-slate-500">
                                      Visible
                                    </span>
                                    <Switch
                                      checked
                                      onCheckedChange={checked =>
                                        toggleCategoryVisibility(
                                          category,
                                          checked
                                        )
                                      }
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <Badge
                    variant="outline"
                    className="rounded-full border-slate-200 px-3 py-1"
                  >
                    {hiddenCategories.length} ocultas
                  </Badge>
                  <Badge
                    variant="outline"
                    className="rounded-full border-slate-200 px-3 py-1"
                  >
                    Puedes mostrarlas sin perder su nombre
                  </Badge>
                </div>

                <ScrollArea className="max-h-[52vh] pr-3">
                  <div className="space-y-3">
                    {hiddenCategories.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-sm text-slate-500">
                        No hay categorias ocultas para esta marca.
                      </div>
                    ) : (
                      hiddenCategories.map(category => {
                        const isLocalCategory = localCategoryIdSet.has(
                          category.id
                        );
                        const originalName = baseCategoryMap.get(category.id);
                        const wasRenamed = Boolean(
                          originalName && originalName !== category.name
                        );
                        const isDraftCategory =
                          draft.categoryId === category.id;

                        return (
                          <div
                            key={category.id}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold text-slate-900">
                                    {category.name}
                                  </p>
                                  {isLocalCategory ? (
                                    <Badge className="rounded-full bg-sky-100 text-sky-700 hover:bg-sky-100">
                                      Local
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="rounded-full border-slate-200 text-slate-500"
                                    >
                                      Base
                                    </Badge>
                                  )}
                                  <Badge
                                    variant="outline"
                                    className="rounded-full border-rose-200 text-rose-700"
                                  >
                                    Oculta
                                  </Badge>
                                  {isDraftCategory ? (
                                    <Badge
                                      variant="outline"
                                      className="rounded-full border-amber-200 text-amber-700"
                                    >
                                      En draft actual
                                    </Badge>
                                  ) : null}
                                </div>
                                {wasRenamed && originalName ? (
                                  <p className="mt-2 text-xs text-slate-400">
                                    Nombre base: {originalName}
                                  </p>
                                ) : null}
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-lg"
                                  onClick={() => openRenameCategory(category)}
                                >
                                  <Edit3 size={14} />
                                  Renombrar
                                </Button>
                                <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5">
                                  <span className="text-xs font-medium text-slate-500">
                                    Mostrar
                                  </span>
                                  <Switch
                                    checked={false}
                                    onCheckedChange={checked =>
                                      toggleCategoryVisibility(
                                        category,
                                        checked
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => handleCategoryManagerOpenChange(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editorOpen} onOpenChange={handleEditorOpenChange}>
        <DialogContent className="sm:max-w-5xl rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>{editorTitle}</DialogTitle>
            <DialogDescription>{editorDescription}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.45fr)_360px]">
            <ScrollArea className="max-h-[72vh] border-t border-slate-100">
              <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Nombre
                  </label>
                  <Input
                    value={draft.name}
                    onChange={e =>
                      setDraft(prev => ({ ...prev, name: e.target.value }))
                    }
                    className="mt-2 rounded-xl"
                    placeholder="Ej. Serum corporal renovador"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Submarca
                  </label>
                  <Input
                    value={draft.subBrand}
                    onChange={e =>
                      setDraft(prev => ({ ...prev, subBrand: e.target.value }))
                    }
                    className="mt-2 rounded-xl"
                    placeholder="Ej. Ekos, PiMag, Chronos"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Categoria
                  </label>
                  <Select
                    value={draft.categoryId || getDefaultCategoryId(categories)}
                    onValueChange={value =>
                      setDraft(prev => ({ ...prev, categoryId: value }))
                    }
                  >
                    <SelectTrigger className="mt-2 rounded-xl w-full">
                      <SelectValue placeholder="Selecciona una categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {draftHiddenCategory &&
                      !categories.some(
                        category => category.id === draft.categoryId
                      ) ? (
                        <SelectItem value={draftHiddenCategory.id}>
                          {draftHiddenCategory.name} (Oculta)
                        </SelectItem>
                      ) : null}
                      {categories.length === 0 ? (
                        <SelectItem value="uncategorized">
                          Sin categoria
                        </SelectItem>
                      ) : (
                        categories.map(category => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {draftHiddenCategory ? (
                    <p className="mt-2 text-xs text-amber-700">
                      Este draft apunta a una categoria oculta. Puedes guardarlo
                      sin romper el flujo, pero el storefront lo mostrara como
                      "Sin categoria" mientras siga oculta.
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">
                      Puedes crear, renombrar, ordenar u ocultar categorias
                      desde "Gestionar categorias".
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Precio
                  </label>
                  <Input
                    value={draft.price}
                    onChange={e =>
                      setDraft(prev => ({ ...prev, price: e.target.value }))
                    }
                    className="mt-2 rounded-xl"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Tiempo de entrega
                  </label>
                  <Input
                    value={draft.deliveryTime}
                    onChange={e =>
                      setDraft(prev => ({
                        ...prev,
                        deliveryTime: e.target.value,
                      }))
                    }
                    className="mt-2 rounded-xl"
                    placeholder="Ej. Entrega Inmediata o 3-5 dias habiles"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    URL de imagen
                  </label>
                  <Input
                    value={draft.imageUrl}
                    onChange={e =>
                      setDraft(prev => ({ ...prev, imageUrl: e.target.value }))
                    }
                    className="mt-2 rounded-xl"
                    placeholder="https://... o /assets/..."
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    Si lo dejas vacio, usaremos la imagen fallback configurada
                    para la marca.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Descripcion
                  </label>
                  <Textarea
                    value={draft.description}
                    onChange={e =>
                      setDraft(prev => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="mt-2 min-h-28 rounded-xl"
                    placeholder="Describe el producto, su propuesta y el uso recomendado."
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-800">
                        Disponibilidad
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Define si el producto aparece como disponible o agotado.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">
                        {draft.inStock ? "Disponible" : "Agotado"}
                      </span>
                      <Switch
                        checked={draft.inStock}
                        onCheckedChange={checked =>
                          setDraft(prev => ({ ...prev, inStock: checked }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Metodos de entrega
                  </label>
                  <Textarea
                    value={draft.deliveryMethodsText}
                    onChange={e =>
                      setDraft(prev => ({
                        ...prev,
                        deliveryMethodsText: e.target.value,
                      }))
                    }
                    className="mt-2 min-h-24 rounded-xl"
                    placeholder={
                      "Envio nacional\nEntrega local\nRetiro con cita"
                    }
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    Puedes separar por linea o por comas.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Beneficios
                  </label>
                  <Textarea
                    value={draft.benefitsText}
                    onChange={e =>
                      setDraft(prev => ({
                        ...prev,
                        benefitsText: e.target.value,
                      }))
                    }
                    className="mt-2 min-h-24 rounded-xl"
                    placeholder={
                      "Hidratacion profunda\nAroma duradero\nIngredientes naturales"
                    }
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    Puedes separar por linea o por comas.
                  </p>
                </div>
              </div>
            </ScrollArea>

            <div className="border-t lg:border-t-0 lg:border-l border-slate-100 bg-slate-50/80 px-6 py-6 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Preview
                </p>
                <h3 className="text-lg font-bold text-slate-900 mt-2">
                  {draft.name.trim() || "Producto sin nombre"}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {draft.subBrand.trim() || brandLabel(brand)}
                </p>
              </div>

              <div className="rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                <div className="aspect-[4/3] bg-slate-100">
                  <img
                    src={previewImageUrl}
                    alt={draft.name || "Preview del producto"}
                    className="w-full h-full object-cover"
                    onError={e => {
                      (e.target as HTMLImageElement).src =
                        getProductFallbackImage(brand);
                    }}
                  />
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-lg font-bold text-slate-900">
                      {draft.price
                        ? `$${Number(draft.price || 0).toLocaleString()}`
                        : "$0"}
                    </span>
                    <Badge
                      variant={draft.inStock ? "secondary" : "outline"}
                      className={
                        draft.inStock
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                          : "border-rose-200 text-rose-700"
                      }
                    >
                      {draft.inStock ? "Disponible" : "Agotado"}
                    </Badge>
                  </div>

                  <p className="text-sm text-slate-600">
                    {draft.description.trim() ||
                      "Agrega una descripcion para ver el resumen del producto."}
                  </p>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Entrega
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className="rounded-full border-slate-200"
                      >
                        {draft.deliveryTime.trim() ||
                          getDefaultDeliveryTime(brand)}
                      </Badge>
                      {previewDeliveryMethods.length > 0 ? (
                        previewDeliveryMethods.map(method => (
                          <Badge
                            key={method}
                            variant="secondary"
                            className="rounded-full"
                          >
                            {method}
                          </Badge>
                        ))
                      ) : (
                        <Badge
                          variant="outline"
                          className="rounded-full border-dashed"
                        >
                          Sin metodos definidos
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Beneficios
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {previewBenefits.length > 0 ? (
                        previewBenefits.map(benefit => (
                          <Badge
                            key={benefit}
                            variant="outline"
                            className="rounded-full border-slate-200"
                          >
                            {benefit}
                          </Badge>
                        ))
                      ) : (
                        <Badge
                          variant="outline"
                          className="rounded-full border-dashed"
                        >
                          Sin beneficios capturados
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-3">
                    <p className="text-xs text-slate-500">
                      Categoria:{" "}
                      {(allCategoryMap.get(draft.categoryId)?.name ??
                        draft.categoryId) ||
                        "Sin categoria"}
                    </p>
                    {draftHiddenCategory ? (
                      <p className="text-xs text-amber-700 mt-1">
                        Esta categoria esta oculta para el storefront local en
                        este navegador.
                      </p>
                    ) : null}
                    {editorMode === "edit" && editingTarget && (
                      <p className="text-xs text-slate-400 mt-1">
                        Editando ID local: {editingTarget.id}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-100 px-6 py-4">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={closeEditor}
            >
              Cancelar
            </Button>
            <Button className="rounded-xl" onClick={handleSaveProduct}>
              {editorMode === "edit" ? "Guardar cambios" : "Guardar producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar producto</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Quitaremos "${deleteTarget.name}" del catalogo local persistente de ${brandLabel(brand)}.`
                : "Confirma la eliminacion."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-rose-600 hover:bg-rose-700"
              onClick={deleteProduct}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={clearLocalChangesOpen}
        onOpenChange={setClearLocalChangesOpen}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Limpiar cambios locales</AlertDialogTitle>
            <AlertDialogDescription>
              Restableceremos productos, visibilidad y orden local de categorias
              de {brandLabel(brand)} al estado base y borraremos las ediciones
              guardadas en este navegador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              onClick={resetLocalChanges}
            >
              Limpiar cambios
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
