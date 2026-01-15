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

        const ordersWithNames = await Promise.all(
            activeOrders.map(async (o) => {
                const customer = await ctx.db.get(o.customer);
                return {
                    ...o,
                    customerName: customer?.label || "Unknown"
                };
            })
        );

        // 2. GET UNPAID INVOICES (Limit 5, Oldest Due Date first)
        // Note: Ideally, add an index on 'status' or compound 'status, end_date'. 
        // For MVP, filtering is fine.
        const allInvoices = await ctx.db.query("invoices").collect();

        const unpaidInvoicesRaw = allInvoices
            .filter(i => i.status === 'unpaid')
            .sort((a, b) => a.end_date - b.end_date) // Oldest dates (overdue) first
            .slice(0, 5);

        const unpaidInvoices = await Promise.all(
            unpaidInvoicesRaw.map(async (inv) => {
                // Get Customer Name (via Order)
                const order = await ctx.db.get(inv.order_id);
                const customer = order ? await ctx.db.get(order.customer) : null;

                // Get Balance
                const payments = await ctx.db
                    .query("payments")
                    .withIndex("by_invoice", q => q.eq("invoice_id", inv._id))
                    .collect();
                const paid = payments.reduce((sum, p) => sum + p.amount, 0);

                return {
                    ...inv,
                    customerName: customer?.label || "Unknown",
                    remainingAmount: inv.amount - paid,
                    isOverdue: Date.now() > inv.end_date
                };
            })
        );

        // 3. GET RECENT LOGS (Limit 10)
        const logs = await ctx.db
            .query("stock_logs")
            .order("desc")
            .take(10);

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
            recentLogs: logsWithDetails,
            unpaidInvoices: unpaidInvoices // <--- New Data
        };
    },
});