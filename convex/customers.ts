import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { customerFields } from "./schemas/customers";

// 1. LIST
export const list = query({
    args: { showArchived: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const customers = await ctx.db.query("customers").collect();
        return customers.filter(c => args.showArchived ? true : !c.archived);
    },
});

// 2. CREATE
export const create = mutation({
    args: { ...customerFields },
    handler: async (ctx, args) => {
        // Check for duplicate code
        const existing = await ctx.db
            .query("customers")
            .withIndex("by_code", (q) => q.eq("code", args.code))
            .first();

        if (existing) throw new Error(`Customer code '${args.code}' already exists`);

        return await ctx.db.insert("customers", {
            ...args,
            archived: false
        });
    },
});

// 3. UPDATE
export const update = mutation({
    args: {
        id: v.id("customers"),
        ...customerFields
    },
    handler: async (ctx, args) => {
        const { id, ...fields } = args;
        await ctx.db.patch(id, fields);
    },
});

// 4. ARCHIVE
export const archive = mutation({
    args: { id: v.id("customers") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { archived: true });
    },
});

export const get = query({
    args: { id: v.id("customers") },
    handler: async (ctx, args) => {
        const customer = await ctx.db.get(args.id);
        if (!customer) return null;

        // 1. Get Orders (Contracts)
        const orders = await ctx.db
            .query("orders")
            .withIndex("by_customer", (q) => q.eq("customer", args.id))
            .order("desc")
            .collect();

        // 2. Get Invoices & Payments
        const invoiceData = await Promise.all(
            orders.map(async (order) => {
                const invoices = await ctx.db
                    .query("invoices")
                    .withIndex("by_order", (q) => q.eq("order_id", order._id))
                    .collect();

                const invoicesWithPayments = await Promise.all(
                    invoices.map(async (inv) => {
                        const payments = await ctx.db
                            .query("payments")
                            .withIndex("by_invoice", (q) => q.eq("invoice_id", inv._id))
                            .collect();

                        const paid = payments.reduce((sum, p) => sum + p.amount, 0);

                        return {
                            ...inv,
                            payments, // <--- IMPORTANT: Return the raw array
                            paidAmount: paid,
                            remainingAmount: inv.amount - paid,
                            isOverdue: inv.status === 'unpaid' && Date.now() > inv.end_date
                        };
                    })
                );
                return invoicesWithPayments;
            })
        );

        const allInvoices = invoiceData.flat().sort((a, b) => b.invoice_number - a.invoice_number);

        return {
            customer,
            orders,
            invoices: allInvoices
        };
    },
});