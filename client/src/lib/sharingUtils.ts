import type { CatalogProduct } from '@/lib/dataFetcher';

type ExportProduct = Pick<
  CatalogProduct,
  'id' | 'name' | 'description' | 'price' | 'imageUrl' | 'brand' | 'subBrand' | 'inStock'
>;

function getExportBrandLabel(products: ExportProduct[]) {
  return (products[0]?.brand || 'Catalogo').replace(/\s+/g, '_');
}

function getCatalogLink(product: ExportProduct) {
  const basePath = product.brand.toLowerCase() === 'nikken' ? '/nikken' : '';
  return `${window.location.origin}${basePath}?p=${product.id}`;
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
    p.description.replace(/,/g, ' '),
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
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${getExportBrandLabel(products)}_WhatsApp_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates a CSV for Mercado Libre Bulk Upload.
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
    'Salud y Belleza > Maquillaje',
    p.description.replace(/,/g, ' '),
    p.imageUrl,
    p.brand,
    p.subBrand,
    '' // UPC empty
  ]);

  const csvContent = '\uFEFF' + [ // UTF-8 BOM for Excel
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${getExportBrandLabel(products)}_MercadoLibre_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates a CSV for eBay File Exchange.
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
    '26395', // Health & Beauty category placeholder
    p.name.substring(0, 80),
    p.description.replace(/,/g, ' '),
    p.price,
    p.inStock ? 5 : 0,
    p.imageUrl,
    '1000', // New condition
    'FixedPrice',
    'GTC',
    'Mexico'
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${getExportBrandLabel(products)}_eBay_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates a TSV for Amazon Inventory Loader.
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
    '', // ASIN/UPC
    '1', // ASIN type placeholder
    'New',
    p.name,
    p.brand,
    p.description.replace(/,/g, ' '),
    p.imageUrl
  ]);

  // Amazon expects Tab-Separated Values (TSV) or CSV
  const csvContent = [
    headers.join('\t'),
    ...rows.map(row => row.join('\t'))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${getExportBrandLabel(products)}_Amazon_${new Date().toISOString().split('T')[0]}.txt`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
