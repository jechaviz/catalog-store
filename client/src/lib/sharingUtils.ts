import type { CatalogProduct } from '@/lib/dataFetcher';

type ExportProduct = Pick<
  CatalogProduct,
  'id' | 'name' | 'description' | 'price' | 'imageUrl' | 'brand' | 'subBrand' | 'inStock'
>;

const EXPORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function getExportBrandLabel(products: ExportProduct[]) {
  return (products[0]?.brand || 'Catalogo').replace(/\s+/g, '_');
}

function getCatalogLink(product: ExportProduct) {
  const basePath = product.brand.toLowerCase() === 'nikken' ? '/nikken' : '';
  return `${window.location.origin}${basePath}?p=${product.id}`;
}

function getExportDateStamp() {
  return EXPORT_DATE_FORMATTER.format(new Date());
}

function normalizeExportText(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/\r?\n|\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function quoteCsvCell(value: string | number | null | undefined) {
  return `"${normalizeExportText(value).replace(/"/g, '""')}"`;
}

function downloadTextFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Captures a DOM element and returns it as a base64 Data URL.
 */
export async function captureElementAsImage(
  elementId: string,
  options: { scale?: number; backgroundColor?: string } = {}
): Promise<string> {
  const { default: html2canvas } = await import('html2canvas');
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Element with id ${elementId} not found`);

  const canvas = await html2canvas(element, {
    scale: options.scale || 2,
    useCORS: true,
    backgroundColor: options.backgroundColor || '#ffffff',
    logging: false,
    onclone: (clonedDoc) => {
      const clonedElement = clonedDoc.getElementById(elementId);
      if (clonedElement) {
        clonedElement.style.display = 'flex';
        clonedElement.style.visibility = 'visible';
        clonedElement.style.position = 'relative';
        clonedElement.style.left = '0';
        clonedElement.style.top = '0';
        clonedElement.style.zIndex = '1';
      }
    },
  });

  return canvas.toDataURL('image/png', 1.0);
}

/**
 * Triggers the native sharing dialog on supported devices.
 */
export async function triggerSocialShare(data: {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}) {
  if (data.files?.length && navigator.canShare && !navigator.canShare({ files: data.files })) {
    return false;
  }

  if (navigator.share) {
    try {
      await navigator.share(data);
      return true;
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Error sharing:', err);
      }
      return false;
    }
  } else {
    console.warn('Web Share API not supported');
    return false;
  }
}

/**
 * Generates a CSV for WhatsApp Business Catalog upload.
 * Format based on Meta's required headers.
 */
export function generateWhatsAppCsv(products: ExportProduct[]) {
  const headers = [
    'id',
    'title',
    'description',
    'availability',
    'condition',
    'price',
    'link',
    'image_link',
    'brand',
    'google_product_category'
  ];

  const rows = products.map(p => [
    p.id,
    p.name,
    p.description,
    p.inStock ? 'in stock' : 'out of stock',
    'new',
    `${p.price} MXN`,
    getCatalogLink(p),
    p.imageUrl,
    p.brand,
    'Health & Beauty > Personal Care > Cosmetics'
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(quoteCsvCell).join(','))
  ].join('\n');

  downloadTextFile(
    csvContent,
    `${getExportBrandLabel(products)}_WhatsApp_${getExportDateStamp()}.csv`,
    'text/csv;charset=utf-8;'
  );
}

/**
 * Generates a CSV for Mercado Libre bulk upload review.
 * Marketplace-specific identifiers remain blank on purpose.
 */
export function generateMercadoLibreCsv(products: ExportProduct[]) {
  const headers = [
    'Título',
    'Precio',
    'Stock',
    'Categoría',
    'Descripción',
    'URL de Imagen',
    'Marca',
    'Modelo',
    'EAN/UPC'
  ];

  const rows = products.map(p => [
    p.name,
    p.price,
    p.inStock ? 10 : 0,
    '',
    p.description,
    p.imageUrl,
    p.brand,
    p.subBrand || '',
    ''
  ]);

  const csvContent = '\uFEFF' + [
    headers.join(','),
    ...rows.map(row => row.map(quoteCsvCell).join(','))
  ].join('\n');

  downloadTextFile(
    csvContent,
    `${getExportBrandLabel(products)}_MercadoLibre_${getExportDateStamp()}.csv`,
    'text/csv;charset=utf-8;'
  );
}

/**
 * Generates a CSV for eBay File Exchange review.
 * Category is left blank to avoid exporting a misleading category id.
 */
export function generateEbayCsv(products: ExportProduct[]) {
  const headers = [
    'Action',
    'Category',
    'Title',
    'Description',
    'Price',
    'Quantity',
    'PicURL',
    'ConditionID',
    'Format',
    'Duration',
    'Location'
  ];

  const rows = products.map(p => [
    'Add',
    '',
    p.name.substring(0, 80),
    p.description,
    p.price,
    p.inStock ? 5 : 0,
    p.imageUrl,
    '1000',
    'FixedPrice',
    'GTC',
    'Mexico'
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(quoteCsvCell).join(','))
  ].join('\n');

  downloadTextFile(
    csvContent,
    `${getExportBrandLabel(products)}_eBay_${getExportDateStamp()}.csv`,
    'text/csv;charset=utf-8;'
  );
}

/**
 * Generates a TSV for Amazon Inventory Loader review.
 * Product identifier fields remain blank until a real ASIN/UPC/EAN is known.
 */
export function generateAmazonCsv(products: ExportProduct[]) {
  const headers = [
    'sku',
    'price',
    'quantity',
    'product-id',
    'product-id-type',
    'condition-type',
    'product-name',
    'brand-name',
    'description',
    'main-image-url'
  ];

  const rows = products.map(p => [
    p.id,
    p.price,
    p.inStock ? 20 : 0,
    '',
    '',
    'New',
    p.name,
    p.brand,
    p.description,
    p.imageUrl
  ]);

  const tsvContent = [
    headers.join('\t'),
    ...rows.map(row => row.map(normalizeExportText).join('\t'))
  ].join('\n');

  downloadTextFile(
    tsvContent,
    `${getExportBrandLabel(products)}_Amazon_${getExportDateStamp()}.tsv`,
    'text/tab-separated-values;charset=utf-8;'
  );
}

/**
 * Downloads a data URL as a file.
 */
export function downloadImage(dataUrl: string, fileName: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
