// convex/schema/invoices.ts
import { v } from 'convex/values';

export const invoiceFields = {
    order_id: v.id('orders'),
    invoice_number: v.number(), // The official sequential number (e.g. 1005)

    // Billing Period
    start_date: v.number(),
    end_date: v.number(),

    // Money
    amount: v.number(),      // Total for this period
    tax_amount: v.number(),

    // Status
    status: v.union(v.literal('unpaid'), v.literal('paid'), v.literal('void')),

    // Snapshot of customer details at time of invoice (optional but good practice)
    customer_name: v.optional(v.string()),
    due_date: v.optional(v.number()),
};