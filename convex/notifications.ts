// convex/notifications.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a notification
export const create = mutation({
    args: {
        type: v.union(
            v.literal('invoice_created'),
            v.literal('invoice_paid'),
            v.literal('order_created'),
            v.literal('order_completed')
        ),
        title: v.string(),
        message: v.string(),
        order_id: v.optional(v.id('orders')),
        invoice_id: v.optional(v.id('invoices')),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("notifications", {
            type: args.type,
            title: args.title,
            message: args.message,
            order_id: args.order_id,
            invoice_id: args.invoice_id,
            read: false,
            created_at: Date.now(),
        });
    },
});

// List all notifications (newest first)
export const list = query({
    handler: async (ctx) => {
        return await ctx.db
            .query("notifications")
            .order("desc")
            .take(50); // Limit to last 50
    },
});

// Note: unreadCount, markAsRead, and markAllAsRead removed - read state now tracked in localStorage per device

// Delete notification
export const remove = mutation({
    args: { id: v.id("notifications") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});

// Helper function to create notifications (can be called from other mutations)
export async function createNotification(
    ctx: any,
    type: 'invoice_created' | 'invoice_paid' | 'order_created' | 'order_completed',
    title: string,
    message: string,
    orderId?: any,
    invoiceId?: any
) {
    await ctx.db.insert("notifications", {
        type,
        title,
        message,
        order_id: orderId,
        invoice_id: invoiceId,
        read: false,
        created_at: Date.now(),
    });
}
