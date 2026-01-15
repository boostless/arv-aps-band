// convex/dashboard.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getStats = query({
    args: {},
    handler: async (ctx) => {
        // 1. GET ACTIVE ORDERS (Limit 5)
        const activeOrders = await ctx.db
            .query("orders")
            .withIndex("by_status", (q) => q.eq("status", "active"))
            .order("desc")
            .take(5);

        // Join Customer Name
        const ordersWithNames = await Promise.all(
            activeOrders.map(async (o) => {
                const customer = await ctx.db.get(o.customer);
                return {
                    ...o,
                    customerName: customer?.label || "Unknown"
                };
            })
        );

        // 2. GET RECENT LOGS (Limit 10)
        // We fetch the most recent stock movements
        const logs = await ctx.db
            .query("stock_logs")
            .order("desc") // Newest first
            .take(10);

        // Join Product & Warehouse Names
        const logsWithDetails = await Promise.all(
            logs.map(async (log) => {
                const product = await ctx.db.get(log.product);
                const warehouse = await ctx.db.get(log.warehouse);
                return {
                    ...log,
                    productName: product?.label || "Unknown",
                    warehouseCode: warehouse?.code || "WH-?",
                };
            })
        );

        return {
            activeOrders: ordersWithNames,
            recentLogs: logsWithDetails
        };
    },
});