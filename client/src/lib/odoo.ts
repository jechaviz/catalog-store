import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

/**
 * Cliente Apollo configurado para Odoo (con el módulo graphql_vuestorefront)
 * 
 * Basado en los patrones de erpgap/alokai-odoo
 */

const httpLink = new HttpLink({
    // URL de tu instancia de Odoo + el endpoint del módulo GraphQL
    uri: import.meta.env.VITE_ODOO_GRAPHQL_URL || 'https://tu-odoo.com/graphql/vsf',
});

const authLink = setContext((_, { headers }) => {
    // Aquí se manejaría la sesión de Odoo (Cookie o Token)
    const session = localStorage.getItem('odoo_session');
    return {
        headers: {
            ...headers,
            ...(session ? { 'X-Odoo-Session': session } : {}),
        }
    }
});

export const client = new ApolloClient({
    link: from([authLink, httpLink]),
    cache: new InMemoryCache({
        typePolicies: {
            Query: {
                fields: {
                    products: {
                        merge(existing, incoming) {
                            return incoming;
                        },
                    },
                },
            },
        },
    }),
});

/**
 * Helper para generar URLs de imágenes de Odoo
 */
export const getOdooImageUrl = (model: string, id: number, field: string = 'image_1920') => {
    const baseUrl = import.meta.env.VITE_ODOO_BASE_URL || 'https://tu-odoo.com';
    return `${baseUrl}/web/image?model=${model}&id=${id}&field=${field}`;
};
