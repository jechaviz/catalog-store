import { useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import type { CatalogProduct } from '@/lib/dataFetcher';
import { getLighterShade, getAnalogousColor } from '@/hooks/useColorExtraction';

interface PdfGeneratorProps {
    products: CatalogProduct[];
}

export function CatalogPdfGenerator({ products }: PdfGeneratorProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);

    const generatePdf = async () => {
        if (isGenerating) return;
        setIsGenerating(true);
        setProgress(0);

        try {
            // Group products by gender to create a structured catalog
            const grouped = products.reduce((acc, product) => {
                const gender = product.gender || 'unisex';
                if (!acc[gender]) acc[gender] = [];
                acc[gender].push(product);
                return acc;
            }, {} as Record<string, CatalogProduct[]>);

            const doc = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = doc.internal.pageSize.getHeight();
            let isFirstPage = true;

            // Helper to load image as base64 to avoid html2canvas issues
            const loadImageAsBase64 = async (url: string): Promise<string> => {
                if (!url) return '';
                try {
                    // Ensure the URL is absolute for fetch
                    const absoluteUrl = url.startsWith('http') ? url : window.location.origin + url;
                    const response = await fetch(absoluteUrl);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const blob = await response.blob();
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    console.error("Failed to load image for PDF:", url, e);
                    return ''; // Return empty string to allow PDF generation without that specific image
                }
            };

            // Create a hidden iframe for isolated rendering (avoids oklch/Tailwind conflicts)
            const iframe = document.createElement('iframe');
            iframe.id = 'pdf-render-frame';
            iframe.style.position = 'fixed';
            iframe.style.top = '0';
            iframe.style.left = '0';
            iframe.style.width = '794px';
            iframe.style.height = '1122px';
            iframe.style.visibility = 'hidden';
            iframe.style.pointerEvents = 'none';
            iframe.style.zIndex = '-9999';
            document.body.appendChild(iframe);

            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!iframeDoc) throw new Error("No se pudo acceder al documento del iframe.");

            // Basic setup for the iframe document
            iframeDoc.open();
            iframeDoc.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { margin: 0; padding: 0; background-color: #FBFAF9; font-family: sans-serif; }
                        * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
                        .page { width: 794px; height: 1122px; padding: 60px; position: relative; overflow: hidden; display: flex; flex-direction: column; background-color: #FBFAF9; }
                    </style>
                </head>
                <body></body>
                </html>
            `);
            iframeDoc.close();

            const genderLabels: Record<string, string> = {
                female: 'Para Ella',
                male: 'Para Él',
                unisex: 'Unisex',
            };

            const totalProducts = products.length;
            let processedCount = 0;

            for (const [gender, categoryProducts] of Object.entries(grouped)) {
                for (const product of categoryProducts) {
                    if (!isFirstPage) {
                        doc.addPage();
                    }
                    isFirstPage = false;

                    processedCount++;
                    setProgress(Math.round((processedCount / totalProducts) * 100));

                    const primaryColor = '#F97316';
                    const analogousColor1 = getAnalogousColor(primaryColor, 35);
                    const analogousColor2 = getAnalogousColor(primaryColor, -35);

                    // Load image as base64
                    const safeBase64Image = await loadImageAsBase64(product.imageUrl);

                    // Create the HTML node for this product page
                    const pageNode = iframeDoc.createElement('div');
                    pageNode.className = 'page';

                    pageNode.innerHTML = `
                        <!-- Decorative background -->
                        <div style="position: absolute; top: -100px; right: -100px; width: 400px; height: 400px; background-color: ${analogousColor1}; border-radius: 50%; opacity: 0.1;"></div>
                        <div style="position: absolute; bottom: -150px; left: -150px; width: 500px; height: 500px; background-color: ${analogousColor2}; border-radius: 50%; opacity: 0.08;"></div>
                        
                        <!-- Header -->
                        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 50px; border-bottom: 2px solid ${primaryColor}40; padding-bottom: 20px; position: relative; z-index: 10; width: 100%;">
                            <div style="flex: 1;">
                                <h1 style="margin: 0; color: ${primaryColor}; font-size: 38px; font-weight: 900; letter-spacing: -1.5px;">natura</h1>
                                <p style="margin: 5px 0 0; color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 3px; font-weight: 600;">Catálogo Digital 2026</p>
                            </div>
                            <div style="text-align: right;">
                                <span style="display: inline-block; padding: 6px 16px; background-color: ${primaryColor}; color: white; border-radius: 100px; font-size: 14px; font-weight: 800; text-transform: uppercase;">
                                    ${genderLabels[gender] || gender}
                                </span>
                            </div>
                        </div>

                        <!-- Main Content -->
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; z-index: 10; gap: 40px; width: 100%;">
                            
                            <!-- Image Section -->
                            <div style="position: relative; width: 450px; height: 450px; display: flex; align-items: center; justify-content: center;">
                                <div style="position: absolute; inset: 0; background-color: ${primaryColor}15; border-radius: 50%;"></div>
                                ${safeBase64Image
                            ? `<img src="${safeBase64Image}" style="max-width: 90%; max-height: 90%; object-fit: contain; position: relative; z-index: 20; border-radius: 30px; box-shadow: 0 30px 60px rgba(0,0,0,0.1); border: 8px solid white;" />`
                            : `<div style="width: 300px; height: 300px; background: white; border-radius: 30px; border: 4px dashed ${primaryColor}40; display: flex; align-items: center; justify-content: center; color: ${primaryColor}80; font-size: 40px;">📷</div>`
                        }
                            </div>

                            <!-- Info Section -->
                            <div style="width: 100%; text-align: center;">
                                <p style="margin: 0; color: ${primaryColor}; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 10px;">${product.brand} ${product.subBrand}</p>
                                <h1 style="margin: 0; color: #111; font-size: 48px; font-weight: 900; line-height: 1.1; margin-bottom: 25px;">${product.name}</h1>
                                <p style="margin: 0 auto; color: #444; font-size: 18px; line-height: 1.6; max-width: 85%; margin-bottom: 45px;">${product.description}</p>

                                <!-- Specs Grid -->
                                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; width: 100%; margin-bottom: 20px;">
                                    <div style="background: white; padding: 15px; border-radius: 15px; border: 1px solid #EEE;">
                                        <p style="margin: 0; font-size: 10px; text-transform: uppercase; color: #888; font-weight: 700;">Código</p>
                                        <p style="margin: 5px 0 0; font-size: 18px; font-weight: 800; color: #111;">${product.id.split('-')[0].toUpperCase()}</p>
                                    </div>
                                    <div style="background: white; padding: 15px; border-radius: 15px; border: 1px solid #EEE;">
                                        <p style="margin: 0; font-size: 10px; text-transform: uppercase; color: #888; font-weight: 700;">Stock</p>
                                        <p style="margin: 5px 0 0; font-size: 16px; font-weight: 800; color: ${product.inStock ? '#15803d' : '#991b1b'};">${product.inStock ? 'Disponible' : 'Agotado'}</p>
                                    </div>
                                    <div style="background: white; padding: 15px; border-radius: 15px; border: 1px solid #EEE;">
                                        <p style="margin: 0; font-size: 10px; text-transform: uppercase; color: #888; font-weight: 700;">Entrega</p>
                                        <p style="margin: 5px 0 0; font-size: 14px; font-weight: 800; color: #111;">${product.deliveryTime}</p>
                                    </div>
                                    <div style="background: ${primaryColor}; padding: 15px; border-radius: 15px; color: white;">
                                        <p style="margin: 0; font-size: 10px; text-transform: uppercase; opacity: 0.9; font-weight: 700;">Precio</p>
                                        <p style="margin: 5px 0 0; font-size: 24px; font-weight: 900;">$${product.price.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 10; padding-top: 25px; border-top: 1px solid #EEE; width: 100%;">
                            <div style="display: flex; gap: 8px;">
                                ${product.benefits.slice(0, 2).map(b => `<span style="padding: 4px 12px; background: white; border-radius: 100px; font-size: 11px; color: #666; border: 1px solid #EEE;">${b.length > 30 ? b.substring(0, 27) + '...' : b}</span>`).join('')}
                            </div>
                            <p style="margin: 0; font-size: 11px; color: #AAA; font-weight: 500;">www.natura.com.mx • Página ${processedCount} de ${totalProducts}</p>
                        </div>
                    `;

                    iframeDoc.body.innerHTML = ''; // Clear previous page
                    iframeDoc.body.appendChild(pageNode);

                    // Capture node from within the iframe
                    try {
                        const canvas = await html2canvas(iframeDoc.body, {
                            scale: 1.5, // Slightly lower scale for stability
                            useCORS: true,
                            backgroundColor: '#FBFAF9',
                            logging: false,
                            width: 794,
                            height: 1122,
                        });

                        const imgData = canvas.toDataURL('image/jpeg', 0.8);
                        doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                    } catch (captureError) {
                        console.error("html2canvas capture error:", captureError);
                        throw new Error(`Error capturando página ${processedCount}: ${captureError}`);
                    }
                }
            }

            document.body.removeChild(iframe);
            doc.save('Catalogo_Natura_Digital.pdf');

        } catch (error) {
            console.error('Error final generating PDF:', error);
            alert(`Error al generar el PDF: ${error instanceof Error ? error.message : String(error)}. Este problema suele ocurrir por incompatibilidad de colores con Tailwind v4. Se ha implementado un aislamiento para corregirlo.`);
        } finally {
            setIsGenerating(false);
            setProgress(0);
        }
    };

    return (
        <Button
            onClick={generatePdf}
            disabled={isGenerating || products.length === 0}
            variant="outline"
            className="flex items-center gap-2 border-primary/20 hover:border-primary hover:bg-primary/5 text-primary transition-all pointer-events-auto sm:min-w-[180px]"
            title="Descargar Catálogo PDF"
        >
            {isGenerating ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">Generando... {progress}%</span>
                    <span className="sm:hidden">{progress}%</span>
                </>
            ) : (
                <>
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Descargar PDF</span>
                </>
            )}
        </Button>
    );
}
