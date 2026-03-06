import { gql } from '@apollo/client';

/**
 * Fragmento de Producto basado en el modelo de Vue Storefront Odoo
 */
export const PRODUCT_FRAGMENT = gql`
  fragment ProductFields on Product {
    id
    name
    description
    image
    price {
      regular
      special
    }
    sku
    isInStock
    # Agrega aquí campos personalizados si el módulo Odoo los soporta
    # brands { name }
    # gender
  }
`;

/**
 * Consulta para obtener todos los productos del catálogo
 */
export const GET_PRODUCTS = gql`
  query GetProducts($search: String, $pageSize: Int, $currentPage: Int) {
    products(search: $search, pageSize: $pageSize, currentPage: $currentPage) {
      products {
        ...ProductFields
      }
      totalCount
    }
  }
  ${PRODUCT_FRAGMENT}
`;

/**
 * Consulta para obtener categorías de Odoo
 */
export const GET_CATEGORIES = gql`
  query GetCategories {
    categories {
      categories {
        id
        name
        slug
        child_id {
          id
          name
        }
      }
    }
  }
`;

/**
 * Mutación para crear un pedido en Odoo (Sale Order)
 * Nota: El esquema exacto depende de la implementación del módulo GraphQL en Odoo.
 */
export const CREATE_ORDER = gql`
  mutation CreateOrder($customerName: String!, $customerPhone: String!, $customerAddress: String!, $items: [OrderItemInput]!) {
    createOrder(input: {
      customerName: $customerName,
      customerPhone: $customerPhone,
      customerAddress: $customerAddress,
      items: $items
    }) {
      order {
        id
        name
      }
    }
  }
`;
