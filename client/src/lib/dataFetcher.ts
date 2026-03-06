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

const MOCK_DATA: CatalogData = {
    categories: [
        { id: "1", name: "Perfumería" },
        { id: "2", name: "Maquillaje" },
        { id: "3", name: "Cuerpo" },
        { id: "4", name: "Cabello" }
    ],
    products: [
        {
            id: "mock-1",
            name: "Perfume Femenino Esencial",
            brand: "Natura",
            subBrand: "Esencial",
            categoryId: "1",
            gender: "female",
            description: "Una fragancia sofisticada para momentos especiales.",
            benefits: ["Duración prolongada", "Envase reciclable"],
            price: 1250.00,
            imageUrl: "/perfume_fem.png",
            inStock: true,
            deliveryTime: "Entrega Inmediata",
            deliveryMethods: ["Envío a domicilio"]
        },
        {
            id: "mock-2",
            name: "Crema de Manos Ekos",
            brand: "Natura",
            subBrand: "Ekos",
            categoryId: "3",
            gender: "unisex",
            description: "Hidratación profunda con ingredientes de la Amazonia.",
            benefits: ["Biodegradable", "Cruelty Free"],
            price: 245.00,
            imageUrl: "/crema_manos.png",
            inStock: true,
            deliveryTime: "Entrega Inmediata",
            deliveryMethods: ["Envío a domicilio"]
        },
        {
            id: "mock-3",
            name: "Perfume Masculino Kaiak",
            brand: "Natura",
            subBrand: "Kaiak",
            categoryId: "1",
            gender: "male",
            description: "Frescura vibrante inspirada en el movimiento del mar.",
            benefits: ["Frescuras intensas", "Envase sustentable"],
            price: 890.00,
            imageUrl: "/perfume_masc.png",
            inStock: true,
            deliveryTime: "Entrega Inmediata",
            deliveryMethods: ["Envío a domicilio"]
        }
    ]
};

export async function fetchCatalogData(): Promise<CatalogData | null> {
    try {
        // Fetch products and categories in parallel
        const [productsRes, categoriesRes] = await Promise.all([
            odooClient.query({ query: GET_PRODUCTS, variables: { pageSize: 100 } }),
            odooClient.query({ query: GET_CATEGORIES })
        ]);

        const odooProducts = (productsRes.data as any)?.products?.products || [];
        const odooCategories = (categoriesRes.data as any)?.categories?.categories || [];

        // Map Odoo data to our local interfaces
        const products: CatalogProduct[] = odooProducts.map((p: any) => ({
            id: p.id.toString(),
            name: p.name,
            brand: "Natura", // Default for this shop
            subBrand: p.sku || "",
            categoryId: p.categories?.[0]?.id?.toString() || "uncategorized",
            gender: "unisex", // Odoo might need a custom field for this
            description: p.description || "",
            benefits: [], // Odoo might need a custom field for this
            price: p.price?.regular || 0,
            imageUrl: p.image || getOdooImageUrl('product.template', p.id),
            inStock: p.isInStock ?? true,
            deliveryTime: "Entrega Inmediata",
            deliveryMethods: ["Envío por paquetería"]
        }));

        const categories: Category[] = odooCategories.map((c: any) => ({
            id: c.id.toString(),
            name: c.name
        }));

        // If no products returned from Odoo, use mock data
        if (products.length === 0) {
            console.warn("No products found in Odoo, using mock data fallback.");
            return MOCK_DATA;
        }

        return {
            categories,
            products
        };
    } catch (error) {
        console.error("Error fetching Odoo catalog data, using mock data fallback:", error);
        // Fallback to mock data to allow the app to be tested/viewed
        return MOCK_DATA;
    }
}
