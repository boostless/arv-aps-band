import { v } from 'convex/values';

export const stockFields = {
    product: v.id('products'),
    warehouse: v.id('warehouses'),
    quantity: v.number(),
}