import { useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import type { CatalogProduct } from '@/lib/dataFetcher';
import { getLighterShade } from '@/hooks/useColorExtraction';

interface PdfGeneratorProps {
    products: CatalogProduct[];
}

export function CatalogPdfGenerator({ products }: PdfGeneratorProps) {
    const [isGenerating, setIsGenerating] = useState(false);

    const generatePdf = async () => {
        if (isGenerating) return;
        setIsGenerating(true);

        try {
            // Group products by gender and subcategory
            const grouped = products.reduce((acc, product) => {
                const gender = product.gender || 'unisex';
                const subBrand = product.subBrand || 'General';
                if (!acc[gender]) acc[gender] = {};
                if (!acc[gender][subBrand]) acc[gender][subBrand] = [];
                acc[gender][subBrand].push(product);
                return acc;
            }, {} as Record<string, Record<string, CatalogProduct[]>>);

            const doc = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = doc.internal.pageSize.getHeight();
            let isFirstPage = true;

            // Helper to load image as base64 to avoid html2canvas CORS issues
            const loadImageAsBase64 = async (url: string): Promise<string> => {
                try {
                    const response = await fetch(url, { mode: 'cors' });
                    if (!response.ok) throw new Error('Network response was not ok');
                    const blob = await response.blob();
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    console.warn("Failed to load image for PDF. CORS or Network error.", url);
                    // Return empty string to indicate failure and render a fallback div instead
                    return '';
                }
            };

            // Render container to hold the hidden DOM elements we will capture
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.top = '-9999px';
            container.style.left = '-9999px';
            container.style.width = '794px'; // A4 width at 96 DPI
            document.body.appendChild(container);

            const genderLabels: Record<string, string> = {
                female: 'Para Ella',
                male: 'Para Él',
                unisex: 'Unisex',
            };

            for (const [gender, subcategories] of Object.entries(grouped)) {
                for (const [subBrand, categoryProducts] of Object.entries(subcategories)) {
                    for (const product of categoryProducts) {
                        if (!isFirstPage) {
                            doc.addPage();
                        }
                        isFirstPage = false;

                        // Create the HTML node for this product
                        const pageNode = document.createElement('div');
                        const primaryColor = 'var(--primary, #f97316)';

                        // Load the image safely as base64
                        const safeBase64Image = await loadImageAsBase64(product.imageUrl);

                        pageNode.innerHTML = `
                            <div style="background-color: white; width: 794px; height: 1123px; padding: 40px; box-sizing: border-box; font-family: sans-serif; position: relative; overflow: hidden; display: flex; flex-direction: column;">
                                {/* Header */}
                                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${primaryColor}; padding-bottom: 20px; z-index: 10;">
                                    <h1 style="margin: 0; color: ${primaryColor}; font-size: 32px; font-weight: 900; text-transform: uppercase;">Natura</h1>
                                    <div style="text-align: right;">
                                        <h2 style="margin: 0; font-size: 24px; color: #333;">${genderLabels[gender]}</h2>
                                        <p style="margin: 5px 0 0; color: #666; font-size: 16px;">${subBrand}</p>
                                    </div>
                                </div>

                                {/* Main Content */}
                                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10; margin-top: 40px;">
                                    
                                    <div style="position: relative; width: 500px; height: 500px; margin-bottom: 40px; display: flex; align-items: center; justify-content: center;">
                                        <div style="position: absolute; inset: 0; background-color: ${primaryColor}; opacity: 0.1; border-radius: 45%; filter: blur(20px);"></div>
                                        ${safeBase64Image
                                ? `<img src="${safeBase64Image}" alt="${product.name}" style="max-width: 80%; max-height: 80%; object-fit: contain; position: relative; z-index: 20; border-radius: 40px; box-shadow: 0 20px 40px rgba(0,0,0,0.1);" crossorigin="anonymous" />`
                                : `<div style="position: relative; z-index: 20; width: 80%; height: 80%; background-color: white; border-radius: 40px; border: 4px dashed ${primaryColor}; display: flex; align-items: center; justify-content: center; flex-direction: column; color: ${primaryColor}; font-weight: bold; font-size: 24px;">
                                                <span>📷</span>
                                                <span style="font-size: 16px; margin-top: 10px;">Imagen no disponible</span>
                                               </div>`
                            }
                                    </div>

                                    <h1 style="font-size: 48px; color: #111; font-weight: 800; text-align: center; margin: 0 0 10px 0;">${product.name}</h1>
                                    <p style="font-size: 20px; color: #555; text-align: center; max-width: 80%; margin: 0 0 40px 0; line-height: 1.5;">${product.description}</p>
                                    
                                    <div style="display: flex; gap: 20px; justify-content: center; width: 100%;">
                                        <div style="background-color: #f8fafc; padding: 20px 30px; border-radius: 20px; text-align: center; border: 1px solid #e2e8f0;">
                                            <p style="margin: 0; color: #64748b; font-size: 14px; text-transform: uppercase; font-weight: bold;">Código de Producto</p>
                                            <p style="margin: 10px 0 0; color: #0f172a; font-size: 24px; font-family: monospace; font-weight: bold;">${product.id.split('-')[0].toUpperCase()}</p>
                                        </div>
                                        
                                        <div style="background-color: ${primaryColor}; padding: 20px 40px; border-radius: 20px; text-align: center; color: white;">
                                            <p style="margin: 0; opacity: 0.9; font-size: 14px; text-transform: uppercase; font-weight: bold;">Precio Especial</p>
                                            <p style="margin: 10px 0 0; font-size: 32px; font-weight: 900;">$${product.price.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; gap: 20px; justify-content: center; width: 100%; margin-top: 20px;">
                                        <div style="background-color: #f0fdf4; padding: 15px 30px; border-radius: 15px; text-align: center; border: 1px solid #bbf7d0;">
                                            <p style="margin: 0; color: #166534; font-size: 14px; font-weight: bold;">✔️ Disponibilidad</p>
                                            <p style="margin: 5px 0 0; color: #15803d; font-size: 18px; font-weight: 600;">En Stock</p>
                                        </div>
                                        <div style="background-color: #eff6ff; padding: 15px 30px; border-radius: 15px; text-align: center; border: 1px solid #bfdbfe;">
                                            <p style="margin: 0; color: #1e40af; font-size: 14px; font-weight: bold;">🚚 Tiempo de Entrega</p>
                                            <p style="margin: 5px 0 0; color: #1d4ed8; font-size: 18px; font-weight: 600;">24 - 48 hrs</p>
                                        </div>
                                    </div>

                                </div>

                                {/* Footer Background Elements */}
                                <div style="position: absolute; bottom: -50px; left: -50px; width: 300px; height: 300px; background-color: ${primaryColor}; border-radius: 50%; opacity: 0.05; z-index: 1;"></div>
                                <div style="position: absolute; top: 100px; right: -100px; width: 400px; height: 400px; background-color: ${primaryColor}; border-radius: 50%; opacity: 0.05; z-index: 1;"></div>
                            </div>
                        `;

                        container.appendChild(pageNode);

                        // Use html2canvas to capture the node
                        const canvas = await html2canvas(pageNode, {
                            scale: 2, // higher resolution
                            useCORS: true, // enable loading cross-origin images
                            logging: false,
                        });

                        const imgData = canvas.toDataURL('image/jpeg', 0.9);
                        doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

                        // Clean up node
                        container.removeChild(pageNode);
                    }
                }
            }

            document.body.removeChild(container);
            doc.save('Catálogo_Natura.pdf');

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Hubo un error al generar el PDF. Verifica que las imágenes sean accesibles.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Button
            onClick={generatePdf}
            disabled={isGenerating || products.length === 0}
            variant="outline"
            className="flex items-center gap-2 border-primary/20 hover:bg-primary hover:text-white transition-all pointer-events-auto"
        >
            {isGenerating ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generando...
                </>
            ) : (
                <>
                    <Download className="w-4 h-4" />
                    Descargar Catálogo PDF
                </>
            )}
        </Button>
    );
}
