// convex/schemas/notifications.ts
import { v } from 'convex/values';

export const notificationFields = {
    type: v.union(
        v.literal('invoice_created'),
        v.literal('invoice_paid'),
        v.literal('order_created'),
        v.literal('order_completed')
    ),
    title: v.string(),
    message: v.string(),
    
    // References
    order_id: v.optional(v.id('orders')),
    invoice_id: v.optional(v.id('invoices')),
    
    // State
    read: v.boolean(),
    created_at: v.number(),
};
