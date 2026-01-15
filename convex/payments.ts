// convex/payments.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paymentFields } from "./schemas/payments"; // Check if your folder is 'schema' or 'schemas'

// 1. ADD PAYMENT
export const add = mutation({
    args: { ...paymentFields },
    handler: async (ctx, args) => {
        // Verify invoice exists and is unpaid? (Optional validation)
        const invoice = await ctx.db.get(args.invoice_id);
        if (!invoice) throw new Error("Invoice not found");

        await ctx.db.insert("payments", args);

        // Optional: Auto-update invoice status to 'paid' if balance is 0?
        // You can add that logic here later.
    },
});

// 2. GET PAYMENTS (Changed from listByOrder to listByInvoice)
export const listByInvoice = query({
    args: { invoiceId: v.id("invoices") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("payments")
            .withIndex("by_invoice", (q) => q.eq("invoice_id", args.invoiceId))
            .order("desc")
            .collect();
    },
});