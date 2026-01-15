import { v } from 'convex/values';

export const productFields = {
    code: v.string(),
    label: v.string(),
    type: v.id('product_types'),
    unit: v.id('units'),
    price: v.number(),
    archived: v.optional(v.boolean()),
    weight_g: v.optional(v.number()),
    daily_rental_price: v.number(),
}