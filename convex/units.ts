import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { unitFields } from "./schemas/units"; // Ensure unitFields is exported from your schema file

// 1. LIST: For your dropdowns
export const list = query({
    args: {},
    handler: async (ctx) => {
        // Helper: Sort system units first, then alphabetical
        const units = await ctx.db.query("units").collect();
        return units.sort((a, b) => {
            if (a.is_system && !b.is_system) return -1;
            if (!a.is_system && b.is_system) return 1;
            return a.label.localeCompare(b.label);
        });
    },
});

// 2. CREATE: For custom user units
export const create = mutation({
    args: {
        code: v.string(),
        label: v.string(),
        abbreviation: v.string(),
        // Users can't set is_system via the API, it defaults to false
    },
    handler: async (ctx, args) => {
        // Optional: check for duplicate code before inserting
        const existing = await ctx.db
            .query("units")
            .withIndex("by_code", (q) => q.eq("code", args.code))
            .first();

        if (existing) throw new Error(`Unit with code '${args.code}' already exists.`);

        return await ctx.db.insert("units", {
            ...args,
            is_system: false,
        });
    },
});

// 3. SEED: Run this once to populate defaults
export const seedDefaults = internalMutation({
    args: {},
    handler: async (ctx) => {
        const defaults = [
            { code: "vnt", label: "Vienetas", abbreviation: "vnt", is_system: true },
        ];

        for (const unit of defaults) {
            // Check if exists to avoid duplicates when re-running
            const existing = await ctx.db
                .query("units")
                .withIndex("by_code", (q) => q.eq("code", unit.code))
                .first();

            if (!existing) {
                await ctx.db.insert("units", { ...unit, is_system: true });
            }
        }
    },
});

// 3. UPDATE (New)
export const update = mutation({
    args: {
        id: v.id("units"),
        label: v.string(),
        abbreviation: v.string(),
        // We intentionally do NOT allow changing 'code' easily to prevent breaking references
    },
    handler: async (ctx, args) => {
        const { id, ...fields } = args;

        // Optional: Protect system units from being renamed if you want
        const unit = await ctx.db.get(id);
        if (unit?.is_system) throw new Error("Cannot edit system units");

        await ctx.db.patch(id, fields);
    },
});

// 4. DELETE (New)
export const remove = mutation({
    args: { id: v.id("units") },
    handler: async (ctx, args) => {
        const unit = await ctx.db.get(args.id);

        if (!unit) throw new Error("Unit not found");
        if (unit.is_system) {
            throw new Error("Cannot delete system units (kg, m, etc.)");
        }

        // Optional: Check if used in products before deleting? 
        // For now, we just delete.
        await ctx.db.delete(args.id);
    },
});