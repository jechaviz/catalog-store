import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/app/admin/AdminLayout';
import { fetchCatalogData, CatalogProduct, Category } from '@/lib/dataFetcher';
import { useBrand } from '@/contexts/BrandContext';
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
} from 'lucide-react';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';
import { Card, CardContent } from '@/components/shared/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shared/ui/dropdown-menu';
import {
  generateAmazonCsv,
  generateEbayCsv,
  generateMercadoLibreCsv,
  generateWhatsAppCsv,
} from '@/lib/sharingUtils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shared/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shared/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/ui/select';
import { Badge } from '@/components/shared/ui/badge';
import { Textarea } from '@/components/shared/ui/textarea';
import { Switch } from '@/components/shared/ui/switch';
import { ScrollArea } from '@/components/shared/ui/scroll-area';
import { getProductFallbackImage } from '@/lib/storefrontStorage';
import {
  clearLocalCatalogOverrides,
  deleteLocalCatalogProduct,
  isLocalCatalogStorageKeyForBrand,
  readLocalCatalogOverrides,
  upsertLocalCatalogProduct,
} from '@/lib/adminCatalogStorage';

type StockFilter = 'all' | 'in-stock' | 'out-of-stock';
type EditorMode = 'create' | 'edit';
type BrandKey = 'natura' | 'nikken';
type CategoryEditorMode = 'create' | 'rename';

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

interface LocalCategoryOverrides {
  customCategories: Category[];
  renamedCategories: Record<string, string>;
  deletedCategoryIds: string[];
}

interface DeleteCategoryTarget {
  category: Category;
  replacementCategoryId: string;
  associatedProductCount: number;
}

const LOCAL_CATEGORY_EVENT = 'catalog-local-categories-changed';

function brandLabel(brand: string) {
  return brand === 'nikken' ? 'Nikken' : 'Natura';
}

function createEmptyLocalCategoryOverrides(): LocalCategoryOverrides {
  return {
    customCategories: [],
    renamedCategories: {},
    deletedCategoryIds: [],
  };
}

function getLocalCategoryStorageKey(brand: BrandKey) {
  return `catalog-local-categories:${brand}`;
}

function normalizeCategoryName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function readLocalCategoryOverrides(brand: BrandKey): LocalCategoryOverrides {
  if (typeof window === 'undefined') {
    return createEmptyLocalCategoryOverrides();
  }

  try {
    const raw = window.localStorage.getItem(getLocalCategoryStorageKey(brand));
    if (!raw) {
      return createEmptyLocalCategoryOverrides();
    }

    const parsed = JSON.parse(raw) as Partial<LocalCategoryOverrides>;
    const customCategories = Array.isArray(parsed.customCategories)
      ? parsed.customCategories
          .map(category => {
            if (!category || typeof category !== 'object') {
              return null;
            }

            const id = typeof category.id === 'string' ? category.id.trim() : '';
            const name = normalizeCategoryName(
              typeof category.name === 'string' ? category.name : '',
            );

            if (!id || !name) {
              return null;
            }

            return { id, name };
          })
          .filter((category): category is Category => category !== null)
      : [];

    const renamedCategories =
      parsed.renamedCategories && typeof parsed.renamedCategories === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.renamedCategories).flatMap(([categoryId, name]) => {
              const nextId = categoryId.trim();
              const nextName = normalizeCategoryName(typeof name === 'string' ? name : '');

              return nextId && nextName ? [[nextId, nextName]] : [];
            }),
          )
        : {};

    const deletedCategoryIds = Array.isArray(parsed.deletedCategoryIds)
      ? Array.from(
          new Set(
            parsed.deletedCategoryIds
              .map(categoryId => (typeof categoryId === 'string' ? categoryId.trim() : ''))
              .filter(Boolean),
          ),
        )
      : [];

    return {
      customCategories,
      renamedCategories,
      deletedCategoryIds,
    };
  } catch {
    return createEmptyLocalCategoryOverrides();
  }
}

function saveLocalCategoryOverrides(brand: BrandKey, overrides: LocalCategoryOverrides) {
  if (typeof window === 'undefined') {
    return;
  }

  const storageKey = getLocalCategoryStorageKey(brand);
  window.localStorage.setItem(storageKey, JSON.stringify(overrides));
  window.dispatchEvent(
    new CustomEvent(LOCAL_CATEGORY_EVENT, {
      detail: { brand, storageKey },
    }),
  );
}

function clearLocalCategoryOverrides(brand: BrandKey) {
  if (typeof window === 'undefined') {
    return;
  }

  const storageKey = getLocalCategoryStorageKey(brand);
  window.localStorage.removeItem(storageKey);
  window.dispatchEvent(
    new CustomEvent(LOCAL_CATEGORY_EVENT, {
      detail: { brand, storageKey },
    }),
  );
}

function hasLocalCategoryChanges(overrides: LocalCategoryOverrides) {
  return (
    overrides.customCategories.length > 0 ||
    Object.keys(overrides.renamedCategories).length > 0 ||
    overrides.deletedCategoryIds.length > 0
  );
}

function createLocalCategoryId() {
  return `local-category-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mergeCategories(
  baseCategories: Category[],
  overrides: LocalCategoryOverrides,
): Category[] {
  const deletedIds = new Set(overrides.deletedCategoryIds);

  const mergedBase = baseCategories
    .filter(category => !deletedIds.has(category.id))
    .map(category => ({
      ...category,
      name: overrides.renamedCategories[category.id] ?? category.name,
    }));

  const mergedCustom = overrides.customCategories.filter(
    category => !deletedIds.has(category.id),
  );

  return [...mergedBase, ...mergedCustom];
}

function getDefaultCategoryId(categories: Category[]) {
  return categories[0]?.id || 'uncategorized';
}

function getDefaultDeliveryTime(brand: 'natura' | 'nikken') {
  return brand === 'nikken' ? '3-5 dias habiles' : 'Entrega Inmediata';
}

function getDefaultDeliveryMethodsText(brand: 'natura' | 'nikken') {
  return brand === 'nikken'
    ? 'Envio nacional'
    : 'Envio a domicilio';
}

function createEmptyDraft(brand: 'natura' | 'nikken', categories: Category[]): DraftProduct {
  return {
    name: '',
    subBrand: '',
    categoryId: getDefaultCategoryId(categories),
    description: '',
    price: '',
    imageUrl: '',
    inStock: true,
    deliveryTime: getDefaultDeliveryTime(brand),
    deliveryMethodsText: getDefaultDeliveryMethodsText(brand),
    benefitsText: '',
  };
}

function normalizeListInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map(item => item.trim())
        .filter(Boolean),
    ),
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
    deliveryMethodsText: product.deliveryMethods.join('\n'),
    benefitsText: product.benefits.join('\n'),
  };
}

export default function ProductManager() {
  const { brand } = useBrand();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [baseCategories, setBaseCategories] = useState<Category[]>([]);
  const [localCategoryOverrides, setLocalCategoryOverrides] = useState<LocalCategoryOverrides>(
    () => createEmptyLocalCategoryOverrides(),
  );
  const [loading, setLoading] = useState(true);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('create');
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogProduct | null>(null);
  const [clearLocalChangesOpen, setClearLocalChangesOpen] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [categoryEditorMode, setCategoryEditorMode] = useState<CategoryEditorMode>('create');
  const [categoryDraftName, setCategoryDraftName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [deleteCategoryTarget, setDeleteCategoryTarget] =
    useState<DeleteCategoryTarget | null>(null);
  const [draft, setDraft] = useState<DraftProduct>(() => createEmptyDraft(brand, []));
  const categories = useMemo(
    () => mergeCategories(baseCategories, localCategoryOverrides),
    [baseCategories, localCategoryOverrides],
  );

  const loadCatalog = async (
    currentBrand: BrandKey = brand,
    options?: { preserveDraft?: boolean },
  ) => {
    setLoading(true);
    try {
      const data = await fetchCatalogData(currentBrand);
      if (!data) return;

      const localProductOverrides = readLocalCatalogOverrides(currentBrand);
      const localCategories = readLocalCategoryOverrides(currentBrand);
      const mergedCategories = mergeCategories(data.categories, localCategories);

      setProducts(data.products);
      setBaseCategories(data.categories);
      setLocalCategoryOverrides(localCategories);
      setHasLocalChanges(
        localProductOverrides.products.length > 0 ||
          localProductOverrides.deletedProductIds.length > 0 ||
          hasLocalCategoryChanges(localCategories),
      );

      if (!options?.preserveDraft) {
        setDraft(createEmptyDraft(currentBrand, mergedCategories));
      } else {
        setDraft(prev => ({
          ...prev,
          categoryId:
            mergedCategories.some(category => category.id === prev.categoryId)
              ? prev.categoryId
              : getDefaultCategoryId(mergedCategories),
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCategoryFilter('all');
    setSearchTerm('');
    setEditorOpen(false);
    setEditorMode('create');
    setEditingTargetId(null);
    setCategoryManagerOpen(false);
    setCategoryEditorMode('create');
    setCategoryDraftName('');
    setEditingCategoryId(null);
    setDeleteTarget(null);
    setDeleteCategoryTarget(null);
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
        event.key === getLocalCategoryStorageKey(brand)
      ) {
        syncCatalog();
      }
    };

    const handleLocalCatalogEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ brand?: string; storageKey?: string }>;
      if (
        customEvent.detail?.brand === brand ||
        isLocalCatalogStorageKeyForBrand(customEvent.detail?.storageKey, brand)
      ) {
        syncCatalog();
      }
    };

    const handleLocalCategoryEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ brand?: string; storageKey?: string }>;
      if (
        customEvent.detail?.brand === brand ||
        customEvent.detail?.storageKey === getLocalCategoryStorageKey(brand)
      ) {
        syncCatalog();
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('catalog-local-products-changed', handleLocalCatalogEvent);
    window.addEventListener(LOCAL_CATEGORY_EVENT, handleLocalCategoryEvent);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('catalog-local-products-changed', handleLocalCatalogEvent);
      window.removeEventListener(LOCAL_CATEGORY_EVENT, handleLocalCategoryEvent);
    };
  }, [brand, editorOpen]);

  useEffect(() => {
    if (categoryFilter !== 'all' && !categories.some(category => category.id === categoryFilter)) {
      setCategoryFilter('all');
    }
  }, [categories, categoryFilter]);

  const categoryMap = useMemo(
    () => new Map(categories.map(category => [category.id, category.name])),
    [categories],
  );
  const baseCategoryMap = useMemo(
    () => new Map(baseCategories.map(category => [category.id, category.name])),
    [baseCategories],
  );
  const localCategoryIdSet = useMemo(
    () => new Set(localCategoryOverrides.customCategories.map(category => category.id)),
    [localCategoryOverrides.customCategories],
  );
  const categoryUsageMap = useMemo(() => {
    const usage = new Map<string, number>();
    for (const product of products) {
      usage.set(product.categoryId, (usage.get(product.categoryId) ?? 0) + 1);
    }
    return usage;
  }, [products]);
  const categoryDeleteOptions = useMemo(() => {
    if (!deleteCategoryTarget) {
      return [];
    }

    return categories.filter(category => category.id !== deleteCategoryTarget.category.id);
  }, [categories, deleteCategoryTarget]);
  const hasLocalCategoryOverrides = hasLocalCategoryChanges(localCategoryOverrides);
  const localCategoryCount = localCategoryOverrides.customCategories.length;
  const renamedCategoryCount = Object.keys(localCategoryOverrides.renamedCategories).length;
  const hiddenCategoryCount = localCategoryOverrides.deletedCategoryIds.length;

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        product.name.toLowerCase().includes(search) ||
        product.subBrand.toLowerCase().includes(search) ||
        product.description.toLowerCase().includes(search);
      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'in-stock' && product.inStock) ||
        (stockFilter === 'out-of-stock' && !product.inStock);
      const matchesCategory = categoryFilter === 'all' || product.categoryId === categoryFilter;

      return matchesSearch && matchesStock && matchesCategory;
    });
  }, [products, searchTerm, stockFilter, categoryFilter]);

  const exportProducts = filteredProducts;
  const editingTarget = useMemo(
    () => products.find(product => product.id === editingTargetId) ?? null,
    [products, editingTargetId],
  );
  const previewBenefits = useMemo(() => normalizeListInput(draft.benefitsText), [draft.benefitsText]);
  const previewDeliveryMethods = useMemo(
    () => normalizeListInput(draft.deliveryMethodsText),
    [draft.deliveryMethodsText],
  );
  const previewImageUrl = draft.imageUrl.trim() || getProductFallbackImage(brand);

  const syncHasLocalChanges = (nextCategoryOverrides: LocalCategoryOverrides) => {
    const localProductOverrides = readLocalCatalogOverrides(brand);
    setHasLocalChanges(
      localProductOverrides.products.length > 0 ||
        localProductOverrides.deletedProductIds.length > 0 ||
        hasLocalCategoryChanges(nextCategoryOverrides),
    );
  };

  const persistCategoryOverrides = (nextOverrides: LocalCategoryOverrides) => {
    setLocalCategoryOverrides(nextOverrides);
    syncHasLocalChanges(nextOverrides);
    saveLocalCategoryOverrides(brand, nextOverrides);
  };

  const resetCategoryEditor = () => {
    setCategoryEditorMode('create');
    setCategoryDraftName('');
    setEditingCategoryId(null);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditorMode('create');
    setEditingTargetId(null);
    setDraft(createEmptyDraft(brand, categories));
  };

  const openCreateDialog = () => {
    setEditorMode('create');
    setEditingTargetId(null);
    setDraft(createEmptyDraft(brand, categories));
    setEditorOpen(true);
  };

  const openEditDialog = (product: CatalogProduct) => {
    setEditorMode('edit');
    setEditingTargetId(product.id);
    setDraft(buildDraftFromProduct(product));
    setEditorOpen(true);
  };

  const openDuplicateDialog = (product: CatalogProduct) => {
    setEditorMode('create');
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
    setCategoryEditorMode('rename');
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
      toast.error('Escribe un nombre para la categoria.');
      return;
    }

    const duplicateCategory = categories.find(category => {
      if (categoryEditorMode === 'rename' && category.id === editingCategoryId) {
        return false;
      }

      return category.name.trim().toLowerCase() === nextName.toLowerCase();
    });

    if (duplicateCategory) {
      toast.error('Ya existe una categoria con ese nombre en esta marca.');
      return;
    }

    const nextOverrides: LocalCategoryOverrides = {
      customCategories: [...localCategoryOverrides.customCategories],
      renamedCategories: { ...localCategoryOverrides.renamedCategories },
      deletedCategoryIds: [...localCategoryOverrides.deletedCategoryIds],
    };

    let createdCategory: Category | null = null;

    if (categoryEditorMode === 'create') {
      createdCategory = {
        id: createLocalCategoryId(),
        name: nextName,
      };
      nextOverrides.customCategories = [createdCategory, ...nextOverrides.customCategories];
    } else {
      if (!editingCategoryId) {
        toast.error('No encontramos la categoria a renombrar.');
        return;
      }

      if (localCategoryIdSet.has(editingCategoryId)) {
        nextOverrides.customCategories = nextOverrides.customCategories.map(category =>
          category.id === editingCategoryId ? { ...category, name: nextName } : category,
        );
      } else {
        const baseName = baseCategoryMap.get(editingCategoryId);
        if (!baseName) {
          toast.error('La categoria base ya no esta disponible.');
          return;
        }

        if (baseName === nextName) {
          delete nextOverrides.renamedCategories[editingCategoryId];
        } else {
          nextOverrides.renamedCategories[editingCategoryId] = nextName;
        }

        nextOverrides.deletedCategoryIds = nextOverrides.deletedCategoryIds.filter(
          categoryId => categoryId !== editingCategoryId,
        );
      }
    }

    persistCategoryOverrides(nextOverrides);

    if (createdCategory) {
      setDraft(prev => ({
        ...prev,
        categoryId:
          editorOpen || prev.categoryId === 'uncategorized'
            ? createdCategory.id
            : prev.categoryId,
      }));
    }

    resetCategoryEditor();
    toast.success(
      categoryEditorMode === 'create'
        ? `Categoria creada localmente para ${brandLabel(brand)}.`
        : `Categoria actualizada localmente para ${brandLabel(brand)}.`,
    );
  };

  const handleSaveProduct = () => {
    const parsedPrice = Number(draft.price);
    const deliveryMethods = normalizeListInput(draft.deliveryMethodsText);
    const benefits = normalizeListInput(draft.benefitsText);

    if (!draft.name.trim()) {
      toast.error('Agrega un nombre para el producto.');
      return;
    }

    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      toast.error('Ingresa un precio valido.');
      return;
    }

    if (!draft.description.trim()) {
      toast.error('Agrega una descripcion util para el producto.');
      return;
    }

    if (deliveryMethods.length === 0) {
      toast.error('Define al menos un metodo de entrega.');
      return;
    }

    const existingProduct =
      editorMode === 'edit'
        ? products.find(product => product.id === editingTargetId) ?? null
        : null;

    if (editorMode === 'edit' && !existingProduct) {
      toast.error('El producto ya no esta disponible para edicion.');
      closeEditor();
      return;
    }

    const nextProduct: CatalogProduct = {
      id: existingProduct?.id ?? `draft-${Date.now()}`,
      name: draft.name.trim(),
      brand: existingProduct?.brand ?? brandLabel(brand),
      subBrand: draft.subBrand.trim(),
      categoryId: draft.categoryId || getDefaultCategoryId(categories),
      gender: existingProduct?.gender ?? 'unisex',
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
      editorMode === 'edit'
        ? prev.map(product => (product.id === nextProduct.id ? nextProduct : product))
        : [nextProduct, ...prev],
    );
    upsertLocalCatalogProduct(brand, nextProduct);
    setHasLocalChanges(true);
    closeEditor();
    toast.success(
      editorMode === 'edit'
        ? `Producto actualizado localmente para ${brandLabel(brand)}.`
        : `Producto guardado localmente para ${brandLabel(brand)}.`,
    );
  };

  const promptDeleteCategory = (category: Category) => {
    const associatedProductCount = categoryUsageMap.get(category.id) ?? 0;
    const replacementCategoryId =
      categories.find(candidate => candidate.id !== category.id)?.id ?? '';

    if (associatedProductCount > 0 && !replacementCategoryId) {
      toast.error(
        'Crea otra categoria antes de eliminar esta, porque todavia hay productos asociados.',
      );
      return;
    }

    setDeleteCategoryTarget({
      category,
      replacementCategoryId,
      associatedProductCount,
    });
  };

  const deleteCategory = () => {
    if (!deleteCategoryTarget) {
      return;
    }

    const { category, replacementCategoryId, associatedProductCount } = deleteCategoryTarget;

    if (associatedProductCount > 0 && !replacementCategoryId) {
      toast.error('Selecciona una categoria de reemplazo para los productos asociados.');
      return;
    }

    const reassignedProducts =
      associatedProductCount > 0
        ? products.filter(product => product.categoryId === category.id)
        : [];

    if (associatedProductCount > 0) {
      setProducts(prev =>
        prev.map(product =>
          product.categoryId === category.id
            ? { ...product, categoryId: replacementCategoryId }
            : product,
        ),
      );

      for (const product of reassignedProducts) {
        upsertLocalCatalogProduct(brand, {
          ...product,
          categoryId: replacementCategoryId,
        });
      }
    }

    const nextOverrides: LocalCategoryOverrides = {
      customCategories: [...localCategoryOverrides.customCategories],
      renamedCategories: { ...localCategoryOverrides.renamedCategories },
      deletedCategoryIds: [...localCategoryOverrides.deletedCategoryIds],
    };

    if (localCategoryIdSet.has(category.id)) {
      nextOverrides.customCategories = nextOverrides.customCategories.filter(
        localCategory => localCategory.id !== category.id,
      );
    } else {
      nextOverrides.deletedCategoryIds = Array.from(
        new Set([...nextOverrides.deletedCategoryIds, category.id]),
      );
      delete nextOverrides.renamedCategories[category.id];
    }

    persistCategoryOverrides(nextOverrides);

    if (draft.categoryId === category.id) {
      const fallbackCategoryId =
        replacementCategoryId ||
        getDefaultCategoryId(categories.filter(candidate => candidate.id !== category.id));
      setDraft(prev => ({
        ...prev,
        categoryId: fallbackCategoryId,
      }));
    }

    if (categoryFilter === category.id) {
      setCategoryFilter(replacementCategoryId || 'all');
    }

    if (editingCategoryId === category.id) {
      resetCategoryEditor();
    }

    setDeleteCategoryTarget(null);
    toast.success(
      associatedProductCount > 0
        ? `Categoria eliminada y ${associatedProductCount} producto(s) reasignado(s).`
        : `Categoria eliminada localmente para ${brandLabel(brand)}.`,
    );
  };

  const toggleStock = (productId: string) => {
    const targetProduct = products.find(product => product.id === productId);
    if (!targetProduct) return;

    const nextProduct = { ...targetProduct, inStock: !targetProduct.inStock };
    setProducts(prev =>
      prev.map(product => (product.id === productId ? nextProduct : product)),
    );
    upsertLocalCatalogProduct(brand, nextProduct);
    setHasLocalChanges(true);
    toast.success(
      targetProduct.inStock
        ? 'Producto marcado como agotado.'
        : 'Producto marcado como disponible.',
    );
  };

  const deleteProduct = () => {
    if (!deleteTarget) return;

    setProducts(prev => prev.filter(product => product.id !== deleteTarget.id));
    deleteLocalCatalogProduct(brand, deleteTarget.id);
    setHasLocalChanges(true);
    toast.success(`Producto eliminado del catalogo local de ${brandLabel(brand)}.`);
    setDeleteTarget(null);
  };

  const resetLocalChanges = async () => {
    setLoading(true);
    try {
      clearLocalCatalogOverrides(brand);
      clearLocalCategoryOverrides(brand);
      closeEditor();
      setCategoryManagerOpen(false);
      resetCategoryEditor();
      setDeleteTarget(null);
      setDeleteCategoryTarget(null);
      setClearLocalChangesOpen(false);
      await loadCatalog(brand);
      toast.success(`Cambios locales de ${brandLabel(brand)} limpiados.`);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setStockFilter('all');
    setCategoryFilter('all');
    setSearchTerm('');
  };

  const editorTitle =
    editorMode === 'edit' ? 'Editar producto local' : 'Nuevo producto local';
  const editorDescription =
    editorMode === 'edit'
      ? `Actualiza nombre, descripcion, imagen, entrega y precio. El cambio queda guardado en este navegador para ${brandLabel(brand)}.`
      : `Crea un producto local completo para ${brandLabel(brand)}. Esta alta no modifica Odoo ni el catalogo remoto.`;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Gestion de Productos</h1>
            <p className="text-slate-500">
              Administra el catalogo de {brandLabel(brand)} con altas y ediciones
              persistentes en este navegador para cada marca.
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
            <Button className="rounded-xl flex items-center gap-2" onClick={openCreateDialog}>
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
                    onValueChange={value => setStockFilter(value as StockFilter)}
                  >
                    <SelectTrigger className="rounded-xl border-slate-200 w-full sm:w-[180px]">
                      <SelectValue placeholder="Stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todo el stock</SelectItem>
                      <SelectItem value="in-stock">Solo disponibles</SelectItem>
                      <SelectItem value="out-of-stock">Solo agotados</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
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
                    <DropdownMenuContent align="end" className="w-64 rounded-xl p-2">
                      <DropdownMenuLabel className="px-3 py-2">
                        Exportar {exportProducts.length} producto
                        {exportProducts.length === 1 ? '' : 's'}
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
                  {exportProducts.length} de {products.length} productos visibles
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
                    Categorias locales: {localCategoryCount} nuevas, {renamedCategoryCount}{' '}
                    renombradas, {hiddenCategoryCount} ocultas
                  </Badge>
                )}
                {stockFilter !== 'all' && (
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    {stockFilter === 'in-stock' ? 'Disponibles' : 'Agotados'}
                  </Badge>
                )}
                {categoryFilter !== 'all' && (
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    {categoryMap.get(categoryFilter) ?? 'Categoria'}
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
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        Cargando productos...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        No se encontraron productos.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(product => (
                      <tr key={product.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                onError={e => {
                                  (e.target as HTMLImageElement).src = getProductFallbackImage(brand);
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
                                    {product.benefits.length === 1 ? '' : 's'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          <p className="font-medium text-slate-700">
                            {categoryMap.get(product.categoryId) ?? product.categoryId}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {product.deliveryMethods.join(' · ')}
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
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {product.inStock ? 'En Stock' : 'Agotado'}
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
                                  ? 'Marcar como agotado'
                                  : 'Marcar como disponible'
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
                              <DropdownMenuContent align="end" className="w-56 rounded-xl p-2">
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

      <Dialog open={categoryManagerOpen} onOpenChange={handleCategoryManagerOpenChange}>
        <DialogContent className="sm:max-w-3xl rounded-3xl">
          <DialogHeader>
            <DialogTitle>Gestionar categorias locales</DialogTitle>
            <DialogDescription>
              Crea, renombra u oculta categorias solo para {brandLabel(brand)} en este
              navegador. Si una categoria todavia tiene productos, te pediremos una
              reasignacion antes de eliminarla.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {categoryEditorMode === 'create'
                      ? 'Nueva categoria local'
                      : 'Renombrar categoria'}
                  </label>
                  <Input
                    value={categoryDraftName}
                    onChange={event => setCategoryDraftName(event.target.value)}
                    className="mt-2 rounded-xl"
                    placeholder="Ej. Bienestar diario"
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    Este cambio se guarda por marca y no modifica el catalogo remoto.
                  </p>
                </div>
                <div className="flex gap-2">
                  {categoryEditorMode === 'rename' && (
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={resetCategoryEditor}
                    >
                      Cancelar
                    </Button>
                  )}
                  <Button className="rounded-xl" onClick={handleSaveCategory}>
                    {categoryEditorMode === 'create' ? 'Guardar categoria' : 'Guardar nombre'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge variant="outline" className="rounded-full border-slate-200 px-3 py-1">
                  {categories.length} categorias visibles
                </Badge>
                <Badge variant="outline" className="rounded-full border-slate-200 px-3 py-1">
                  {Array.from(categoryUsageMap.values()).reduce((sum, count) => sum + count, 0)}{' '}
                  asignaciones de productos
                </Badge>
              </div>

              <ScrollArea className="max-h-[48vh] pr-3">
                <div className="space-y-3">
                  {categories.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-sm text-slate-500">
                      No hay categorias activas. Crea una para empezar a clasificar productos.
                    </div>
                  ) : (
                    categories.map(category => {
                      const productCount = categoryUsageMap.get(category.id) ?? 0;
                      const isLocalCategory = localCategoryIdSet.has(category.id);
                      const wasRenamed =
                        !isLocalCategory &&
                        localCategoryOverrides.renamedCategories[category.id] !== undefined;
                      const originalName = baseCategoryMap.get(category.id);

                      return (
                        <div
                          key={category.id}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-900">{category.name}</p>
                                {isLocalCategory ? (
                                  <Badge className="rounded-full bg-sky-100 text-sky-700 hover:bg-sky-100">
                                    Local
                                  </Badge>
                                ) : wasRenamed ? (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full border-amber-200 text-amber-700"
                                  >
                                    Renombrada
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full border-slate-200 text-slate-500"
                                  >
                                    Base
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-2 text-sm text-slate-500">
                                {productCount} producto{productCount === 1 ? '' : 's'} asociado
                                {productCount === 1 ? '' : 's'}
                              </p>
                              {wasRenamed && originalName && (
                                <p className="mt-1 text-xs text-slate-400">
                                  Nombre base: {originalName}
                                </p>
                              )}
                            </div>

                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-lg"
                                onClick={() => openRenameCategory(category)}
                              >
                                <Edit3 size={14} />
                                Renombrar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                onClick={() => promptDeleteCategory(category)}
                              >
                                <Trash2 size={14} />
                                Eliminar
                              </Button>
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
                    onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
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
                    onChange={e => setDraft(prev => ({ ...prev, subBrand: e.target.value }))}
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
                    onValueChange={value => setDraft(prev => ({ ...prev, categoryId: value }))}
                  >
                    <SelectTrigger className="mt-2 rounded-xl w-full">
                      <SelectValue placeholder="Selecciona una categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.length === 0 ? (
                        <SelectItem value="uncategorized">Sin categoria</SelectItem>
                      ) : (
                        categories.map(category => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="mt-2 text-xs text-slate-400">
                    Puedes crear, renombrar u ocultar categorias desde "Gestionar categorias".
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Precio
                  </label>
                  <Input
                    value={draft.price}
                    onChange={e => setDraft(prev => ({ ...prev, price: e.target.value }))}
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
                    onChange={e => setDraft(prev => ({ ...prev, deliveryTime: e.target.value }))}
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
                    onChange={e => setDraft(prev => ({ ...prev, imageUrl: e.target.value }))}
                    className="mt-2 rounded-xl"
                    placeholder="https://... o /assets/..."
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    Si lo dejas vacio, usaremos la imagen fallback configurada para la marca.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Descripcion
                  </label>
                  <Textarea
                    value={draft.description}
                    onChange={e => setDraft(prev => ({ ...prev, description: e.target.value }))}
                    className="mt-2 min-h-28 rounded-xl"
                    placeholder="Describe el producto, su propuesta y el uso recomendado."
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-800">Disponibilidad</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Define si el producto aparece como disponible o agotado.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">
                        {draft.inStock ? 'Disponible' : 'Agotado'}
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
                      setDraft(prev => ({ ...prev, deliveryMethodsText: e.target.value }))
                    }
                    className="mt-2 min-h-24 rounded-xl"
                    placeholder={'Envio nacional\nEntrega local\nRetiro con cita'}
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
                    onChange={e => setDraft(prev => ({ ...prev, benefitsText: e.target.value }))}
                    className="mt-2 min-h-24 rounded-xl"
                    placeholder={'Hidratacion profunda\nAroma duradero\nIngredientes naturales'}
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
                  {draft.name.trim() || 'Producto sin nombre'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {draft.subBrand.trim() || brandLabel(brand)}
                </p>
              </div>

              <div className="rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                <div className="aspect-[4/3] bg-slate-100">
                  <img
                    src={previewImageUrl}
                    alt={draft.name || 'Preview del producto'}
                    className="w-full h-full object-cover"
                    onError={e => {
                      (e.target as HTMLImageElement).src = getProductFallbackImage(brand);
                    }}
                  />
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-lg font-bold text-slate-900">
                      {draft.price ? `$${Number(draft.price || 0).toLocaleString()}` : '$0'}
                    </span>
                    <Badge
                      variant={draft.inStock ? 'secondary' : 'outline'}
                      className={
                        draft.inStock
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                          : 'border-rose-200 text-rose-700'
                      }
                    >
                      {draft.inStock ? 'Disponible' : 'Agotado'}
                    </Badge>
                  </div>

                  <p className="text-sm text-slate-600">
                    {draft.description.trim() || 'Agrega una descripcion para ver el resumen del producto.'}
                  </p>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Entrega
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="rounded-full border-slate-200">
                        {draft.deliveryTime.trim() || getDefaultDeliveryTime(brand)}
                      </Badge>
                      {previewDeliveryMethods.length > 0 ? (
                        previewDeliveryMethods.map(method => (
                          <Badge key={method} variant="secondary" className="rounded-full">
                            {method}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="rounded-full border-dashed">
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
                          <Badge key={benefit} variant="outline" className="rounded-full border-slate-200">
                            {benefit}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="rounded-full border-dashed">
                          Sin beneficios capturados
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-3">
                    <p className="text-xs text-slate-500">
                      Categoria: {(categoryMap.get(draft.categoryId) ?? draft.categoryId) || 'Sin categoria'}
                    </p>
                    {editorMode === 'edit' && editingTarget && (
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
            <Button variant="outline" className="rounded-xl" onClick={closeEditor}>
              Cancelar
            </Button>
            <Button className="rounded-xl" onClick={handleSaveProduct}>
              {editorMode === 'edit' ? 'Guardar cambios' : 'Guardar producto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar producto</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Quitaremos "${deleteTarget.name}" del catalogo local persistente de ${brandLabel(brand)}.`
                : 'Confirma la eliminacion.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
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
        open={!!deleteCategoryTarget}
        onOpenChange={open => !open && setDeleteCategoryTarget(null)}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar categoria local</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCategoryTarget
                ? deleteCategoryTarget.associatedProductCount > 0
                  ? `La categoria "${deleteCategoryTarget.category.name}" todavia tiene ${deleteCategoryTarget.associatedProductCount} producto(s). Antes de eliminarla, reasignaremos esos productos a otra categoria local o base.`
                  : `Quitaremos "${deleteCategoryTarget.category.name}" solo del catalogo local de ${brandLabel(brand)} en este navegador.`
                : 'Confirma la eliminacion de la categoria.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteCategoryTarget && deleteCategoryTarget.associatedProductCount > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Reasignar productos a
              </label>
              <Select
                value={deleteCategoryTarget.replacementCategoryId}
                onValueChange={value =>
                  setDeleteCategoryTarget(prev =>
                    prev
                      ? {
                          ...prev,
                          replacementCategoryId: value,
                        }
                      : prev,
                  )
                }
              >
                <SelectTrigger className="rounded-xl w-full">
                  <SelectValue placeholder="Selecciona una categoria de destino" />
                </SelectTrigger>
                <SelectContent>
                  {categoryDeleteOptions.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                No perderemos esos productos: solo moveremos su categoria dentro de la
                persistencia local de esta marca.
              </p>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-rose-600 hover:bg-rose-700" onClick={deleteCategory}>
              Eliminar categoria
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearLocalChangesOpen} onOpenChange={setClearLocalChangesOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Limpiar cambios locales</AlertDialogTitle>
            <AlertDialogDescription>
              Restableceremos el catalogo visible de {brandLabel(brand)} al estado base y
              borraremos las ediciones locales guardadas en este navegador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl" onClick={resetLocalChanges}>
              Limpiar cambios
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
