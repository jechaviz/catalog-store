# Arquitectura y Diseño Técnico: Natura Catálogo Generator

Este documento detalla las técnicas, decisiones arquitectónicas y soluciones de ingeniería aplicadas en el desarrollo de este catálogo digital de alta gama.

---

## 1. Stack Tecnológico

El proyecto utiliza un stack moderno enfocado en el rendimiento, la estética y la agilidad:

- **Frontend:** [React](https://reactjs.org/) + [Vite](https://vitejs.dev/) (Velocidad de desarrollo instantánea).
- **Estilos:** [Tailwind CSS v4](https://tailwindcss.com/) (Control granular y moderno de UI).
- **Routing:** [wouter](https://github.com/molecula-js/wouter) (Enrutador minimalista de alto rendimiento).
- **Backend (BaaS):** [PocketBase](https://pocketbase.io/) (Base de datos real, Auth y almacenamiento de archivos).
- **Generación de PDF:** [jspdf](https://github.com/parallax/jsPDF) + [html2canvas](https://html2canvas.hertzen.com/).
- **Iconografía:** [Lucide React](https://lucide.dev/) (Iconos minimalistas).

---

## 2. Sistema de Diseño Orgánico y Dinámico

### Extracción de Color en Tiempo Real (`useColorExtraction`)
A diferencia de los sitios estáticos, esta aplicación "cobra vida" basándose en el producto que el usuario está viendo.
- **Técnica:** Se utiliza un hook personalizado que dibuja la imagen del producto en un `canvas` oculto de 150x150px.
- **Algoritmo de Pesado:** No solo busca el color más frecuente, sino que aplica un **peso dinámico**. Los colores saturados y vibrantes (como el dorado Natura o el verde bosque) tienen un valor 5x mayor que los tonos neutros o blancos.
- **Generación de Paleta:** A partir del color extraído, calculamos colores **Análogos** y **Sombras (Shades)** mediante transformaciones HSL. Esto garantiza que el fondo siempre combine con el producto sin intervención manual.

### Estética Premium y Glassmorphism
- **Capas de Profundidad:** Se utilizan elementos decorativos SVG generados dinámicamente (`Blobs`) con opacidades bajas y animaciones de flotado (`animate-float`).
- **Cristalismo:** Los contenedores principales utilizan `backdrop-blur` y bordes sutiles con colores análogos, creando una sensación de ligereza y modernidad.

---

## 3. Soluciones de Ingeniería Críticas

### Aislamiento de PDF vía Iframe (Solución al error oklch)
Uno de los retos técnicos más importantes fue la compatibilidad de **Tailwind v4** con la generación de PDF.
- **El Problema:** Tailwind v4 utiliza el formato de color `oklch` por defecto. La librería `html2canvas` falla al intentar parsear este formato moderno en los estilos computados globales.
- **La Solución Técnica:** Implementamos un **Aislamiento por Iframe**. Para generar el PDF, creamos un iframe oculto con un entorno CSS "limpio" y colores HEX estándar.
  - El diseño del catálogo se renderiza dentro de este iframe, lejos de los estilos globales de la aplicación.
  - Esto garantiza que el motor de captura de PDF sea 100% estable, independientemente de las actualizaciones de CSS modernas de la web.

### Optimización de Recursos
- **Carga de Imágenes:** Para evitar bloqueos de CORS en el PDF, las imágenes se convierten a **Base64** mediante `fetch` antes de ser inyectadas en el proceso de captura.
- **Limpieza de Memoria:** Durante la generación de un catálogo de 100+ productos, cada página se limpia del DOM (o iframe) inmediatamente después de ser capturada para evitar fugas de memoria en el navegador.

---

## 4. Flujo de Datos y Estado

La aplicación utiliza **React Context** para una gestión de estado centralizada y reactiva:

1.  **AuthContext:** Gestiona la sesión del usuario con PocketBase (Google OAuth2).
2.  **CartContext:** Maneja el carrito de compras, persistencia en `localStorage` y efectos visuales de "Vistazo Rápido" (Peek Drawer).
3.  **ThemeContext:** Permite cambiar entre temas dinámicos (Femenino, Masculino, Unisex) cambiando variables CSS globales a nivel de root.

---

## 5. Integración con WhatsApp (E-Commerce Híbrido)

Aunque contamos con un backend para persistir pedidos, el cierre de venta se realiza vía WhatsApp para:
- **Cercanía:** Facilita la comunicación directa entre consultor y cliente.
- **Conversión:** Elimina las barreras de formularios de pago complejos en una fase inicial.
- **Trazabilidad:** Enviamos un enlace con el **ID de Pedido** generado en PocketBase, permitiendo al administrador rastrear la venta física contra el registro digital.

---

*Desarrollado con enfoque en Excelencia Visual y Estabilidad Técnica.*
