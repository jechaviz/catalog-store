import yaml from 'js-yaml';

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
        const response = await fetch('/products.yml');
        if (!response.ok) {
            throw new Error(`Failed to load YAML: ${response.statusText}`);
        }
        const yamlText = await response.text();
        const parsedData = yaml.load(yamlText) as CatalogData;
        return parsedData;
    } catch (error) {
        console.error("Error parsing YAML catalog data", error);
        return null;
    }
}
