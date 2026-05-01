import { Suspense, lazy } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/shared/ui/button";
import type { CatalogProduct } from "@/lib/dataFetcher";

const CatalogPdfGenerator = lazy(() =>
  import("./CatalogPdfGenerator").then(module => ({
    default: module.CatalogPdfGenerator,
  }))
);

interface LazyCatalogPdfGeneratorProps {
  products: CatalogProduct[];
}

export function LazyCatalogPdfGenerator({ products }: LazyCatalogPdfGeneratorProps) {
  return (
    <Suspense
      fallback={
        <Button
          disabled
          variant="outline"
          className="flex items-center gap-2 border-primary/20 text-primary/70 pointer-events-none sm:min-w-[180px]"
          title="Preparando generador PDF"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Preparando PDF</span>
        </Button>
      }
    >
      <CatalogPdfGenerator products={products} />
    </Suspense>
  );
}
