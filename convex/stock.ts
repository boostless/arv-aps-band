import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { stockLogFields } from "./schemas/stockLogs";

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
        delta: v.number(), // Amount to add/remove
        type: v.union(
            v.literal("purchase"),
            v.literal("sale"),
            v.literal("transfer"),
            v.literal("audit"),
            v.literal("return"),
            v.literal("initial"),
            v.literal("rental_out")
        ),
        notes: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // 1. Find existing stock record
        const existing = await ctx.db
            .query("stock")
            .withIndex("by_product_warehouse", (q) =>
                q.eq("product", args.product).eq("warehouse", args.warehouse)
            )
            .unique();

        let currentQty = 0;
        let newQty = 0;

        if (existing) {
            currentQty = existing.quantity;
            newQty = currentQty + args.delta;

            // Update existing record
            await ctx.db.patch(existing._id, { quantity: newQty });
        } else {
            currentQty = 0;
            newQty = args.delta;

            // Create new record
            await ctx.db.insert("stock", {
                product: args.product,
                warehouse: args.warehouse,
                quantity: newQty,
            });
        }

        // 2. LOG THE CHANGE (Fixed: Added resulting_quantity)
        await ctx.db.insert("stock_logs", {
            product: args.product,
            warehouse: args.warehouse,
            type: args.type,
            delta: args.delta,
            resulting_quantity: newQty, // <--- THIS WAS MISSING
            notes: args.notes || "",
            reference_id: "Manual Adjustment",
        });
    },
});

export const listByWarehouse = query({
    args: { warehouseId: v.id("warehouses") },
    handler: async (ctx, args) => {
        const stockEntries = await ctx.db
            .query("stock")
            .withIndex("by_warehouse", (q) => q.eq("warehouse", args.warehouseId))
            .collect();

        const activeStock = stockEntries.filter(s => s.quantity !== 0);

        const stockWithDetails = await Promise.all(
            activeStock.map(async (entry) => {
                const product = await ctx.db.get(entry.product);
                return {
                    _id: entry._id,
                    productId: entry.product,
                    label: product?.label ?? "Unknown Product",
                    code: product?.code ?? "???",
                    quantity: entry.quantity,
                    unit: product?.unit, // Optional: if you need unit ID
                };
            })
        );

        return stockWithDetails;
    },
});