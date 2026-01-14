import { mutation, query } from "./_generated/server";
import { productFields } from "./schemas/products"; // or wherever you defined it
import { v } from "convex/values";

// 1. LIST (With Join)
export const list = query({
    args: {
        showArchived: v.optional(v.boolean())
    },
    handler: async (ctx, args) => {
        // Fetch all products
        const products = await ctx.db.query("products").collect();

        // Filter based on archived status
        const filtered = products.filter(p =>
            args.showArchived ? true : !p.archived
        );

        // JOIN: Fetch unit details for every product efficiently
        // (We map over products and fetch the unit for each)
        const productsWithUnits = await Promise.all(
            filtered.map(async (p) => {
                const unit = await ctx.db.get(p.unit);
                return {
                    ...p,
                    unitData: unit // We attach the full unit object here
                };
            })
        );

        return productsWithUnits;
    },
});

// 2. CREATE (Already exists, but ensuring it matches)
export const create = mutation({
    args: { ...productFields },
    handler: async (ctx, args) => {
        // ... your existing create logic ...
        // (Copy from previous steps if needed, ensuring archived defaults to false)
        return await ctx.db.insert("products", args);
    },
});

// 3. UPDATE
export const update = mutation({
    args: {
        id: v.id("products"),
        ...productFields
    },
    handler: async (ctx, args) => {
        const { id, ...fields } = args;
        await ctx.db.patch(id, fields);
    },
});

// 4. ARCHIVE (Soft Delete)
export const archive = mutation({
    args: { id: v.id("products") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { archived: true });
    },
});