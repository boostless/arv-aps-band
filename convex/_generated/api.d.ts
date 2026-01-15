/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as customers from "../customers.js";
import type * as dashboard from "../dashboard.js";
import type * as invoices from "../invoices.js";
import type * as orders from "../orders.js";
import type * as payments from "../payments.js";
import type * as products from "../products.js";
import type * as schemas_customers from "../schemas/customers.js";
import type * as schemas_invoices from "../schemas/invoices.js";
import type * as schemas_orders from "../schemas/orders.js";
import type * as schemas_payments from "../schemas/payments.js";
import type * as schemas_products from "../schemas/products.js";
import type * as schemas_settings from "../schemas/settings.js";
import type * as schemas_stock from "../schemas/stock.js";
import type * as schemas_stockLogs from "../schemas/stockLogs.js";
import type * as schemas_units from "../schemas/units.js";
import type * as schemas_warehouses from "../schemas/warehouses.js";
import type * as settings from "../settings.js";
import type * as stock from "../stock.js";
import type * as units from "../units.js";
import type * as warehouses from "../warehouses.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  customers: typeof customers;
  dashboard: typeof dashboard;
  invoices: typeof invoices;
  orders: typeof orders;
  payments: typeof payments;
  products: typeof products;
  "schemas/customers": typeof schemas_customers;
  "schemas/invoices": typeof schemas_invoices;
  "schemas/orders": typeof schemas_orders;
  "schemas/payments": typeof schemas_payments;
  "schemas/products": typeof schemas_products;
  "schemas/settings": typeof schemas_settings;
  "schemas/stock": typeof schemas_stock;
  "schemas/stockLogs": typeof schemas_stockLogs;
  "schemas/units": typeof schemas_units;
  "schemas/warehouses": typeof schemas_warehouses;
  settings: typeof settings;
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
