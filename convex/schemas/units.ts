import { v } from 'convex/values';

export const unitFields = {
    code: v.string(),
    label: v.string(),
    abbreviation: v.string(),
    is_system: v.optional(v.boolean()),
}