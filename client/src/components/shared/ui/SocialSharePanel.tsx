import { useState } from 'react';
import { Button } from '@/components/shared/ui/button';
import { Share2, Instagram, Facebook, Loader2 } from 'lucide-react';
import { captureElementAsImage, triggerSocialShare, downloadImage } from '@/lib/sharingUtils';
import { getExportElementId } from '@/components/domain/product/ExportableProduct';
import { toast } from 'sonner';

interface SocialSharePanelProps {
  product: {
    id: string;
    name: string;
    brand: string;
    subBrand: string;
    price: number;
    imageUrl: string;
  };
  primaryColor: string;
}

export function SocialSharePanel({ product, primaryColor }: SocialSharePanelProps) {
  const [isExporting, setIsExporting] = useState<'post' | 'story' | 'share' | null>(null);
  const productSlug = `${product.brand}_${product.name}`
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '');

  const handleExport = async (type: 'post' | 'story' | 'share') => {
    setIsExporting(type);
    try {
      const exportType = type === 'story' ? 'story' : 'post';
      const elementId = getExportElementId(product.id, exportType);
      const dataUrl = await captureElementAsImage(elementId, {
        scale: 3,
        backgroundColor: '#ffffff',
      });

      if (type === 'share') {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], `${productSlug}.png`, { type: 'image/png' });

        const shared = await triggerSocialShare({
          title: `${product.brand} - ${product.name}`,
          text: `Mira este producto: ${product.name} de ${product.brand} por $${product.price.toFixed(2)}.`,
          files: [file],
        });

        if (shared) {
          toast.success('Compartido con exito.');
        } else {
          downloadImage(dataUrl, `${productSlug}_share.png`);
          toast.success('Tu dispositivo no permite compartir archivos; descargamos la imagen.');
        }
      } else {
        downloadImage(dataUrl, `${productSlug}_${type}.png`);
        toast.success(`Imagen de ${type === 'post' ? 'post' : 'story'} descargada.`);
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Error al generar la imagen. Intentalo de nuevo.');
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div
      className="grid gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      style={{ boxShadow: `0 12px 28px ${primaryColor}12` }}
    >
      <div className="flex flex-col gap-0.5">
        <h3 className="heading text-sm font-black text-foreground">Kit Social {product.brand}</h3>
        <p className="body text-xs text-muted-foreground">Imagenes listas para compartir.</p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:w-[330px]">
        <Button
          onClick={() => handleExport('share')}
          disabled={!!isExporting}
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-foreground px-2 text-background transition-all hover:bg-foreground/90"
        >
          {isExporting === 'share' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          <span className="truncate text-[11px] font-bold uppercase tracking-wide">Compartir</span>
        </Button>

        <Button
          onClick={() => handleExport('post')}
          disabled={!!isExporting}
          variant="outline"
          className="flex h-10 items-center justify-center gap-2 rounded-lg border px-2 transition-all hover:border-primary hover:bg-primary/5"
        >
          {isExporting === 'post' ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Instagram className="h-4 w-4 text-muted-foreground" />}
          <span className="truncate text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Post</span>
        </Button>

        <Button
          onClick={() => handleExport('story')}
          disabled={!!isExporting}
          variant="outline"
          className="flex h-10 items-center justify-center gap-2 rounded-lg border px-2 transition-all hover:border-primary hover:bg-primary/5"
        >
          {isExporting === 'story' ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Facebook className="h-4 w-4 text-muted-foreground" />}
          <span className="truncate text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Story</span>
        </Button>
      </div>
    </div>
  );
}
