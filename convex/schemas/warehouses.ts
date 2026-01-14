import { v } from 'convex/values';

export const warehouseFields = {
    code: v.string(),
    label: v.string(),
    archived: v.optional(v.boolean()),
}