import type { CatalogProduct } from '@/lib/dataFetcher';

type ExportProduct = Pick<
  CatalogProduct,
  | 'id'
  | 'name'
  | 'description'
  | 'price'
  | 'imageUrl'
  | 'brand'
  | 'subBrand'
  | 'inStock'
  | 'benefits'
  | 'deliveryTime'
  | 'deliveryMethods'
>;

const EXPORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function getExportBrandLabel(products: ExportProduct[]) {
  const uniqueBrands = Array.from(
    new Set(products.map((product) => normalizeExportText(product.brand)).filter(Boolean))
  );

  if (uniqueBrands.length !== 1) {
    return 'Catalogo_Multimarca';
  }

  return uniqueBrands[0].replace(/\s+/g, '_');
}

function getCatalogLink(product: ExportProduct) {
  const normalizedBrand = normalizeExportText(product.brand).toLowerCase();
  const basePath = normalizedBrand === 'nikken' ? '/nikken' : '';
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

function clampText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength).trimEnd();
}

function buildMarketplaceTitle(product: ExportProduct, maxLength?: number) {
  const productName = normalizeExportText(product.name);
  const nameLower = productName.toLowerCase();
  const brand = normalizeExportText(product.brand);
  const subBrand = normalizeExportText(product.subBrand);
  const titleParts: string[] = [];

  if (brand && !nameLower.includes(brand.toLowerCase())) {
    titleParts.push(brand);
  }

  if (subBrand && !nameLower.includes(subBrand.toLowerCase())) {
    titleParts.push(subBrand);
  }

  if (productName) {
    titleParts.push(productName);
  }

  const title = titleParts.join(' ').trim() || product.id;
  return typeof maxLength === 'number' ? clampText(title, maxLength) : title;
}

function buildMarketplaceDescription(product: ExportProduct) {
  const description = normalizeExportText(product.description);
  const details: string[] = [];
  const brand = normalizeExportText(product.brand);
  const subBrand = normalizeExportText(product.subBrand);
  const benefits = (Array.isArray(product.benefits) ? product.benefits : [])
    .map((benefit) => normalizeExportText(benefit))
    .filter(Boolean)
    .slice(0, 4);
  const deliveryMethods = (Array.isArray(product.deliveryMethods) ? product.deliveryMethods : [])
    .map((method) => normalizeExportText(method))
    .filter(Boolean)
    .slice(0, 3);
  const deliveryTime = normalizeExportText(product.deliveryTime);

  if (brand) {
    details.push(`Marca: ${brand}.`);
  }

  if (subBrand) {
    details.push(`Linea: ${subBrand}.`);
  }

  details.push(`Disponibilidad: ${product.inStock ? 'Disponible' : 'Agotado'}.`);

  if (benefits.length > 0) {
    details.push(`Beneficios: ${benefits.join('; ')}.`);
  }

  if (deliveryTime) {
    details.push(`Entrega estimada: ${deliveryTime}.`);
  }

  if (deliveryMethods.length > 0) {
    details.push(`Entrega por: ${deliveryMethods.join(', ')}.`);
  }

  return [description, ...details].filter(Boolean).join(' ').trim();
}

function getExportQuantity(product: ExportProduct) {
  return product.inStock ? 1 : 0;
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
 * Category is left empty unless a real mapping exists.
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
    'google_product_category',
  ];

  const rows = products.map((product) => [
    product.id,
    buildMarketplaceTitle(product),
    buildMarketplaceDescription(product),
    product.inStock ? 'in stock' : 'out of stock',
    'new',
    `${product.price} MXN`,
    getCatalogLink(product),
    product.imageUrl,
    normalizeExportText(product.brand),
    '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map(quoteCsvCell).join(',')),
  ].join('\n');

  downloadTextFile(
    csvContent,
    `${getExportBrandLabel(products)}_WhatsApp_${getExportDateStamp()}.csv`,
    'text/csv;charset=utf-8;'
  );
}

/**
 * Generates a CSV for Mercado Libre bulk upload review.
 * Category and marketplace identifiers remain blank until they are known.
 */
export function generateMercadoLibreCsv(products: ExportProduct[]) {
  const headers = [
    'Titulo',
    'Precio',
    'Stock',
    'Categoria',
    'Descripcion',
    'URL de Imagen',
    'Marca',
    'Modelo',
    'SKU vendedor',
    'EAN/UPC',
  ];

  const rows = products.map((product) => [
    buildMarketplaceTitle(product),
    product.price,
    getExportQuantity(product),
    '',
    buildMarketplaceDescription(product),
    product.imageUrl,
    normalizeExportText(product.brand),
    normalizeExportText(product.subBrand),
    product.id,
    '',
  ]);

  const csvContent =
    '\uFEFF' +
    [
      headers.join(','),
      ...rows.map((row) => row.map(quoteCsvCell).join(',')),
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
    'CustomLabel',
    'ConditionID',
    'Format',
    'Duration',
    'Location',
  ];

  const rows = products.map((product) => [
    'Add',
    '',
    buildMarketplaceTitle(product, 80),
    buildMarketplaceDescription(product),
    product.price,
    getExportQuantity(product),
    product.imageUrl,
    product.id,
    '1000',
    'FixedPrice',
    'GTC',
    'Mexico',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map(quoteCsvCell).join(',')),
  ].join('\n');

  downloadTextFile(
    csvContent,
    `${getExportBrandLabel(products)}_eBay_${getExportDateStamp()}.csv`,
    'text/csv;charset=utf-8;'
  );
}

/**
 * Generates a TSV for Amazon Inventory Loader review.
 * Product identifier fields remain blank until a real ASIN, UPC or EAN is known.
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
    'main-image-url',
  ];

  const rows = products.map((product) => [
    product.id,
    product.price,
    getExportQuantity(product),
    '',
    '',
    'New',
    buildMarketplaceTitle(product),
    normalizeExportText(product.brand),
    buildMarketplaceDescription(product),
    product.imageUrl,
  ]);

  const tsvContent = [
    headers.join('\t'),
    ...rows.map((row) => row.map(normalizeExportText).join('\t')),
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
