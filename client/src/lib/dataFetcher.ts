import { client as odooClient, getOdooImageUrl } from './odoo';
import { GET_PRODUCTS, GET_CATEGORIES } from './odooQueries';

export interface Category {
    id: string;
    name: string;
}

export interface CatalogProduct {
    id: string;
    name: string;
    brand: string;
    subBrand: string;
    categoryId: string;
    gender: 'female' | 'male' | 'unisex';
    description: string;
    benefits: string[];
    price: number;
    imageUrl: string;
    inStock: boolean;
    paymentLink?: string;
    deliveryTime: string;
    deliveryMethods: string[];
}

export interface CatalogData {
    categories: Category[];
    products: CatalogProduct[];
}

const NATURA_MOCK_DATA: CatalogData = {
    categories: [
        { id: '1', name: 'Perfumeria' },
        { id: '2', name: 'Maquillaje' },
        { id: '3', name: 'Cuerpo' },
        { id: '4', name: 'Cabello' },
    ],
    products: [
        {
            id: 'mock-1',
            name: 'Perfume Femenino Esencial',
            brand: 'Natura',
            subBrand: 'Esencial',
            categoryId: '1',
            gender: 'female',
            description: 'Una fragancia sofisticada para momentos especiales.',
            benefits: ['Duracion prolongada', 'Envase reciclable'],
            price: 1250,
            imageUrl: '/perfume_fem.png',
            inStock: true,
            deliveryTime: 'Entrega Inmediata',
            deliveryMethods: ['Envio a domicilio'],
        },
        {
            id: 'mock-2',
            name: 'Crema de Manos Ekos',
            brand: 'Natura',
            subBrand: 'Ekos',
            categoryId: '3',
            gender: 'unisex',
            description: 'Hidratacion profunda con ingredientes de la Amazonia.',
            benefits: ['Biodegradable', 'Cruelty Free'],
            price: 245,
            imageUrl: '/crema_manos.png',
            inStock: true,
            deliveryTime: 'Entrega Inmediata',
            deliveryMethods: ['Envio a domicilio'],
        },
        {
            id: 'mock-3',
            name: 'Perfume Masculino Kaiak',
            brand: 'Natura',
            subBrand: 'Kaiak',
            categoryId: '1',
            gender: 'male',
            description: 'Frescura vibrante inspirada en el movimiento del mar.',
            benefits: ['Frescuras intensas', 'Envase sustentable'],
            price: 890,
            imageUrl: '/perfume_masc.png',
            inStock: true,
            deliveryTime: 'Entrega Inmediata',
            deliveryMethods: ['Envio a domicilio'],
        },
    ],
};

const NIKKEN_MOCK_DATA: CatalogData = {
    categories: [
        { id: 'nikken-1', name: 'Agua (PiMag)' },
        { id: 'nikken-2', name: 'Nutricion (Kenzen)' },
        { id: 'nikken-3', name: 'Descanso (Kenko Sleep)' },
        { id: 'nikken-4', name: 'Aire (KenkoAir)' },
        { id: 'nikken-5', name: 'Piel (True Elements)' },
        { id: 'nikken-6', name: 'Joyas y Magnetismo' },
    ],
    products: [
        {
            id: '4934',
            name: 'PiMag Waterfall',
            brand: 'Nikken',
            subBrand: 'PiMag',
            categoryId: 'nikken-1',
            gender: 'unisex',
            description: 'Sistema de filtracion de agua que replica el ciclo de la naturaleza.',
            benefits: ['Agua alcalina', 'Mineralizada', 'Libre de sedimentos'],
            price: 9850,
            imageUrl: '/assets/nikken/products/4934.jpg',
            inStock: true,
            deliveryTime: '3-5 dias habiles',
            deliveryMethods: ['Envio nacional'],
        },
        {
            id: '1441',
            name: 'KenkoAir Purifier',
            brand: 'Nikken',
            subBrand: 'KenkoAir',
            categoryId: 'nikken-4',
            gender: 'unisex',
            description: 'Purificador de aire con filtracion HEPA de alta eficiencia.',
            benefits: ['Reduce alergenos', 'Silencioso', 'Bajo consumo'],
            price: 15924,
            imageUrl: '/assets/nikken/products/1441.jpg',
            inStock: true,
            deliveryTime: '3-5 dias habiles',
            deliveryMethods: ['Envio nacional'],
        },
        {
            id: '10320',
            name: 'Kenko Sleep Luxury Mattress King',
            brand: 'Nikken',
            subBrand: 'Kenko Sleep',
            categoryId: 'nikken-3',
            gender: 'unisex',
            description: 'Colchon de lujo con tecnologia magnetica y de infrarrojo lejano.',
            benefits: ['Soporte ergonomico', 'Regulacion termica', 'Relax profundo'],
            price: 40762,
            imageUrl: '/assets/nikken/products/10320.jpg',
            inStock: true,
            deliveryTime: '8-10 dias habiles',
            deliveryMethods: ['Envio especializado'],
        },
        {
            id: '18093',
            name: 'True Elements Beauty Mask',
            brand: 'Nikken',
            subBrand: 'True Elements',
            categoryId: 'nikken-5',
            gender: 'female',
            description: 'Mascara de belleza con Snow Lotus para hidratacion profunda.',
            benefits: ['Efecto rejuvenecedor', 'Luminosidad', 'Ingredientes naturales'],
            price: 2616,
            imageUrl: '/assets/nikken/products/18093.jpg',
            inStock: true,
            deliveryTime: 'Entrega Inmediata',
            deliveryMethods: ['Envio nacional'],
        },
        {
            id: '1372',
            name: 'Cartucho PiMag Water System',
            brand: 'Nikken',
            subBrand: 'PiMag',
            categoryId: 'nikken-1',
            gender: 'unisex',
            description: 'Repuesto de cartucho para el sistema de agua PiMag.',
            benefits: ['Filtracion de cloro', 'Sabor mejorado', 'Equilibrio pH'],
            price: 1453,
            imageUrl: '/assets/nikken/products/1372.jpg',
            inStock: true,
            deliveryTime: 'Entrega Inmediata',
            deliveryMethods: ['Envio nacional'],
        },
        {
            id: '4933',
            name: 'Paquete Repuestos Pi Water',
            brand: 'Nikken',
            subBrand: 'PiMag',
            categoryId: 'nikken-1',
            gender: 'unisex',
            description: 'Kit completo de repuestos para el sistema Pi Water.',
            benefits: ['Ahorro en paquete', 'Mantenimiento preventivo'],
            price: 1533,
            imageUrl: '/assets/nikken/products/4933.jpg',
            inStock: true,
            deliveryTime: 'Entrega Inmediata',
            deliveryMethods: ['Envio nacional'],
        },
    ],
};

function cloneCatalogData(data: CatalogData): CatalogData {
    return {
        categories: data.categories.map(category => ({ ...category })),
        products: data.products.map(product => ({
            ...product,
            benefits: [...product.benefits],
            deliveryMethods: [...product.deliveryMethods],
        })),
    };
}

function getFallbackData(brand: 'natura' | 'nikken') {
    return cloneCatalogData(brand === 'nikken' ? NIKKEN_MOCK_DATA : NATURA_MOCK_DATA);
}

export async function fetchCatalogData(brand: 'natura' | 'nikken' = 'natura'): Promise<CatalogData | null> {
    try {
        if (brand === 'nikken') {
            return getFallbackData('nikken');
        }

        const [productsRes, categoriesRes] = await Promise.all([
            odooClient.query({ query: GET_PRODUCTS, variables: { pageSize: 100 } }),
            odooClient.query({ query: GET_CATEGORIES }),
        ]);

        const odooProducts = (productsRes.data as any)?.products?.products || [];
        const odooCategories = (categoriesRes.data as any)?.categories?.categories || [];

        const products: CatalogProduct[] = odooProducts.map((product: any) => ({
            id: String(product.id),
            name: product.name,
            brand: 'Natura',
            subBrand: product.sku || '',
            categoryId: product.categories?.[0]?.id?.toString() || 'uncategorized',
            gender: 'unisex',
            description: product.description || '',
            benefits: [],
            price: product.price?.regular || 0,
            imageUrl: product.image || getOdooImageUrl('product.template', product.id),
            inStock: product.isInStock ?? true,
            deliveryTime: 'Entrega Inmediata',
            deliveryMethods: ['Envio por paqueteria'],
        }));

        const categories: Category[] = odooCategories.map((category: any) => ({
            id: String(category.id),
            name: category.name,
        }));

        if (products.length === 0) {
            console.warn('No products found in Odoo, using mock data fallback.');
            return getFallbackData('natura');
        }

        return {
            categories: categories.length > 0 ? categories : cloneCatalogData(NATURA_MOCK_DATA).categories,
            products,
        };
    } catch (error) {
        console.error('Error fetching Odoo catalog data, using mock data fallback:', error);
        return getFallbackData(brand);
    }
}
