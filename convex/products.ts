import { mutation, query } from "./_generated/server";
import { productFields } from "./schemas/products"; // or wherever you defined it
import { v } from "convex/values";

// 1. LIST (With Join)
export const list = query({
    args: {
        showArchived: v.optional(v.boolean())
    },
    handler: async (ctx, args) => {
        // 1. Fetch all Product Types
        const allTypes = await ctx.db.query("product_types").collect();

        // ✅ FIX: Map by ID (_id), not by key
        const typeMap = new Map();
        allTypes.forEach(t => typeMap.set(t._id, t));

        // 2. Fetch all products
        const products = await ctx.db.query("products").collect();

        // 3. Filter
        const filtered = products.filter(p =>
            args.showArchived ? true : !p.archived
        );

        // 4. JOIN
        const productsWithDetails = await Promise.all(
            filtered.map(async (p) => {
                const unit = await ctx.db.get(p.unit);

                // ✅ FIX: Lookup using the ID stored in p.type
                const typeInfo = typeMap.get(p.type);

                return {
                    ...p,
                    unitData: unit,
                    typeData: typeInfo || null
                };
            })
        );

        return productsWithDetails;
    },
});

// 2. CREATE (Already exists, but ensuring it matches)
export const create = mutation({
    args: { ...productFields },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("products")
            .withIndex("by_code", (q) => q.eq("code", args.code))
            .first();

        if (existing) throw new Error(`Product code '${args.code}' already exists`);
        // ... your existing create logic ...
        // (Copy from previous steps if needed, ensuring archived defaults to false)
        return await ctx.db.insert("products", {
            ...args,
            archived: false
        });
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