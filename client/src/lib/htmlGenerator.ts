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

function getLighterShade(hex: string, amount: number = 35): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const lighterL = Math.min(hsl.l + amount, 95);

  return hslToHex(hsl.h, hsl.s, lighterL);
}

function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : null;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };

  return `#${f(0)}${f(8)}${f(16)}`.toUpperCase();
}

export function generateCatalogHTML(products: Product[]): string {
  const productPages = products.map((product) => {
    const primaryColor = '#C1440E';
    const lightColor = getLighterShade(primaryColor, 35);

    const benefitsHTML = product.benefits
      .map(b => `<li style="margin-bottom: 12px; display: flex; gap: 12px; font-size: 14px;">
        <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${primaryColor}; flex-shrink: 0; margin-top: 6px;"></span>
        <span style="color: #555; word-wrap: break-word; overflow-wrap: break-word;">${b}</span>
      </li>`)
      .join('');

    return `
      <div style="width: 100%; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #F5F1E8; padding: 48px 32px; page-break-after: always; position: relative; overflow: hidden; box-sizing: border-box;">
        
        <!-- Animated background decorative elements -->
        <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0.2; pointer-events: none; z-index: 1;" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <defs>
            <filter id="blur">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
            </filter>
          </defs>
          <path d="M 900,100 Q 1000,50 1100,150 Q 1150,250 1050,350 Q 950,400 850,300 Q 800,150 900,100" fill="${primaryColor}" opacity="0.15" filter="url(#blur)" />
          <path d="M 100,600 Q 50,650 100,750 Q 200,800 300,700 Q 350,600 250,550 Q 150,500 100,600" fill="${primaryColor}" opacity="0.12" filter="url(#blur)" />
        </svg>

        <!-- Decorative curved line top right -->
        <svg style="position: absolute; top: 0; right: 0; width: 300px; height: 300px; opacity: 0.3; pointer-events: none; z-index: 2;" viewBox="0 0 300 300" preserveAspectRatio="none">
          <path d="M 0,0 Q 150,50 300,0" stroke="${primaryColor}" stroke-width="3" fill="none" stroke-linecap="round" />
          <path d="M 250,0 Q 280,80 250,150" stroke="${primaryColor}" stroke-width="2" fill="none" opacity="0.5" stroke-linecap="round" />
        </svg>

        <!-- Defensive padding dots pattern top right -->
        <div style="position: absolute; top: 40px; right: 40px; display: grid; grid-template-columns: repeat(4, 12px); gap: 12px; z-index: 2;">
          ${[...Array(20)].map(() => `<div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${primaryColor}; opacity: 0.3;"></div>`).join('')}
        </div>

        <!-- Main content grid -->
        <div style="position: relative; z-index: 10; width: 100%; max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center;">
          
          <!-- Left side - Content -->
          <div style="display: flex; flex-direction: column; justify-content: center; min-width: 0;">
            <div style="margin-bottom: 32px;">
              <h1 style="font-family: 'Playfair Display', serif; font-size: 42px; font-weight: 800; color: #3D2817; margin-bottom: 12px; line-height: 1.15; word-wrap: break-word; overflow-wrap: break-word;">
                ${product.name}
              </h1>
              <p style="font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 700; color: ${primaryColor}; letter-spacing: 0.05em; text-transform: uppercase; word-wrap: break-word; overflow-wrap: break-word;">
                ${product.brand} ${product.subBrand}
              </p>
            </div>

            <p style="font-family: 'Lato', sans-serif; color: #555; margin-bottom: 32px; line-height: 1.6; font-size: 16px; word-wrap: break-word; overflow-wrap: break-word;">
              ${product.description}
            </p>

            ${product.benefits.length > 0 ? `
            <ul style="list-style: none; padding: 0; margin-bottom: 40px;">
              ${benefitsHTML}
            </ul>
            ` : ''}

            <!-- Price Badge -->
            <div style="display: inline-flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 40px; border-radius: 32px; background-color: ${lightColor}; box-shadow: 0 20px 40px rgba(193, 68, 14, 0.25), inset 0 2px 10px rgba(255,255,255,0.5); width: fit-content;">
              <span style="font-family: 'Montserrat', sans-serif; font-size: 14px; font-weight: 700; color: ${primaryColor}; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.1em;">A sólo</span>
              <span style="font-family: 'Montserrat', sans-serif; font-size: 48px; font-weight: 900; color: ${primaryColor}; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">$${product.price.toFixed(2)}</span>
            </div>
          </div>

          <!-- Right side - Image with decorative elements -->
          <div style="position: relative; display: flex; align-items: center; justify-content: center; min-height: 450px;">
            <!-- Organic shape background blob -->
            <div style="position: absolute; width: 400px; height: 400px; border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; background-color: ${primaryColor}; opacity: 0.2; filter: blur(24px); mix-blend-mode: multiply;"></div>

            <!-- Decorative shape behind image -->
            <svg style="position: absolute; width: 450px; height: 450px; opacity: 0.15;" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid meet">
              <path d="M 150,40 Q 240,80 260,170 Q 240,260 150,280 Q 60,260 40,170 Q 60,80 150,40 Z" fill="${primaryColor}" opacity="0.4" />
            </svg>

            <!-- Product image -->
            <div style="position: relative; z-index: 10; width: 320px; height: 320px; border-radius: 45%; padding: 8px; background: rgba(255,255,255,0.3); backdrop-filter: blur(8px); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);">
               <img src="${product.imageUrl}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 45%; box-shadow: inset 0 0 40px rgba(193, 68, 14, 0.3);" />
            </div>

            <!-- Decorative elements around image -->
            <div style="position: absolute; top: -48px; left: -48px; width: 144px; height: 144px; opacity: 0.3; border-radius: 50%; background: radial-gradient(circle, ${primaryColor}, transparent); filter: blur(20px);"></div>
            <div style="position: absolute; bottom: -32px; right: -32px; width: 120px; height: 120px; opacity: 0.25; border-radius: 50%; background: radial-gradient(circle, ${primaryColor}, transparent); filter: blur(15px);"></div>
            
            <!-- Curved dashed lines -->
            <svg style="position: absolute; width: 100%; height: 100%; opacity: 0.3; pointer-events: none;" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet">
              <path d="M 200,50 Q 300,150 200,300" stroke="${primaryColor}" stroke-width="1.5" fill="none" opacity="0.5" stroke-linecap="round" stroke-dasharray="4 8" />
              <path d="M 100,150 Q 200,200 150,300" stroke="${primaryColor}" stroke-width="1" fill="none" opacity="0.4" stroke-linecap="round" />
            </svg>
          </div>
        </div>

        <!-- Bottom decorative wave -->
        <svg style="position: absolute; bottom: 0; left: 0; width: 100%; height: 120px; opacity: 0.2; pointer-events: none;" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M 0,60 Q 300,20 600,60 T 1200,60 L 1200,120 L 0,120 Z" fill="${primaryColor}" />
        </svg>
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Catálogo de Productos Natura</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Montserrat:wght@600;700&family=Lato:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      width: 100%;
      height: 100%;
    }

    body {
      font-family: 'Lato', sans-serif;
      background-color: #f5f1e8;
      color: #3d2817;
    }

    @media print {
      body {
        margin: 0;
        padding: 0;
        background: none;
      }

      div[style*="page-break-after"] {
        page-break-after: always;
        margin: 0;
        padding: 0;
      }
    }

    @media screen and (max-width: 1024px) {
      div[style*="grid-template-columns: 1fr 1fr"] {
        grid-template-columns: 1fr !important;
      }
    }
  </style>
</head>
<body>
  ${productPages}
</body>
</html>
  `;
}
