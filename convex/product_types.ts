import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// LIST
export const list = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("product_types").collect();
    },
});

// CREATE
export const create = mutation({
    args: {
        label: v.string(),
        key: v.string(),
    },
    handler: async (ctx, args) => {
        // Check for duplicate key
        const existing = await ctx.db
            .query("product_types")
            .withIndex("by_key", (q) => q.eq("key", args.key))
            .first();

        if (existing) throw new Error("A type with this key already exists.");

        await ctx.db.insert("product_types", {
            label: args.label,
            key: args.key,
            is_system: false, // User-created types are not system protected
        });
    },
});

// UPDATE
export const update = mutation({
    args: {
        id: v.id("product_types"),
        label: v.string(),
        // We usually don't allow updating the 'key' to prevent breaking logic
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { label: args.label });
    },
});

// REMOVE
export const remove = mutation({
    args: { id: v.id("product_types") },
    handler: async (ctx, args) => {
        const item = await ctx.db.get(args.id);
        if (item?.is_system) throw new Error("Cannot delete a system type.");
        await ctx.db.delete(args.id);
    },
});