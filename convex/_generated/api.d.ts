/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as products from "../products.js";
import type * as schemas_products from "../schemas/products.js";
import type * as schemas_stock from "../schemas/stock.js";
import type * as schemas_stockLogs from "../schemas/stockLogs.js";
import type * as schemas_units from "../schemas/units.js";
import type * as schemas_warehouses from "../schemas/warehouses.js";
import type * as stock from "../stock.js";
import type * as units from "../units.js";
import type * as warehouses from "../warehouses.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  products: typeof products;
  "schemas/products": typeof schemas_products;
  "schemas/stock": typeof schemas_stock;
  "schemas/stockLogs": typeof schemas_stockLogs;
  "schemas/units": typeof schemas_units;
  "schemas/warehouses": typeof schemas_warehouses;
  stock: typeof stock;
  units: typeof units;
  warehouses: typeof warehouses;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
