// convex/schema/settings.ts
import { v } from 'convex/values';

export const settingsFields = {
    // 1. Basic Info
    business_name: v.string(),
    company_code: v.string(),     // Įmonės kodas
    vat_code: v.optional(v.string()), // PVM kodas (optional if not VAT payer)
    address: v.string(),

    email: v.optional(v.string()),
    phone: v.optional(v.string()),

    // 2. Financials
    tax_rate: v.number(),         // e.g., 21 for 21%
    invoice_start_number: v.number(), // e.g., 1000

    // 3. Bank Accounts (Array of objects)
    banks: v.array(
        v.object({
            name: v.string(), // e.g., "Swedbank"
            iban: v.string(),
            swift: v.optional(v.string()),
        })
    ),
    invoice_due_days: v.optional(v.number()),

    // ✅ NEW: Employee List
    employees: v.optional(v.array(v.object({
        name: v.string(),
        role: v.optional(v.string()) // e.g. "Manager", "Driver"
    }))),
};