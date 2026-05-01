/**
 * Central configuration for the catalog app
 */

export const CONFIG = {
    APP_NAME: 'Catálogo Digital',
    VERSION: '1.0.0',
    YEAR: 2026,

    // Contact & Sales
    SELLER: {
        NAME: 'Asesor de ventas',
        PHONE: '5215573456073',
        CLABE: '012345678901234567 (Bancomer)',
        WHATSAPP_BASE_URL: 'https://wa.me/',
        MERCADO_PAGO_LINK: 'https://link.mercadopago.com.mx/tu-tienda',
        PAYU_ID: '12345',
    },

    // Shipping
    SHIPPING: {
        FREE_THRESHOLD: 1500,
        DEFAULT_COST: 99,
        DELIVERY_TIME_ESTIMATE: 'Entrega inmediata',
    },

    // UI Aesthetic defaults
    THEME: {
        PRIMARY_COLOR: '#F97316', // Natura Orange
        SECONDARY_COLOR: '#FBFAF9',
        FONT_FAMILY: 'sans-serif',
    },

    // i18n placeholders (could be moved to separate JSON/TS files later)
    STRINGS: {
        es: {
            COMMON: {
                LOADING: 'Cargando...',
                CANCEL: 'Cancelar',
                SAVE: 'Guardar',
                BACK: 'Atrás',
                TOTAL: 'Total',
                SUBTOTAL: 'Subtotal',
                SHIPPING: 'Envío',
                FREE: '¡Gratis!',
            },
            CHECKOUT: {
                TITLE: 'Finalizar compra',
                SHIPPING_DATA: 'Datos de envío',
                PAYMENT_METHOD: 'Método de pago',
                CONFIRM_ORDER: 'Confirmar pedido',
                ORDER_SUMMARY: 'Resumen de tu pedido',
            },
            CATALOG: {
                DOWNLOAD_PDF: 'Descargar PDF',
                GENERATING: 'Generando...',
                GENDER_LABELS: {
                    female: 'Para ella',
                    male: 'Para él',
                    unisex: 'Unisex',
                }
            }
        }
    }
};

export type Language = 'es';
export const DEFAULT_LANG: Language = 'es';

export const t = (path: string, lang: Language = DEFAULT_LANG) => {
    const keys = path.split('.');
    let current: any = CONFIG.STRINGS[lang];

    for (const key of keys) {
        if (current[key] === undefined) return path;
        current = current[key];
    }

    return current;
};
