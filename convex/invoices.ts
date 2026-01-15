// convex/invoices.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// Helper to get next number
async function getNextInvoiceNumber(ctx: any) {
    const settings = await ctx.db.query("business_settings").first();
    if (!settings) throw new Error("Business Settings missing.");

    const num = settings.invoice_start_number || 1000;
    await ctx.db.patch(settings._id, { invoice_start_number: num + 1 });
    return num;
}

// ✅ SHARED LOGIC: Can be called by UI (create) or Backend (complete)
export async function generateInvoiceInternal(ctx: any, orderId: Id<"orders">, startDate: number, endDate: number) {
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");

    const settings = await ctx.db.query("business_settings").first();
    const taxRate = settings?.tax_rate || 21;
    const dueDays = settings?.invoice_due_days || 14;

    const items = await ctx.db
        .query("order_items")
        .withIndex("by_order", (q: any) => q.eq("order_id", orderId))
        .collect();

    let grandTotalExclTax = 0;
    const oneDayMs = 1000 * 60 * 60 * 24;

    // Normalize dates to midnight
    const start = new Date(startDate).setHours(0, 0, 0, 0);
    const end = new Date(endDate).setHours(0, 0, 0, 0);

    // Calculate Costs
    for (const item of items) {
        // Fixed Items (Sales/Services) - Bill once if period covers start date
        if (item.product_type !== 'product' || order.type === 'sale') {
            if (start <= order.start_date && end >= order.start_date) {
                const itemTotal = item.quantity * item.price * (1 - (item.discount / 100));
                grandTotalExclTax += itemTotal;
            }
            continue;
        }

        // Rental Items - Daily Calculation
        let itemPeriodCost = 0;
        for (let d = start; d <= end; d += oneDayMs) {
            const returnsBeforeToday = (item.return_history || [])
                .filter((ret: { date: number; qty: number }) => ret.date < d)
                .reduce((sum: number, ret: { date: number; qty: number }) => sum + ret.qty, 0);

            const activeQty = Math.max(0, item.quantity - returnsBeforeToday);

            if (activeQty > 0) {
                const dailyRate = item.price * (1 - (item.discount / 100));
                itemPeriodCost += activeQty * dailyRate;
            }
        }
        grandTotalExclTax += itemPeriodCost;
    }

    const taxAmount = grandTotalExclTax * (taxRate / 100);
    const totalAmount = grandTotalExclTax + taxAmount;

    // If nothing to bill, return null (don't error, just skip)
    if (totalAmount <= 0) return null;

    // Create Invoice
    const invoiceNum = await getNextInvoiceNumber(ctx);
    const dueDate = Date.now() + (dueDays * oneDayMs);

    const invoiceId = await ctx.db.insert("invoices", {
        order_id: orderId,
        invoice_number: invoiceNum,
        start_date: startDate,
        end_date: endDate,
        due_date: dueDate,
        amount: Math.round(totalAmount),
        tax_amount: Math.round(taxAmount),
        status: 'unpaid',
    });

    return invoiceId;
}

// -- MUTATIONS --

export const create = mutation({
    args: {
        order_id: v.id("orders"),
        start_date: v.number(),
        end_date: v.number(),
    },
    handler: async (ctx, args) => {
        const id = await generateInvoiceInternal(ctx, args.order_id, args.start_date, args.end_date);
        if (!id) throw new Error("Invoice amount is 0. Nothing to bill for this period.");
        return id;
    }
});

// GET INVOICE WITH PAYMENTS
export const get = query({
    args: { id: v.id("invoices") },
    handler: async (ctx, args) => {
        const invoice = await ctx.db.get(args.id);
        if (!invoice) return null;

        // 1. Fetch Payments
        const payments = await ctx.db
            .query("payments")
            .withIndex("by_invoice", q => q.eq("invoice_id", args.id))
            .collect();

        const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);

        // 2. Fetch Business Settings (For the "From" section)
        const settings = await ctx.db.query("business_settings").first();

        // 3. Fetch Customer via the Order (For the "Bill To" section)
        const order = await ctx.db.get(invoice.order_id);
        let customer = null;
        if (order) {
            customer = await ctx.db.get(order.customer);
        }

        return {
            ...invoice,
            payments,
            paidAmount,
            settings, // <--- Now available in frontend
            customer  // <--- Now available in frontend
        };
    }
});

export const list = query({
    args: {},
    handler: async (ctx) => {
        // 1. Get all invoices (Newest first)
        const invoices = await ctx.db.query("invoices").order("desc").collect();

        // 2. Join Customer & Payment Data
        const invoicesWithDetails = await Promise.all(
            invoices.map(async (inv) => {
                // Get Order -> Customer
                const order = await ctx.db.get(inv.order_id);
                const customer = order ? await ctx.db.get(order.customer) : null;

                // Get Payments (to verify "Paid" status accurately)
                const payments = await ctx.db
                    .query("payments")
                    .withIndex("by_invoice", (q) => q.eq("invoice_id", inv._id))
                    .collect();

                const paid = payments.reduce((sum, p) => sum + p.amount, 0);

                return {
                    ...inv,
                    customerName: customer?.label || "Unknown Customer",
                    paidAmount: paid,
                    remainingAmount: inv.amount - paid,
                    isOverdue: inv.status === 'unpaid' && Date.now() > inv.end_date
                };
            })
        );

        return invoicesWithDetails;
    },
});