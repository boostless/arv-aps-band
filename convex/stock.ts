import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// QUERY: Get stock level for a specific item in a specific warehouse
export const get = query({
    args: {
        product: v.id("products"),
        warehouse: v.id("warehouses"),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("stock")
            .withIndex("by_product_warehouse", (q) =>
                q.eq("product", args.product).eq("warehouse", args.warehouse)
            )
            .unique(); // Returns null if not found
    },
});

export const adjust = mutation({
    args: {
        product: v.id("products"),
        warehouse: v.id("warehouses"),
        delta: v.number(),

        // NEW ARGS for the log
        type: v.union(
            v.literal('purchase'),
            v.literal('sale'),
            v.literal('transfer'),
            v.literal('audit'),
            v.literal('return'),
            v.literal('initial')
        ),
        reference_id: v.optional(v.string()),
        notes: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // 1. Get current stock
        const existing = await ctx.db
            .query("stock")
            .withIndex("by_product_warehouse", (q) =>
                q.eq("product", args.product).eq("warehouse", args.warehouse)
            )
            .unique();

        let currentQty = existing ? existing.quantity : 0;
        const newQty = currentQty + args.delta;

        // 2. Update or Insert Stock Record
        if (existing) {
            await ctx.db.patch(existing._id, { quantity: newQty });
        } else {
            await ctx.db.insert("stock", {
                product: args.product,
                warehouse: args.warehouse,
                quantity: newQty,
            });
        }

        // 3. CREATE LOG ENTRY (The "Ledger")
        await ctx.db.insert("stock_logs", {
            product: args.product,
            warehouse: args.warehouse,
            delta: args.delta,
            resulting_quantity: newQty, // <--- Key for auditing
            type: args.type,
            reference_id: args.reference_id,
            notes: args.notes,
        });
    },
});

export const listByWarehouse = query({
    args: { warehouseId: v.id("warehouses") },
    handler: async (ctx, args) => {
        // 1. Get ONLY the stock entries for this warehouse
        const stockEntries = await ctx.db
            .query("stock")
            .withIndex("by_warehouse", (q) => q.eq("warehouse", args.warehouseId))
            .collect();

        // 2. Filter out items with 0 quantity (optional, but cleaner)
        const activeStock = stockEntries.filter(s => s.quantity > 0);

        // 3. Join with Product details
        // We need to know the name/code of the items we found
        const stockWithDetails = await Promise.all(
            activeStock.map(async (entry) => {
                const product = await ctx.db.get(entry.product);
                return {
                    _id: entry._id, // Stock ID
                    productId: entry.product,
                    label: product?.label ?? "Unknown Product",
                    code: product?.code ?? "???",
                    quantity: entry.quantity,
                };
            })
        );

        return stockWithDetails;
    },
});