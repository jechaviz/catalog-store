import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X, Plus } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  brand: string;
  subBrand: string;
  description: string;
  benefits: string[];
  price: number;
  imageUrl: string;
}

interface ProductEditorProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product) => void;
}

export function ProductEditor({ product, isOpen, onClose, onSave }: ProductEditorProps) {
  const [formData, setFormData] = useState<Product>(product);
  const [newBenefit, setNewBenefit] = useState('');

  const handleChange = (field: keyof Product, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'price' ? parseFloat(value) || 0 : value
    }));
  };

  const handleAddBenefit = () => {
    if (newBenefit.trim()) {
      setFormData(prev => ({
        ...prev,
        benefits: [...prev.benefits, newBenefit.trim()]
      }));
      setNewBenefit('');
    }
  };

  const handleRemoveBenefit = (index: number) => {
    setFormData(prev => ({
      ...prev,
      benefits: prev.benefits.filter((_, i) => i !== index)
    }));
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-md border-none rounded-[2rem] shadow-2xl p-0">
        <div className="relative p-6 sm:p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="heading text-3xl font-bold text-primary">Editar Producto</DialogTitle>
            <p className="body text-muted-foreground text-sm mt-1">Modifica los detalles del producto para actualizar el catálogo visual</p>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="heading block text-sm font-bold text-foreground/80">Nombre del Producto</label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Ej: Crema de Manos"
                  className="rounded-xl border-border/50 bg-white/50 focus-visible:ring-primary/30 py-6"
                />
              </div>
              <div className="space-y-2">
                <label className="heading block text-sm font-bold text-foreground/80">Marca</label>
                <Input
                  value={formData.brand}
                  onChange={(e) => handleChange('brand', e.target.value)}
                  placeholder="Ej: NATURA"
                  className="rounded-xl border-border/50 bg-white/50 focus-visible:ring-primary/30 py-6 uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="heading block text-sm font-bold text-foreground/80">Submarca</label>
                <Input
                  value={formData.subBrand}
                  onChange={(e) => handleChange('subBrand', e.target.value)}
                  placeholder="Ej: EKOS"
                  className="rounded-xl border-border/50 bg-white/50 focus-visible:ring-primary/30 py-6 uppercase"
                />
              </div>
              <div className="space-y-2">
                <label className="heading block text-sm font-bold text-foreground/80">Precio ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => handleChange('price', e.target.value)}
                  placeholder="590.00"
                  className="rounded-xl border-border/50 bg-white/50 focus-visible:ring-primary/30 py-6 font-mono text-lg"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="heading block text-sm font-bold text-foreground/80">Descripción del Producto</label>
              <Textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe el producto y sus características principales"
                className="min-h-[120px] rounded-2xl border-border/50 bg-white/50 focus-visible:ring-primary/30 p-4 body text-base leading-relaxed"
              />
            </div>

            <div className="space-y-3">
              <label className="heading block text-sm font-bold text-foreground/80">Beneficios (Opcional)</label>
              <div className="space-y-2 mb-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {formData.benefits.map((benefit, idx) => (
                  <div key={idx} className="flex items-start justify-between bg-primary/5 p-3 rounded-xl group transition-colors hover:bg-primary/10">
                    <span className="body text-sm mt-0.5">{benefit}</span>
                    <button
                      onClick={() => handleRemoveBenefit(idx)}
                      className="p-1.5 hover:bg-red-100 text-red-400 hover:text-red-600 rounded-lg transition-colors flex-shrink-0"
                      title="Eliminar beneficio"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {formData.benefits.length === 0 && (
                  <p className="text-sm text-muted-foreground italic py-2">No se han agregado beneficios aún.</p>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <Input
                  value={newBenefit}
                  onChange={(e) => setNewBenefit(e.target.value)}
                  placeholder="Escribe un beneficio y presiona Enter..."
                  className="rounded-xl border-border/50 bg-white/50 focus-visible:ring-primary/30"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddBenefit();
                    }
                  }}
                />
                <Button
                  onClick={handleAddBenefit}
                  variant="outline"
                  className="rounded-xl border-primary/20 text-primary hover:bg-primary/10"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="heading block text-sm font-bold text-foreground/80">URL de Imagen</label>
              <Input
                value={formData.imageUrl}
                onChange={(e) => handleChange('imageUrl', e.target.value)}
                placeholder="https://rutadelaimagen.com/producto.webp"
                className="rounded-xl border-border/50 bg-white/50 focus-visible:ring-primary/30"
              />
              {formData.imageUrl && (
                <div className="mt-4 p-4 bg-primary/5 rounded-[2rem] flex justify-center items-center">
                  <img
                    src={formData.imageUrl}
                    alt="Preview"
                    className="w-32 h-32 object-cover rounded-full shadow-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Error+en+Imagen';
                    }}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-border/10 mt-6">
              <Button
                variant="outline"
                onClick={onClose}
                className="rounded-full px-6 hover:bg-gray-100 font-medium"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                className="rounded-full px-8 bg-primary hover:bg-primary/90 text-white shadow-md hover:shadow-lg transition-all font-bold heading"
              >
                Guardar Cambios
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
