import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { unitFields } from "./schemas/units"; // Importing unitFields from units.ts
import { productFields } from './schemas/products';
import { warehouseFields } from "./schemas/warehouses";
import { stockFields } from "./schemas/stock";
import { stockLogFields } from "./schemas/stockLogs";

export default defineSchema({
    products: defineTable(productFields)
        .index("by_code", ["code"]),
    units: defineTable(unitFields)
        .index("by_code", ["code"]), // <--- Critical for uniqueness checks
    warehouses: defineTable(warehouseFields)
        .index("by_code", ["code"]),
    stock: defineTable(stockFields)
        .index("by_product_warehouse", ["product", "warehouse"])
        .index("by_warehouse", ["warehouse"])
        .index("by_product", ["product"]),
    stock_logs: defineTable(stockLogFields)
        .index("by_product", ["product"])      // "Show history for this item"
        .index("by_warehouse", ["warehouse"])  // "Show activity in this warehouse"
        .index("by_type", ["type"]),           // "Show all sales"
});