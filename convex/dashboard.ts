// convex/dashboard.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getStats = query({
    args: {},
    handler: async (ctx) => {
        // 1. ACTIVE ORDERS (Existing logic)
        const activeOrders = await ctx.db
            .query("orders")
            .withIndex("by_status", (q) => q.eq("status", "active"))
            .order("desc")
            .take(5);

        const ordersWithNames = await Promise.all(
            activeOrders.map(async (o) => {
                const customer = await ctx.db.get(o.customer);
                return { ...o, customerName: customer?.label || "Unknown" };
            })
        );

        // 2. UNPAID INVOICES (Existing logic)
        const allInvoices = await ctx.db.query("invoices").collect();
        const unpaidInvoicesRaw = allInvoices
            .filter(i => i.status === 'unpaid')
            .sort((a, b) => a.end_date - b.end_date)
            .slice(0, 5);

        const unpaidInvoices = await Promise.all(
            unpaidInvoicesRaw.map(async (inv) => {
                const payments = await ctx.db
                    .query("payments")
                    .withIndex("by_invoice", q => q.eq("invoice_id", inv._id))
                    .collect();
                const paid = payments.reduce((sum, p) => sum + p.amount, 0);
                return {
                    ...inv,
                    remainingAmount: inv.amount - paid,
                    isOverdue: Date.now() > (inv.due_date || inv.end_date)
                };
            })
        );

        // 3. MERGED ACTIVITY LOGS (Stock + Financials)

        // A. Fetch Stock Logs
        const stockLogs = await ctx.db.query("stock_logs").order("desc").take(10);
        const enrichedStockLogs = await Promise.all(stockLogs.map(async (l) => {
            const p = await ctx.db.get(l.product);
            const w = await ctx.db.get(l.warehouse);
            return {
                _id: l._id,
                time: l._creationTime,
                type: l.type, // 'sale', 'return', etc.
                primary_text: p?.label || 'Unknown Product',
                secondary_text: w?.code || 'WH',
                value_text: l.delta > 0 ? `+${l.delta}` : `${l.delta}`,
                ref_id: l.reference_id,
                category: 'stock'
            };
        }));

        // B. Fetch Recent Invoices (Created)
        const recentInvoices = await ctx.db.query("invoices").order("desc").take(5);
        const formattedInvoices = recentInvoices.map(inv => ({
            _id: inv._id,
            time: inv._creationTime,
            type: 'invoice_created',
            primary_text: `Invoice #${inv.invoice_number}`,
            secondary_text: inv.customer_name || 'Customer',
            value_text: `€${(inv.amount / 100).toFixed(2)}`,
            ref_id: inv.created_by,
            category: 'finance'
        }));

        // C. Fetch Recent Payments
        const recentPayments = await ctx.db.query("payments").order("desc").take(5);
        const formattedPayments = recentPayments.map(pay => ({
            _id: pay._id,
            time: pay._creationTime, // Using creation time for "Activity Feed"
            type: 'payment_received',
            primary_text: `Payment (${pay.method})`,
            secondary_text: pay.notes || 'No notes',
            value_text: `+€${(pay.amount / 100).toFixed(2)}`,
            ref_id: '',
            category: 'finance'
        }));

        // D. Merge & Sort
        const mergedActivity = [...enrichedStockLogs, ...formattedInvoices, ...formattedPayments]
            .sort((a, b) => b.time - a.time) // Newest first
            .slice(0, 15); // Show top 15

        return {
            activeOrders: ordersWithNames,
            unpaidInvoices: unpaidInvoices,
            recentLogs: mergedActivity // <--- Unified Feed
        };
    },
});