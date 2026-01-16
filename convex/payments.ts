// convex/payments.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paymentFields } from "./schemas/payments";
import { createNotification } from "./notifications";

// 1. ADD PAYMENT
export const add = mutation({
    args: { ...paymentFields },
    handler: async (ctx, args) => {
        // 1. Verify invoice exists
        const invoice = await ctx.db.get(args.invoice_id);
        if (!invoice) throw new Error("Invoice not found");

        // 2. Insert the new payment
        await ctx.db.insert("payments", args);

        // 3. Recalculate Total Paid
        // We fetch all payments again to be 100% sure of the total (including the one we just added)
        const allPayments = await ctx.db
            .query("payments")
            .withIndex("by_invoice", q => q.eq("invoice_id", args.invoice_id))
            .collect();

        const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

        // 4. Update Invoice Status
        // If paid amount covers the invoice amount (allow for tiny floating point errors if any, though we use integers)
        if (totalPaid >= invoice.amount) {
            if (invoice.status !== 'paid') {
                await ctx.db.patch(args.invoice_id, { status: 'paid' });
                
                // Create notification
                await createNotification(
                    ctx,
                    'invoice_paid',
                    `Sąskaita #${invoice.invoice_number} apmokėta`,
                    `Suma: €${(invoice.amount / 100).toFixed(2)}`,
                    invoice.order_id,
                    args.invoice_id
                );
            }
        } else {
            // Optional: If you support deleting payments, you might want to revert to 'unpaid' here too.
            // For adding payments, we usually only go Unpaid -> Paid.
            if (invoice.status === 'paid') {
                await ctx.db.patch(args.invoice_id, { status: 'unpaid' });
            }
        }
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