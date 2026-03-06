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

        return {
            categories,
            products
        };
    } catch (error) {
        console.error("Error fetching Odoo catalog data", error);
        // Fallback or return null to allow the app to handle empty state
        return null;
    }
}
