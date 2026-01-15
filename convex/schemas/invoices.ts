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

    due_date: v.optional(v.number()),
    // Snapshots
    customer_id: v.optional(v.id('customers')), 
    customer_name: v.optional(v.string()), 
    customer_address: v.optional(v.string()), 
    customer_vat: v.optional(v.string()), 

    // ✅ CHANGED: Now Required
    created_by: v.string(),
    pdf_url: v.optional(v.string()), // ✅ New field
    pdf_status: v.optional(v.string()),
};