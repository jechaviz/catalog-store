import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import {
  normalizeCustomerScopeId,
  type CustomerCartItem,
  type CustomerOrderRecord,
  type CustomerStateResourceKey,
} from "../shared/customerState";
import {
  normalizeStorefrontBrand,
  type LocalCatalogOverrides,
  type LocalCategoryOverrides,
  type StorefrontSettings,
} from "../shared/storefrontState";
import {
  readCustomerStateSnapshot,
  saveCustomerCart,
  saveCustomerLikes,
  saveCustomerOrders,
} from "./customerStateStore";
import {
  readStorefrontSnapshot,
  saveCategoryOverrides,
  saveProductOverrides,
  saveStorefrontSettings,
} from "./storefrontStateStore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ACTIVE_STOREFRONT_BRAND = "natura" as const;

function getApiBrand(req: Request, res: Response) {
  const queryBrand =
    typeof req.query.brand === "string" ? req.query.brand : Array.isArray(req.query.brand)
      ? req.query.brand[0]
      : undefined;
  const brand = normalizeStorefrontBrand(req.params.brand || queryBrand);

  if (!brand || brand !== ACTIVE_STOREFRONT_BRAND) {
    res.status(400).json({
      error: "Invalid brand. Use 'natura'.",
    });
    return null;
  }

  return brand;
}

function getApiScopeId(req: Request, res: Response) {
  const queryScope =
    typeof req.query.scopeId === "string"
      ? req.query.scopeId
      : Array.isArray(req.query.scopeId)
        ? req.query.scopeId[0]
        : typeof req.query.scope === "string"
          ? req.query.scope
          : Array.isArray(req.query.scope)
            ? req.query.scope[0]
            : typeof req.query.userId === "string"
              ? req.query.userId
              : Array.isArray(req.query.userId)
                ? req.query.userId[0]
                : undefined;
  const scopeId = normalizeCustomerScopeId(req.params.scopeId || queryScope);

  if (!scopeId) {
    res.status(400).json({
      error: "Invalid scope id.",
    });
    return null;
  }

  return scopeId;
}

function getApiCustomerResource(
  req: Request,
  res: Response,
): CustomerStateResourceKey | null {
  const resourceQueryValue = req.query.resource;
  const queryResource =
    typeof resourceQueryValue === "string"
      ? resourceQueryValue
      : Array.isArray(resourceQueryValue) && typeof resourceQueryValue[0] === "string"
        ? resourceQueryValue[0]
        : undefined;
  const rawResource =
    typeof req.params.resource === "string" ? req.params.resource : queryResource;

  if (!rawResource) {
    return null;
  }

  const resource = rawResource.trim().toLowerCase();

  if (resource === "orders" || resource === "likes" || resource === "cart") {
    return resource;
  }

  res.status(400).json({
    error: "Invalid customer state resource. Use 'orders', 'likes', or 'cart'.",
  });
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasAnyKey(value: unknown, keys: string[]) {
  return isRecord(value) && keys.some((key) => key in value);
}

function getRequestedResource(req: Request) {
  const explicitResource =
    typeof req.query.resource === "string" ? req.query.resource.trim().toLowerCase() : "";

  if (explicitResource) {
    return explicitResource;
  }

  if (req.path.includes("storefront-settings")) {
    return "storefront-settings";
  }

  if (req.path.includes("catalog-state")) {
    return "catalog-admin";
  }

  return "";
}

function unwrapSettingsPayload(body: unknown): Partial<StorefrontSettings> | null {
  if (hasAnyKey(body, ["siteName", "slogan", "sellerPhone"])) {
    return body as Partial<StorefrontSettings>;
  }

  if (!isRecord(body)) {
    return null;
  }

  const directCandidates = [
    body.settings,
    body.storefrontSettings,
    body.payload,
    body.data,
    body.value,
    body.snapshot,
  ];

  for (const candidate of directCandidates) {
    const payload = unwrapSettingsPayload(candidate);

    if (payload) {
      return payload;
    }
  }

  return null;
}

function unwrapCategoryPayload(body: unknown): Partial<LocalCategoryOverrides> | null {
  if (Array.isArray(body)) {
    return { categories: body };
  }

  if (!isRecord(body)) {
    return null;
  }

  const directCandidates = [
    body.categoryOverrides,
    body.localCategoryOverrides,
  ];

  for (const candidate of directCandidates) {
    if (Array.isArray(candidate) || isRecord(candidate)) {
      return unwrapCategoryPayload(candidate);
    }
  }

  const nestedCandidates = [body.payload, body.data, body.value, body.snapshot];

  for (const candidate of nestedCandidates) {
    const payload = unwrapCategoryPayload(candidate);

    if (payload) {
      return payload;
    }
  }

  if (
    hasAnyKey(body, [
      "categories",
      "deletedCategoryIds",
      "metadataById",
      "localCategories",
      "customCategories",
      "items",
      "list",
    ])
  ) {
    return body as Partial<LocalCategoryOverrides>;
  }

  return null;
}

function unwrapProductPayload(body: unknown): Partial<LocalCatalogOverrides> | null {
  if (Array.isArray(body)) {
    return { products: body };
  }

  if (!isRecord(body)) {
    return null;
  }

  const directCandidates = [
    body.productOverrides,
    body.localProductOverrides,
  ];

  for (const candidate of directCandidates) {
    if (Array.isArray(candidate) || isRecord(candidate)) {
      return unwrapProductPayload(candidate);
    }
  }

  const nestedCandidates = [body.payload, body.data, body.value, body.snapshot];

  for (const candidate of nestedCandidates) {
    const payload = unwrapProductPayload(candidate);

    if (payload) {
      return payload;
    }
  }

  if (
    hasAnyKey(body, [
      "products",
      "deletedProductIds",
      "localProducts",
      "customProducts",
      "items",
      "overrides",
    ])
  ) {
    return body as Partial<LocalCatalogOverrides>;
  }

  return null;
}

function unwrapOrdersPayload(body: unknown): CustomerOrderRecord[] | null {
  if (Array.isArray(body)) {
    return body as CustomerOrderRecord[];
  }

  if (!isRecord(body)) {
    return null;
  }

  const directCandidates = [body.orders, body.orderHistory];

  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) {
      return candidate as CustomerOrderRecord[];
    }
  }

  const nestedCandidates = [body.payload, body.data, body.value, body.snapshot];

  for (const candidate of nestedCandidates) {
    const payload = unwrapOrdersPayload(candidate);

    if (payload) {
      return payload;
    }
  }

  return null;
}

function unwrapLikesPayload(body: unknown): string[] | null {
  if (Array.isArray(body)) {
    return body as string[];
  }

  if (!isRecord(body)) {
    return null;
  }

  const directCandidates = [body.likes, body.favoriteIds, body.ids];

  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) {
      return candidate as string[];
    }
  }

  const nestedCandidates = [body.payload, body.data, body.value, body.snapshot];

  for (const candidate of nestedCandidates) {
    const payload = unwrapLikesPayload(candidate);

    if (payload) {
      return payload;
    }
  }

  return null;
}

function unwrapCartPayload(body: unknown): CustomerCartItem[] | null {
  if (Array.isArray(body)) {
    return body as CustomerCartItem[];
  }

  if (!isRecord(body)) {
    return null;
  }

  const directCandidates = [body.cart, body.items, body.cartItems];

  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) {
      return candidate as CustomerCartItem[];
    }
  }

  const nestedCandidates = [body.payload, body.data, body.value, body.snapshot];

  for (const candidate of nestedCandidates) {
    const payload = unwrapCartPayload(candidate);

    if (payload) {
      return payload;
    }
  }

  return null;
}

function buildSettingsResponse(
  snapshot: Awaited<ReturnType<typeof readStorefrontSnapshot>>,
) {
  return {
    brand: snapshot.brand,
    settings: snapshot.settings,
    updatedAt: snapshot.updatedAt,
  };
}

function buildCatalogResponse(
  snapshot: Awaited<ReturnType<typeof readStorefrontSnapshot>>,
) {
  return {
    brand: snapshot.brand,
    categoryOverrides: snapshot.categoryOverrides,
    productOverrides: snapshot.productOverrides,
    updatedAt: snapshot.updatedAt,
  };
}

function buildCustomerSnapshotResponse(
  snapshot: Awaited<ReturnType<typeof readCustomerStateSnapshot>>,
) {
  return {
    brand: snapshot.brand,
    scopeId: snapshot.scopeId,
    orders: snapshot.orders,
    likes: snapshot.likes,
    cart: snapshot.cart,
    updatedAt: snapshot.updatedAt,
    resourceMeta: snapshot.resourceMeta,
  };
}

function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "1mb" }));

  const sendStorefrontSnapshot = asyncRoute(async (req, res) => {
    const brand = getApiBrand(req, res);

    if (!brand) {
      return;
    }

    res.json(await readStorefrontSnapshot(brand));
  });

  app.get("/api/storefront-state/:brand", sendStorefrontSnapshot);
  app.get("/api/storefront-state", sendStorefrontSnapshot);
  app.get("/api/storefront/:brand/snapshot", sendStorefrontSnapshot);

  const sendCustomerSnapshot = asyncRoute(async (req, res) => {
    const brand = getApiBrand(req, res);
    const scopeId = getApiScopeId(req, res);

    if (!brand || !scopeId) {
      return;
    }

    res.json(buildCustomerSnapshotResponse(await readCustomerStateSnapshot(brand, scopeId)));
  });

  app.get("/api/customer-state/:brand/:scopeId", sendCustomerSnapshot);
  app.get("/api/customer-state/:brand", sendCustomerSnapshot);
  app.get("/api/customer-state", sendCustomerSnapshot);

  const persistSettings = asyncRoute(async (req, res) => {
    const brand = getApiBrand(req, res);

    if (!brand) {
      return;
    }

    const payload = unwrapSettingsPayload(req.body);

    if (!payload) {
      res.status(400).json({
        error: "Settings payload must be a JSON object.",
      });
      return;
    }

    res.json(await saveStorefrontSettings(brand, payload));
  });

  const persistCategories = asyncRoute(async (req, res) => {
    const brand = getApiBrand(req, res);

    if (!brand) {
      return;
    }

    const payload = unwrapCategoryPayload(req.body);

    if (!payload) {
      res.status(400).json({
        error: "Category overrides payload must be a JSON object or array.",
      });
      return;
    }

    res.json(await saveCategoryOverrides(brand, payload));
  });

  const persistProducts = asyncRoute(async (req, res) => {
    const brand = getApiBrand(req, res);

    if (!brand) {
      return;
    }

    const payload = unwrapProductPayload(req.body);

    if (!payload) {
      res.status(400).json({
        error: "Product overrides payload must be a JSON object or array.",
      });
      return;
    }

    res.json(await saveProductOverrides(brand, payload));
  });

  app.put("/api/storefront-state/:brand/settings", persistSettings);
  app.post("/api/storefront-state/:brand/settings", persistSettings);
  app.put("/api/storefront-state/:brand/categories", persistCategories);
  app.post("/api/storefront-state/:brand/categories", persistCategories);
  app.put("/api/storefront-state/:brand/products", persistProducts);
  app.post("/api/storefront-state/:brand/products", persistProducts);

  const persistCustomerOrdersImpl = async (req: Request, res: Response) => {
    const brand = getApiBrand(req, res);
    const scopeId = getApiScopeId(req, res);

    if (!brand || !scopeId) {
      return;
    }

    const payload = unwrapOrdersPayload(req.body);

    if (!payload) {
      res.status(400).json({
        error: "Orders payload must be a JSON array or wrapped orders collection.",
      });
      return;
    }

    res.json(buildCustomerSnapshotResponse(await saveCustomerOrders(brand, scopeId, payload)));
  };

  const persistCustomerLikesImpl = async (req: Request, res: Response) => {
    const brand = getApiBrand(req, res);
    const scopeId = getApiScopeId(req, res);

    if (!brand || !scopeId) {
      return;
    }

    const payload = unwrapLikesPayload(req.body);

    if (!payload) {
      res.status(400).json({
        error: "Likes payload must be a JSON array or wrapped likes collection.",
      });
      return;
    }

    res.json(buildCustomerSnapshotResponse(await saveCustomerLikes(brand, scopeId, payload)));
  };

  const persistCustomerCartImpl = async (req: Request, res: Response) => {
    const brand = getApiBrand(req, res);
    const scopeId = getApiScopeId(req, res);

    if (!brand || !scopeId) {
      return;
    }

    const payload = unwrapCartPayload(req.body);

    if (!payload) {
      res.status(400).json({
        error: "Cart payload must be a JSON array or wrapped cart collection.",
      });
      return;
    }

    res.json(buildCustomerSnapshotResponse(await saveCustomerCart(brand, scopeId, payload)));
  };

  const persistCustomerOrders = asyncRoute(persistCustomerOrdersImpl);
  const persistCustomerLikes = asyncRoute(persistCustomerLikesImpl);
  const persistCustomerCart = asyncRoute(persistCustomerCartImpl);
  const persistCustomerResource = asyncRoute(async (req, res) => {
    const resource = getApiCustomerResource(req, res);

    if (res.headersSent) {
      return;
    }

    if (!resource) {
      res.status(400).json({
        error: "Customer state resource is required.",
      });
      return;
    }

    switch (resource) {
      case "orders":
        await persistCustomerOrdersImpl(req, res);
        return;
      case "likes":
        await persistCustomerLikesImpl(req, res);
        return;
      case "cart":
        await persistCustomerCartImpl(req, res);
        return;
      default:
        res.status(400).json({
          error: "Unsupported customer state resource.",
        });
    }
  });

  app.put("/api/customer-state/:brand/:scopeId/orders", persistCustomerOrders);
  app.post("/api/customer-state/:brand/:scopeId/orders", persistCustomerOrders);
  app.put("/api/customer-state/:brand/:scopeId/likes", persistCustomerLikes);
  app.post("/api/customer-state/:brand/:scopeId/likes", persistCustomerLikes);
  app.put("/api/customer-state/:brand/:scopeId/cart", persistCustomerCart);
  app.post("/api/customer-state/:brand/:scopeId/cart", persistCustomerCart);
  app.put("/api/customer-state/:brand/:resource", persistCustomerResource);
  app.post("/api/customer-state/:brand/:resource", persistCustomerResource);
  app.put("/api/customer-state/:brand", persistCustomerResource);
  app.post("/api/customer-state/:brand", persistCustomerResource);
  app.put("/api/customer-state", persistCustomerResource);
  app.post("/api/customer-state", persistCustomerResource);

  const adminPersistencePaths: string[] = [
    "/api/admin/persistence",
    "/api/admin/shared-state",
    "/api/admin/storefront-settings",
    "/api/admin/catalog-state",
  ];

  const readAdminPersistence = asyncRoute(async (req, res) => {
    const brand = getApiBrand(req, res);

    if (!brand) {
      return;
    }

    const snapshot = await readStorefrontSnapshot(brand);
    const resource = getRequestedResource(req);

    if (resource === "storefront-settings") {
      res.json(buildSettingsResponse(snapshot));
      return;
    }

    if (resource === "catalog-admin") {
      res.json(buildCatalogResponse(snapshot));
      return;
    }

    res.json(snapshot);
  });

  const writeAdminPersistence = asyncRoute(async (req, res) => {
    const brand = getApiBrand(req, res);

    if (!brand) {
      return;
    }

    const resource = getRequestedResource(req);

    if (resource === "storefront-settings") {
      const payload = unwrapSettingsPayload(req.body);

      if (!payload) {
        res.status(400).json({
          error: "Settings payload must be a JSON object.",
        });
        return;
      }

      res.json(buildSettingsResponse(await saveStorefrontSettings(brand, payload)));
      return;
    }

    if (resource === "catalog-admin") {
      const categoryPayload = unwrapCategoryPayload(req.body);
      const productPayload = unwrapProductPayload(req.body);

      if (!categoryPayload && !productPayload) {
        res.status(400).json({
          error:
            "Catalog admin payload must include product or category overrides.",
        });
        return;
      }

      let snapshot = await readStorefrontSnapshot(brand);

      if (categoryPayload) {
        snapshot = await saveCategoryOverrides(brand, categoryPayload);
      }

      if (productPayload) {
        snapshot = await saveProductOverrides(brand, productPayload);
      }

      res.json(buildCatalogResponse(snapshot));
      return;
    }

    res.status(400).json({
      error: "Unsupported admin persistence resource.",
    });
  });

  app.get(adminPersistencePaths, readAdminPersistence);
  app.put(adminPersistencePaths, writeAdminPersistence);
  app.post(adminPersistencePaths, writeAdminPersistence);

  app.use(
    (
      error: Error & { status?: number; type?: string },
      _req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      if (error.type === "entity.parse.failed") {
        res.status(400).json({
          error: "Invalid JSON body.",
        });
        return;
      }

      next(error);
    },
  );

  app.use("/api", (_req, res) => {
    res.status(404).json({
      error: "API route not found.",
    });
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
