// convex/settings.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { settingsFields } from "./schemas/settings";

// GET: Fetch the one and only settings record
export const get = query({
    handler: async (ctx) => {
        return await ctx.db.query("business_settings").first();
    },
});

// UPDATE: Upsert (Update if exists, Create if new)
export const update = mutation({
    args: { ...settingsFields },
    handler: async (ctx, args) => {
        const existing = await ctx.db.query("business_settings").first();

        if (existing) {
            await ctx.db.patch(existing._id, args);
        } else {
            await ctx.db.insert("business_settings", args);
        }
    },
});