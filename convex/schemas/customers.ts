import { v } from 'convex/values';

export const customerFields = {
    code: v.string(),       // Unique ID (e.g. CUST-001)
    label: v.string(),      // Customer Name

    // Contact Info (NEW)
    phone: v.optional(v.string()),
    email: v.optional(v.string()),

    // Business Details
    company_code: v.optional(v.string()), // Įmonės kodas
    vat_code: v.optional(v.string()),     // PVM kodas
    address: v.string(),

    // Status
    archived: v.optional(v.boolean()),
}