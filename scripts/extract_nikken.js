import fs from 'fs';
import path from 'path';

const SITE_DIR = 'C:/git/websites/mitiendanikken.com';
const PRODUCT_FILES = ['productos.html', ...Array.from({ length: 19 }, (_, i) => `productos-${i + 1}.html`)];

const products = new Map();

function extractProducts(filePath) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Split by product item start
    const chunks = content.split('<div class="ajax_block_product');
    // Skip the first chunk as it's the header
    for (let i = 1; i < chunks.length; i++) {
        const itemHtml = chunks[i];
        
        const skuMatch = /data-sku="([^"]+)"/.exec(itemHtml);
        const nameMatch = /class="product-name"[^>]*title="([^"]+)"/.exec(itemHtml);
        const priceMatch = /id="product-price-[^"]*">([\s\S]*?)<\/span>/.exec(itemHtml);
        const imageMatch = /src="([^"]+)"/.exec(itemHtml);
        
        if (skuMatch && nameMatch) {
            const sku = skuMatch[1];
            const name = nameMatch[1].trim().replace(/\s+/g, ' ');
            
            // Skip templates
            if (name.includes('{{')) continue;
            
            const priceText = priceMatch ? priceMatch[1].replace(/,/g, '').trim() : '0';
            const priceValue = parseFloat(priceText);
            const price = isNaN(priceValue) ? 0 : priceValue;
            let image = imageMatch ? imageMatch[1] : '';
            
            // Normalize image path
            if (image.startsWith('tv-store/')) {
                // Keep it
            } else {
                image = 'tv-store/Products/images/' + sku + '.jpg';
            }

            
            // Map category based on brand/filePath or name keywords
            let category = 'Bienestar';
            if (name.toLowerCase().includes('pimag') || name.toLowerCase().includes('agua')) category = 'Agua';
            else if (name.toLowerCase().includes('kenkoair') || name.toLowerCase().includes('aire')) category = 'Aire';
            else if (name.toLowerCase().includes('sleep') || name.toLowerCase().includes('descanso') || name.toLowerCase().includes('colchon') || name.toLowerCase().includes('hagu')) category = 'Descanso';
            else if (name.toLowerCase().includes('joyeria') || name.toLowerCase().includes('fashion')) category = 'Joyería';
            else if (name.toLowerCase().includes('nutricion') || name.toLowerCase().includes('kenzen')) category = 'Nutrición';
            else if (name.toLowerCase().includes('balance') || name.toLowerCase().includes('accesorio')) category = 'Accesorios';
            
            // Sub-brand extraction
            let subBrand = 'Nikken';
            if (name.toUpperCase().includes('PIMAG')) subBrand = 'PiMag';
            else if (name.toUpperCase().includes('KENKOAIR')) subBrand = 'KenkoAir';
            else if (name.toUpperCase().includes('KENKO SLEEP')) subBrand = 'KenkoSleep';
            else if (name.toUpperCase().includes('TRUE ELEMENTS')) subBrand = 'True Elements';
            else if (name.toUpperCase().includes('KENKO BALANCE')) subBrand = 'KenkoBalance';

            products.set(sku, {
                id: sku,
                name,
                price,
                image,
                category,
                subBrand,
                description: `Producto de bienestar Nikken: ${name}. Diseñado para mejorar tu calidad de vida a través de tecnologías naturales.`,
                isNikken: true
            });
        }
    }
}


console.log('Starting extraction...');
PRODUCT_FILES.forEach(file => {
    console.log(`Processing ${file}...`);
    extractProducts(path.join(SITE_DIR, file));
});

const result = Array.from(products.values());
fs.writeFileSync('nikken_products.json', JSON.stringify(result, null, 2));
console.log(`Done! Extracted ${result.length} products.`);
