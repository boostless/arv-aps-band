import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { customerFields } from "./schemas/customers";

// 1. LIST
export const list = query({
    args: { showArchived: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const customers = await ctx.db.query("customers").collect();
        return customers.filter(c => args.showArchived ? true : !c.archived);
    },
});

// 2. CREATE
export const create = mutation({
    args: { ...customerFields },
    handler: async (ctx, args) => {
        // Check for duplicate code
        const existing = await ctx.db
            .query("customers")
            .withIndex("by_code", (q) => q.eq("code", args.code))
            .first();

        if (existing) throw new Error(`Customer code '${args.code}' already exists`);

        return await ctx.db.insert("customers", {
            ...args,
            archived: false
        });
    },
});

// 3. UPDATE
export const update = mutation({
    args: {
        id: v.id("customers"),
        ...customerFields
    },
    handler: async (ctx, args) => {
        const { id, ...fields } = args;
        await ctx.db.patch(id, fields);
    },
});

// 4. ARCHIVE
export const archive = mutation({
    args: { id: v.id("customers") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { archived: true });
    },
});