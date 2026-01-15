// convex/schema/orders.ts
import { v } from 'convex/values';

export const orderFields = {
    contract_number: v.number(),  // e.g. 1001
    customer: v.id('customers'),
    next_billing_date: v.optional(v.number()),

    // Dates
    start_date: v.number(),      // Unix timestamp
    end_date: v.optional(v.number()), // For rentals

    // Metadata
    status: v.union(
        v.literal('draft'),
        v.literal('active'),
        v.literal('completed'),
        v.literal('cancelled')
    ),
    type: v.union(v.literal('rental'), v.literal('sale')),

    // Financials
    total_amount: v.number(),    // Cents (calculated sum of items)
    tax_amount: v.number(),      // Cents

    // Audit
    created_by: v.optional(v.string()), // User name
    notes: v.optional(v.string()),

    act_pdf_url: v.optional(v.string()),
    act_pdf_status: v.optional(v.string()), // 'generating', 'ready', 'failed'
};

export const orderItemFields = {
    order_id: v.id('orders'),

    product: v.id('products'),
    warehouse: v.id('warehouses'), // Crucial: Where did we take it from?

    // Snapshot of the product data at time of order
    label: v.string(),
    code: v.string(),
    product_type: v.union(v.literal('product'), v.literal('service')),

    // Money
    quantity: v.number(),
    price: v.number(),       // Unit Price (Cents)
    discount: v.number(),    // Percentage (0-100) or Fixed Amount? Let's do % for now
    returned_quantity: v.optional(v.number()),

    total: v.number(),       // (Price * Qty) * (1 - Discount)

    return_history: v.optional(v.array(v.object({
        date: v.number(),
        qty: v.number()
    }))),
};