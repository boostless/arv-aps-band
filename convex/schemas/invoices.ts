// convex/schema/invoices.ts
import { v } from 'convex/values';

export const invoiceFields = {
    order_id: v.id('orders'),
    invoice_number: v.number(),

    // Billing Period
    start_date: v.number(),
    end_date: v.number(),

    // --- FINANCIALS (The Snapshot Totals) ---
    amount: v.number(),      // Final Total (including tax & discount)
    tax_amount: v.number(),  // Tax portion
    discount: v.optional(v.number()), // ✅ Added: Global discount amount (in cents)

    // --- STATUS ---
    status: v.union(v.literal('unpaid'), v.literal('paid'), v.literal('void')),
    due_date: v.optional(v.number()),

    // --- CUSTOMER SNAPSHOT ---
    // (Great for history: if customer changes address, old invoice stays correct)
    customer_id: v.optional(v.id('customers')),
    customer_name: v.optional(v.string()),
    customer_address: v.optional(v.string()),
    customer_vat: v.optional(v.string()),

    // --- METADATA ---
    created_by: v.string(),
    notes: v.optional(v.string()), // ✅ Added: Custom text for this invoice

    // --- PDF GENERATION ---
    pdf_url: v.optional(v.string()),
    pdf_status: v.optional(v.string()), // 'generating', 'ready', 'failed'

    // --- LINE ITEMS SNAPSHOT ---
    // This allows you to edit the invoice content freely after creation
    items: v.optional(v.array(v.object({
        label: v.string(),     // e.g. "Fasadiniai pastoliai"
        quantity: v.number(),  // e.g. 1
        price: v.number(),     // Unit price (in cents)
        total: v.number(),     // Line total (in cents)
        type: v.string(),      // "service", "product_group", "custom"
    }))),
};