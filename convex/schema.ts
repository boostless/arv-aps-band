import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { unitFields } from "./schemas/units"; // Importing unitFields from units.ts
import { productFields } from './schemas/products';
import { warehouseFields } from "./schemas/warehouses";
import { stockFields } from "./schemas/stock";
import { stockLogFields } from "./schemas/stockLogs";
import { settingsFields } from "./schemas/settings";
import { customerFields } from "./schemas/customers";
import { orderFields, orderItemFields } from "./schemas/orders";
import { paymentFields } from "./schemas/payments";
import { invoiceFields } from "./schemas/invoices";

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
    business_settings: defineTable(settingsFields),
    customers: defineTable(customerFields)
        .index("by_code", ["code"]), // Unique constraint check
    orders: defineTable(orderFields)
        .index("by_customer", ["customer"])
        .index("by_contract", ["contract_number"])
        .index("by_status", ["status"]),
    order_items: defineTable(orderItemFields)
        .index("by_order", ["order_id"])      // "Get all items for this order"
        .index("by_product", ["product"]),    // "How many times was this rented?"
    payments: defineTable(paymentFields)
        .index("by_invoice", ["invoice_id"]),
    invoices: defineTable(invoiceFields)
        .index("by_order", ["order_id"])
        .index("by_number", ["invoice_number"]),
});