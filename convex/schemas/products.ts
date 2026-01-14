import { v } from 'convex/values';

export const productFields = {
    code: v.string(),
    label: v.string(),
    type: v.union(v.literal('product'), v.literal('service')),
    unit: v.id('units'),
    price: v.number(), // Bus centais
    archived: v.optional(v.boolean()),
    weight_g: v.optional(v.number()),
    daily_rental_price: v.number(),
}