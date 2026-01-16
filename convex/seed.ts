// convex/seed.ts
import { mutation } from "./_generated/server";

// Initialize default units and product types
export const initializeDefaults = mutation({
    handler: async (ctx) => {
        // Check if already initialized
        const existingUnits = await ctx.db.query("units").first();
        const existingTypes = await ctx.db.query("product_types").first();

        if (existingUnits && existingTypes) {
            return { message: "Defaults already initialized", created: false };
        }

        let unitsCreated = 0;
        let typesCreated = 0;

        // 1. CREATE DEFAULT UNITS (if needed)
        if (!existingUnits) {
            const defaultUnits = [
                { code: "VNT", label: "Vienetai", abbreviation: "vnt.", is_system: true },
                { code: "M", label: "Metrai", abbreviation: "m", is_system: true },
                { code: "M2", label: "Kvadratiniai metrai", abbreviation: "m²", is_system: true },
                { code: "M3", label: "Kubiniai metrai", abbreviation: "m³", is_system: true },
                { code: "KG", label: "Kilogramai", abbreviation: "kg", is_system: true },
                { code: "VAL", label: "Valandos", abbreviation: "val.", is_system: true },
                { code: "KOMP", label: "Komplektai", abbreviation: "komp.", is_system: true },
            ];

            for (const unit of defaultUnits) {
                // Check if this specific unit already exists
                const existing = await ctx.db
                    .query("units")
                    .filter(q => q.eq(q.field("code"), unit.code))
                    .first();

                if (!existing) {
                    await ctx.db.insert("units", unit);
                    unitsCreated++;
                }
            }
        }

        // 2. CREATE DEFAULT PRODUCT TYPES (if needed)
        if (!existingTypes) {
            const defaultTypes = [
                { 
                    label: "Paslaugos", 
                    key: "service", 
                    is_system: true 
                },
                { 
                    label: "Fasadiniai pastoliai", 
                    key: "facade_scaffolding", 
                    is_system: false 
                },
                { 
                    label: "Rėminiai pastoliai", 
                    key: "frame_scaffolding", 
                    is_system: false 
                },
                { 
                    label: "Moduliniai pastoliai", 
                    key: "modular_scaffolding", 
                    is_system: false 
                },
                { 
                    label: "Priedai", 
                    key: "accessories", 
                    is_system: false 
                },
            ];

            for (const type of defaultTypes) {
                // Check if this specific type already exists
                const existing = await ctx.db
                    .query("product_types")
                    .filter(q => q.eq(q.field("key"), type.key))
                    .first();

                if (!existing) {
                    await ctx.db.insert("product_types", type);
                    typesCreated++;
                }
            }
        }

        return {
            message: "Defaults initialized successfully",
            created: true,
            unitsCreated,
            typesCreated
        };
    }
});
