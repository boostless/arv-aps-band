// convex/warehouses.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { warehouseFields } from "./schemas/warehouses";

// 1. LIST (With optional archive filter)
export const list = query({
    args: { showArchived: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const warehouses = await ctx.db.query("warehouses").collect();
        // Filter in memory (fast enough for <1000 warehouses)
        return warehouses.filter(w => args.showArchived ? true : !w.archived);
    },
});

// 2. CREATE
export const create = mutation({
    args: { ...warehouseFields },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("warehouses")
            .withIndex("by_code", (q) => q.eq("code", args.code))
            .first();

        if (existing) throw new Error(`Warehouse code '${args.code}' already exists`);

        return await ctx.db.insert("warehouses", {
            ...args,
            archived: false
        });
    },
});

// 3. UPDATE
export const update = mutation({
    args: {
        id: v.id("warehouses"),
        label: v.string(),
        // We usually don't allow changing 'code' to keep history safe
    },
    handler: async (ctx, args) => {
        const { id, ...rest } = args;
        await ctx.db.patch(id, rest);
    },
});

// 4. ARCHIVE
export const archive = mutation({
    args: { id: v.id("warehouses") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { archived: true });
    },
});

export const get = query({
    args: { id: v.id("warehouses") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});