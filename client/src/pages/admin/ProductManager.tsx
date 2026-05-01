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
  Check,
  X,
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
import { getProductFallbackImage } from '@/lib/storefrontStorage';
import {
  applyLocalCatalogOverrides,
  clearLocalCatalogOverrides,
  deleteLocalCatalogProduct,
  isLocalCatalogStorageKeyForBrand,
  readLocalCatalogOverrides,
  upsertLocalCatalogProduct,
} from '@/lib/adminCatalogStorage';

type StockFilter = 'all' | 'in-stock' | 'out-of-stock';

interface DraftProduct {
  name: string;
  subBrand: string;
  categoryId: string;
  price: string;
  description: string;
  inStock: boolean;
}

function brandLabel(brand: string) {
  return brand === 'nikken' ? 'Nikken' : 'Natura';
}

export default function ProductManager() {
  const { brand } = useBrand();
  const [baseProducts, setBaseProducts] = useState<CatalogProduct[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedPrice, setEditedPrice] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CatalogProduct | null>(null);
  const [clearLocalChangesOpen, setClearLocalChangesOpen] = useState(false);
  const [draft, setDraft] = useState<DraftProduct>({
    name: '',
    subBrand: '',
    categoryId: 'all',
    price: '',
    description: '',
    inStock: true,
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchCatalogData(brand);
        if (data) {
          const localOverrides = readLocalCatalogOverrides(brand);
          setBaseProducts(data.products);
          setProducts(applyLocalCatalogOverrides(data.products, localOverrides));
          setCategories(data.categories);
          setHasLocalChanges(
            localOverrides.products.length > 0 || localOverrides.deletedProductIds.length > 0
          );
          const defaultCategory = data.categories[0]?.id || 'uncategorized';
          setDraft({
            name: '',
            subBrand: '',
            categoryId: defaultCategory,
            price: '',
            description: '',
            inStock: true,
          });
          setCategoryFilter('all');
          setEditingId(null);
          setEditedPrice('');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [brand]);

  useEffect(() => {
    const syncLocalOverrides = () => {
      const overrides = readLocalCatalogOverrides(brand);
      setHasLocalChanges(
        overrides.products.length > 0 || overrides.deletedProductIds.length > 0
      );
      setProducts(applyLocalCatalogOverrides(baseProducts, overrides));
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (isLocalCatalogStorageKeyForBrand(event.key, brand)) {
        syncLocalOverrides();
      }
    };

    const handleLocalCatalogEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ brand?: string; storageKey?: string }>;
      if (
        customEvent.detail?.brand === brand ||
        isLocalCatalogStorageKeyForBrand(customEvent.detail?.storageKey, brand)
      ) {
        syncLocalOverrides();
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('catalog-local-products-changed', handleLocalCatalogEvent);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('catalog-local-products-changed', handleLocalCatalogEvent);
    };
  }, [brand, baseProducts]);

  const categoryMap = useMemo(
    () => new Map(categories.map(category => [category.id, category.name])),
    [categories]
  );

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.subBrand.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'in-stock' && product.inStock) ||
        (stockFilter === 'out-of-stock' && !product.inStock);
      const matchesCategory =
        categoryFilter === 'all' || product.categoryId === categoryFilter;
      return matchesSearch && matchesStock && matchesCategory;
    });
  }, [products, searchTerm, stockFilter, categoryFilter]);

  const exportProducts = filteredProducts;

  const openCreateDialog = () => {
    setDraft(prev => ({
      ...prev,
      categoryId: categories[0]?.id || prev.categoryId || 'uncategorized',
    }));
    setCreateOpen(true);
  };

  const handleCreateProduct = () => {
    const parsedPrice = Number(draft.price);
    if (!draft.name.trim() || !draft.price || Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      toast.error('Completa un nombre y un precio valido.');
      return;
    }

    const newProduct: CatalogProduct = {
      id: `draft-${Date.now()}`,
      name: draft.name.trim(),
      brand: brandLabel(brand),
      subBrand: draft.subBrand.trim(),
      categoryId: draft.categoryId === 'all' ? categories[0]?.id || 'uncategorized' : draft.categoryId,
      gender: 'unisex',
      description: draft.description.trim() || `Nuevo producto de ${brandLabel(brand)} agregado localmente.`,
      benefits: [],
      price: parsedPrice,
      imageUrl: getProductFallbackImage(brand),
      inStock: draft.inStock,
      deliveryTime: 'Entrega Inmediata',
      deliveryMethods: [brand === 'nikken' ? 'Envio nacional' : 'Envio a domicilio'],
    };

    setProducts(prev => [newProduct, ...prev]);
    upsertLocalCatalogProduct(brand, newProduct);
    setHasLocalChanges(true);
    setCreateOpen(false);
    setDraft({
      name: '',
      subBrand: '',
      categoryId: categories[0]?.id || 'uncategorized',
      price: '',
      description: '',
      inStock: true,
    });
    toast.success(`Producto guardado localmente para ${brandLabel(brand)}.`);
  };

  const startEditing = (product: CatalogProduct) => {
    setEditingId(product.id);
    setEditedPrice(String(product.price));
  };

  const savePrice = (productId: string) => {
    const parsedPrice = Number(editedPrice);
    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      toast.error('Ingresa un precio valido.');
      return;
    }

    setProducts(prev =>
      prev.map(product =>
        product.id === productId ? { ...product, price: parsedPrice } : product
      )
    );
    const updatedProduct = products.find(product => product.id === productId);
    if (updatedProduct) {
      upsertLocalCatalogProduct(brand, { ...updatedProduct, price: parsedPrice });
      setHasLocalChanges(true);
    }
    setEditingId(null);
    setEditedPrice('');
    toast.success(`Precio actualizado y persistido para ${brandLabel(brand)}.`);
  };

  const duplicateProduct = (product: CatalogProduct) => {
    const copy: CatalogProduct = {
      ...product,
      id: `copy-${Date.now()}`,
      name: `${product.name} Copia`,
    };
    setProducts(prev => [copy, ...prev]);
    upsertLocalCatalogProduct(brand, copy);
    setHasLocalChanges(true);
    toast.success(`Producto duplicado y guardado localmente para ${brandLabel(brand)}.`);
  };

  const toggleStock = (productId: string) => {
    const target = products.find(product => product.id === productId);
    if (!target) return;

    const nextProduct = { ...target, inStock: !target.inStock };
    setProducts(prev =>
      prev.map(product => (product.id === productId ? nextProduct : product))
    );
    upsertLocalCatalogProduct(brand, nextProduct);
    setHasLocalChanges(true);
    toast.success(
      target.inStock ? 'Producto marcado como agotado.' : 'Producto marcado como disponible.'
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
      const data = await fetchCatalogData(brand);
      if (data) {
        setBaseProducts(data.products);
        setProducts(data.products);
        setCategories(data.categories);
        setDraft(prev => ({
          ...prev,
          categoryId: data.categories[0]?.id || prev.categoryId || 'uncategorized',
        }));
      }
      setHasLocalChanges(false);
      setEditingId(null);
      setEditedPrice('');
      setClearLocalChangesOpen(false);
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Gestion de Productos</h1>
            <p className="text-slate-500">
              Administra el catalogo de {brand} con cambios persistentes en este navegador para cada marca.
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
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <Input
                    placeholder="Buscar por nombre o marca..."
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

                  <Select value={stockFilter} onValueChange={value => setStockFilter(value as StockFilter)}>
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

                  <Button variant="outline" className="rounded-xl border-slate-200" onClick={clearFilters}>
                    Limpiar
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="rounded-xl flex items-center gap-2 border-slate-200" disabled={exportProducts.length === 0}>
                        <Download size={18} />
                        Exportar
                        <ChevronDown size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 rounded-xl p-2">
                      <DropdownMenuLabel className="px-3 py-2">
                        Exportar {exportProducts.length} producto{exportProducts.length === 1 ? '' : 's'}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => generateWhatsAppCsv(exportProducts)} className="rounded-lg cursor-pointer">
                        Catalogo WhatsApp
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => generateMercadoLibreCsv(exportProducts)} className="rounded-lg cursor-pointer">
                        CSV Mercado Libre
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => generateEbayCsv(exportProducts)} className="rounded-lg cursor-pointer">
                        CSV eBay
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => generateAmazonCsv(exportProducts)} className="rounded-lg cursor-pointer">
                        TXT Amazon
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full border-slate-200 px-3 py-1 text-slate-500">
                  {exportProducts.length} de {products.length} productos visibles
                </Badge>
                {hasLocalChanges && (
                  <Badge variant="outline" className="rounded-full border-amber-200 px-3 py-1 text-amber-700">
                    Cambios locales persistentes para {brandLabel(brand)}
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
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">Cargando productos...</td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">No se encontraron productos.</td>
                    </tr>
                  ) : filteredProducts.map(product => (
                    <tr key={product.id} className="hover:bg-slate-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              onError={e => {
                                (e.target as HTMLImageElement).src = getProductFallbackImage(product.brand);
                              }}
                            />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 leading-tight">{product.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{product.subBrand || product.brand}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{categoryMap.get(product.categoryId) ?? product.categoryId}</td>
                      <td className="px-6 py-4">
                        {editingId === product.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editedPrice}
                              onChange={e => setEditedPrice(e.target.value)}
                              className="w-28 h-8 text-sm"
                              type="number"
                              min="0"
                              step="0.01"
                            />
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-500" onClick={() => savePrice(product.id)}>
                              <Check size={16} />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500" onClick={() => { setEditingId(null); setEditedPrice(''); }}>
                              <X size={16} />
                            </Button>
                          </div>
                        ) : (
                          <span className="font-bold text-slate-900">${product.price.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold ${
                          product.inStock
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}>
                          {product.inStock ? 'En Stock' : 'Agotado'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/5"
                            onClick={() => startEditing(product)}
                            title="Editar precio"
                          >
                            <Edit3 size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                            onClick={() => setDeleteTarget(product)}
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                                <MoreVertical size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 rounded-xl p-2">
                              <DropdownMenuItem onClick={() => duplicateProduct(product)} className="rounded-lg cursor-pointer gap-2">
                                <Copy size={14} />
                                Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleStock(product.id)} className="rounded-lg cursor-pointer gap-2">
                                {product.inStock ? <PackageX size={14} /> : <PackageCheck size={14} />}
                                {product.inStock ? 'Marcar agotado' : 'Marcar disponible'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Nuevo producto local</DialogTitle>
            <DialogDescription>
              Este alta queda guardada localmente en este navegador para {brandLabel(brand)} y no toca Odoo.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Nombre</label>
              <Input value={draft.name} onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))} className="mt-2 rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Submarca</label>
              <Input value={draft.subBrand} onChange={e => setDraft(prev => ({ ...prev, subBrand: e.target.value }))} className="mt-2 rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Precio</label>
              <Input value={draft.price} onChange={e => setDraft(prev => ({ ...prev, price: e.target.value }))} className="mt-2 rounded-xl" type="number" min="0" step="0.01" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Categoria</label>
              <Select value={draft.categoryId} onValueChange={value => setDraft(prev => ({ ...prev, categoryId: value }))}>
                <SelectTrigger className="mt-2 rounded-xl w-full">
                  <SelectValue placeholder="Selecciona una categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Disponibilidad</label>
              <Select value={draft.inStock ? 'in-stock' : 'out-of-stock'} onValueChange={value => setDraft(prev => ({ ...prev, inStock: value === 'in-stock' }))}>
                <SelectTrigger className="mt-2 rounded-xl w-full">
                  <SelectValue placeholder="Selecciona estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in-stock">Disponible</SelectItem>
                  <SelectItem value="out-of-stock">Agotado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Descripcion</label>
              <Input value={draft.description} onChange={e => setDraft(prev => ({ ...prev, description: e.target.value }))} className="mt-2 rounded-xl" />
            </div>
          </div>

          <DialogFooter className="px-6 pb-6">
            <Button variant="outline" className="rounded-xl" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button className="rounded-xl" onClick={handleCreateProduct}>Guardar producto</Button>
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
            <AlertDialogAction className="rounded-xl bg-rose-600 hover:bg-rose-700" onClick={deleteProduct}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearLocalChangesOpen} onOpenChange={setClearLocalChangesOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Limpiar cambios locales</AlertDialogTitle>
            <AlertDialogDescription>
              Restableceremos el catalogo visible de {brandLabel(brand)} al estado base y borraremos las ediciones locales guardadas en este navegador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
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
