// convex/schema/payments.ts
import { v } from 'convex/values';

export const paymentFields = {
    invoice_id: v.id('invoices'),
    amount: v.number(), // Cents
    date: v.number(),   // Timestamp
    notes: v.optional(v.string()),
    method: v.union(v.literal('cash'), v.literal('bank'), v.literal('card')),
};