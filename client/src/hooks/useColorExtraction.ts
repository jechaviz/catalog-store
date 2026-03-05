import { useState, useEffect } from 'react';

interface ColorData {
  rgb: [number, number, number];
  hex: string;
  hsl: { h: number; s: number; l: number };
}

export function useColorExtraction(imageUrl: string | null): ColorData | null {
  const [color, setColor] = useState<ColorData | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setColor(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 150;
        canvas.height = 150;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(img, 0, 0, 150, 150);
          const imageData = ctx.getImageData(0, 0, 150, 150);
          const data = imageData.data;

          // Obtener el color dominante usando un algoritmo simple
          const colorMap: { [key: string]: number } = {};

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // Ignorar píxeles transparentes
            if (a < 128) continue;

            const hsl = rgbToHsl(r, g, b);

            // Ignorar colores muy blancos (l > 85), muy oscuros (l < 15), o grises/desaturados (s < 20)
            if (hsl.l > 85 || hsl.l < 15 || hsl.s < 20) continue;

            // Agrupar colores similares (redondeando cada 10 para hacer rangos más amplios)
            const key = `${Math.round(r / 10) * 10},${Math.round(g / 10) * 10},${Math.round(b / 10) * 10}`;

            // PESO DINÁMICO: Dar ventaja matemática masiva a los colores vibrantes
            // Si el color es rico y saturado (como dorado, rojo, azul fuerte), vale X veces más.
            let weight = 1;
            if (hsl.s > 60) weight = 5;      // Súper vibrante = 5x
            else if (hsl.s > 35) weight = 2; // Color normal = 2x

            colorMap[key] = (colorMap[key] || 0) + weight;
          }

          // Encontrar el color con mayor puntuación
          // Por defecto usamos Naranja Natura si la imagen no tiene colores vivos
          let dominantColor: [number, number, number] = [249, 115, 22];
          let maxCount = 0;

          for (const [colorStr, count] of Object.entries(colorMap)) {
            if (count > maxCount) {
              maxCount = count;
              const [r, g, b] = colorStr.split(',').map(Number);
              dominantColor = [r, g, b];
            }
          }

          const hex = rgbToHex(dominantColor[0], dominantColor[1], dominantColor[2]);
          let hsl = rgbToHsl(dominantColor[0], dominantColor[1], dominantColor[2]);

          setColor({
            rgb: dominantColor,
            hex,
            hsl,
          });
        }
      } catch (error) {
        console.error('Error extracting color:', error);
        setColor(null);
      }
    };

    img.onerror = () => {
      console.error('Error loading image');
      setColor(null);
    };

    img.src = imageUrl;
  }, [imageUrl]);

  return color;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
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

export function getLighterShade(hex: string, amount: number = 20): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const lighterL = Math.min(hsl.l + amount, 95);

  return hslToHex(hsl.h, hsl.s, lighterL);
}

export function getDarkerShade(hex: string, amount: number = 20): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const darkerL = Math.max(hsl.l - amount, 10);

  return hslToHex(hsl.h, hsl.s, darkerL);
}

export function getAnalogousColor(hex: string, hueOffset: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const newHue = (hsl.h + hueOffset + 360) % 360;

  // Ensure background colors stay vibrant and don't turn gray
  // We keep the saturation high (at least 60%) and the luminosity in a middle range
  const newSaturation = Math.max(hsl.s, 60);
  const newLuminosity = Math.min(Math.max(hsl.l, 30), 70);

  return hslToHex(newHue, newSaturation, newLuminosity);
}

function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : null;
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

// Función para generar formas SVG dinámicas basadas en color
export function generateBlobSVG(color: string, width: number = 300, height: number = 300): string {
  const randomPath = generateRandomBlobPath();
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <path d="${randomPath}" fill="${color}" opacity="0.8"/>
  </svg>`;
}

function generateRandomBlobPath(): string {
  const points = 6;
  const angleSlice = (Math.PI * 2) / points;
  const radiusVariation = 0.3;
  const centerX = 150;
  const centerY = 150;
  const baseRadius = 120;

  let path = '';
  for (let i = 0; i < points; i++) {
    const angle = angleSlice * i;
    const radius = baseRadius * (1 - radiusVariation + Math.random() * radiusVariation * 2);
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    path += (i === 0 ? 'M' : 'L') + ` ${x} ${y}`;
  }
  path += ' Z';
  return path;
}
