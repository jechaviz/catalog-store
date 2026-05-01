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
      className="flex flex-col gap-6 p-6 rounded-3xl bg-background/40 backdrop-blur-xl border border-white/40 shadow-xl"
      style={{ boxShadow: `0 24px 60px ${primaryColor}20` }}
    >
      <div className="flex flex-col gap-1">
        <h3 className="heading text-xl font-bold text-foreground">Kit Social {product.brand}</h3>
        <p className="body text-sm text-muted-foreground">Genera contenido impecable para tus redes en segundos.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Button
          onClick={() => handleExport('share')}
          disabled={!!isExporting}
          className="flex flex-col items-center justify-center gap-3 h-28 rounded-2xl bg-foreground hover:bg-foreground/90 text-background transition-all group scale-100 hover:scale-[1.02]"
        >
          {isExporting === 'share' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Share2 className="w-6 h-6 group-hover:scale-110 transition-transform" />}
          <span className="text-xs font-bold uppercase tracking-wider">Compartir</span>
        </Button>

        <Button
          onClick={() => handleExport('post')}
          disabled={!!isExporting}
          variant="outline"
          className="flex flex-col items-center justify-center gap-3 h-28 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group scale-100 hover:scale-[1.02]"
        >
          {isExporting === 'post' ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <Instagram className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />}
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary">Post (1:1)</span>
        </Button>

        <Button
          onClick={() => handleExport('story')}
          disabled={!!isExporting}
          variant="outline"
          className="flex flex-col items-center justify-center gap-3 h-28 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group scale-100 hover:scale-[1.02]"
        >
          {isExporting === 'story' ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <Facebook className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />}
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary">Story (9:16)</span>
        </Button>
      </div>
    </div>
  );
}
