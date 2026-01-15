import { v } from 'convex/values';

export const stockLogFields = {
    product: v.id('products'),
    warehouse: v.id('warehouses'),

    // The change amount (e.g., +10 or -5)
    delta: v.number(),

    // Snapshot: What was the total AFTER this change? 
    // (Super helpful for debugging "when did stock drop below 0?")
    resulting_quantity: v.number(),

    // Why did this happen?
    type: v.union(
        v.literal('purchase'),   // Bought from vendor
        v.literal('sale'),       // Sold to customer
        v.literal('transfer'),   // Moved between warehouses
        v.literal('audit'),      // Stocktake correction
        v.literal('return'),     // Customer return
        v.literal('initial'),     // First setup
        v.literal('rental_out'), // Rented out to customer
    ),

    // Optional: Connect it to an external event
    reference_id: v.optional(v.string()), // e.g. "Order #1042" or "Invoice #99"
    notes: v.optional(v.string()),

    // If you have authentication set up:
    // performed_by: v.optional(v.string()), // User ID
}