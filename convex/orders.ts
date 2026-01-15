// convex/orders.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Helper to get next invoice number
async function getNextInvoiceNumber(ctx: any) {
    const settings = await ctx.db.query("business_settings").first();
    if (!settings) throw new Error("Please configure Business Settings first (Invoice #)");
    return settings;
}

export const create = mutation({
    args: {
        customer: v.id("customers"),
        start_date: v.number(),
        end_date: v.optional(v.number()),
        type: v.union(v.literal('rental'), v.literal('sale')),
        created_by: v.optional(v.string()),
        notes: v.optional(v.string()),

        // The items payload
        items: v.array(v.object({
            product: v.id("products"),
            warehouse: v.id("warehouses"),
            quantity: v.number(),
            price: v.number(),   // Cents
            discount: v.number(), // Percentage (0-100)
            // We pass these in to avoid extra DB lookups, but we trust the frontend
            label: v.string(),
            code: v.string(),
            product_type: v.union(v.literal('product'), v.literal('service')),
        }))
    },
    handler: async (ctx, args) => {
        // 1. GET & INCREMENT INVOICE NUMBER
        const settings = await getNextInvoiceNumber(ctx);
        const invoiceNum = settings.invoice_start_number;

        // Atomically update the next number
        await ctx.db.patch(settings._id, {
            invoice_start_number: invoiceNum + 1
        });

        // 2. CALCULATE TOTALS
        let subtotal = 0;
        const itemsWithTotals = args.items.map(item => {
            // Math: Price * Qty * (1 - Discount/100)
            const itemTotal = Math.round(
                (item.price * item.quantity) * (1 - (item.discount / 100))
            );
            subtotal += itemTotal;
            return { ...item, total: itemTotal };
        });

        const taxAmount = Math.round(subtotal * (settings.tax_rate / 100));
        const finalTotal = subtotal + taxAmount;

        // 3. CREATE ORDER
        const orderId = await ctx.db.insert("orders", {
            invoice_number: invoiceNum,
            customer: args.customer,
            start_date: args.start_date,
            end_date: args.end_date,
            status: args.type == 'sale' ? 'completed' : 'active', // Default to active
            type: args.type,
            total_amount: finalTotal,
            tax_amount: taxAmount,
            created_by: args.created_by || 'System',
            notes: args.notes,
        });

        // 4. CREATE ITEMS & DEDUCT STOCK
        for (const item of itemsWithTotals) {
            // A. Insert Line Item
            await ctx.db.insert("order_items", {
                order_id: orderId,
                ...item
            });

            // B. HANDLE STOCK MOVEMENT
            // ONLY if it is a physical product (not a service)
            if (item.product_type === 'product') {

                // Reuse the logic from your stock.ts file (but inline for safety)
                const stockRecord = await ctx.db
                    .query("stock")
                    .withIndex("by_product_warehouse", q =>
                        q.eq("product", item.product).eq("warehouse", item.warehouse)
                    )
                    .unique();

                // Safety Check: Do we have enough? 
                // (Remove this check if you allow negative stock/backorders)
                if (!stockRecord || stockRecord.quantity < item.quantity) {
                    throw new Error(`Insufficient stock for ${item.label} in chosen warehouse.`);
                }

                const currentQty = stockRecord ? stockRecord.quantity : 0;

                // Deduct
                if (stockRecord) {
                    await ctx.db.patch(stockRecord._id, {
                        quantity: currentQty - item.quantity
                    });
                } else {
                    // Technically possible to have 0 record, so we create a negative one
                    await ctx.db.insert("stock", {
                        product: item.product,
                        warehouse: item.warehouse,
                        quantity: -item.quantity
                    });
                }

                // C. LOG THE MOVEMENT (Audit Trail)
                await ctx.db.insert("stock_logs", {
                    product: item.product,
                    warehouse: item.warehouse,
                    delta: -item.quantity, // Negative because we are taking it
                    resulting_quantity: currentQty - item.quantity,
                    type: args.type == 'sale' ? 'sale' : 'rental_out',
                    reference_id: `INV-${invoiceNum}`,
                    notes: `Order for ${args.created_by || 'Customer'}`
                });
            }
        }

        return orderId;
    },
});

export const list = query({
    args: {},
    handler: async (ctx) => {
        // 1. Get all orders, sorted by creation (newest first)
        const orders = await ctx.db.query("orders").order("desc").collect();

        // 2. Join with Customer data efficiently
        const ordersWithDetails = await Promise.all(
            orders.map(async (order) => {
                const customer = await ctx.db.get(order.customer);
                return {
                    ...order,
                    customerName: customer?.label ?? "Unknown Customer",
                };
            })
        );

        return ordersWithDetails;
    },
});

export const get = query({
    args: { id: v.id("orders") },
    handler: async (ctx, args) => {
        const order = await ctx.db.get(args.id);
        if (!order) return null;

        const customer = await ctx.db.get(order.customer);
        const settings = await ctx.db.query("business_settings").first();

        // Fetch line items
        const items = await ctx.db
            .query("order_items")
            .withIndex("by_order", (q) => q.eq("order_id", args.id))
            .collect();

        // Enhance items with warehouse codes (optional, but good for internal use)
        const itemsWithDetails = await Promise.all(
            items.map(async (item) => {
                const warehouse = await ctx.db.get(item.warehouse);
                return {
                    ...item,
                    warehouseCode: warehouse?.code || 'Unknown'
                };
            })
        );

        return {
            ...order,
            customer,
            items: itemsWithDetails,
            settings
        };
    },
});

export const complete = mutation({
    args: { id: v.id("orders") },
    handler: async (ctx, args) => {
        // 1. Get the order
        const order = await ctx.db.get(args.id);
        if (!order) throw new Error("Order not found");

        // 2. Validate
        if (order.status !== 'active') throw new Error("Order is not active");
        if (order.type !== 'rental') throw new Error("Only rental orders can be completed");

        // 3. Get all items
        const items = await ctx.db
            .query("order_items")
            .withIndex("by_order", (q) => q.eq("order_id", args.id))
            .collect();

        // 4. PROCESS RETURNS
        for (const item of items) {
            if (item.product_type === 'product') {

                // CORRECTION: Calculate what is actually left to return
                const alreadyReturned = item.returned_quantity || 0;
                const remainingToReturn = item.quantity - alreadyReturned;

                // If everything is already returned, skip stock adjustment
                if (remainingToReturn <= 0) {
                    // Ensure data consistency (just in case)
                    if (remainingToReturn < 0) console.error("Data warning: More items returned than rented!");
                    continue;
                }

                // 5. UPDATE ITEM RECORD
                // Mark it as fully returned in the database
                await ctx.db.patch(item._id, {
                    returned_quantity: item.quantity
                });

                // 6. RESTORE STOCK (Only the remaining amount)
                const stockRecord = await ctx.db
                    .query("stock")
                    .withIndex("by_product_warehouse", (q) =>
                        q.eq("product", item.product).eq("warehouse", item.warehouse)
                    )
                    .unique();

                if (stockRecord) {
                    await ctx.db.patch(stockRecord._id, {
                        quantity: stockRecord.quantity + remainingToReturn // <--- FIXED
                    });
                } else {
                    await ctx.db.insert("stock", {
                        product: item.product,
                        warehouse: item.warehouse,
                        quantity: remainingToReturn // <--- FIXED
                    });
                }

                // 7. LOG
                await ctx.db.insert("stock_logs", {
                    product: item.product,
                    warehouse: item.warehouse,
                    delta: remainingToReturn,
                    resulting_quantity: (stockRecord?.quantity || 0) + remainingToReturn,
                    type: 'return',
                    reference_id: `INV-${order.invoice_number} (Final)`,
                    notes: 'Order completed (Rest of items returned)'
                });
            }
        }

        // 8. UPDATE ORDER STATUS
        await ctx.db.patch(args.id, {
            status: 'completed',
            end_date: Date.now()
        });
    },
});

export const returnPartial = mutation({
    args: {
        orderId: v.id("orders"),
        // List of returns: { itemId: "...", returnQty: 5 }
        returns: v.array(v.object({
            itemId: v.id("order_items"),
            returnQty: v.number()
        }))
    },
    handler: async (ctx, args) => {
        const order = await ctx.db.get(args.orderId);
        if (!order) throw new Error("Order not found");
        if (order.status !== 'active') throw new Error("Order is not active");

        // Process each return
        for (const ret of args.returns) {
            if (ret.returnQty <= 0) continue;

            const item = await ctx.db.get(ret.itemId);
            if (!item) continue;
            if (item.product_type === 'service') continue; // Skip services

            const currentReturned = item.returned_quantity || 0;
            const remaining = item.quantity - currentReturned;

            if (ret.returnQty > remaining) {
                throw new Error(`Cannot return ${ret.returnQty} of ${item.label}. Only ${remaining} out.`);
            }

            // 1. UPDATE ITEM
            await ctx.db.patch(ret.itemId, {
                returned_quantity: currentReturned + ret.returnQty
            });

            // 2. RESTORE STOCK
            const stockRecord = await ctx.db
                .query("stock")
                .withIndex("by_product_warehouse", q =>
                    q.eq("product", item.product).eq("warehouse", item.warehouse)
                )
                .unique();

            if (stockRecord) {
                await ctx.db.patch(stockRecord._id, {
                    quantity: stockRecord.quantity + ret.returnQty
                });
            } else {
                await ctx.db.insert("stock", {
                    product: item.product,
                    warehouse: item.warehouse,
                    quantity: ret.returnQty
                });
            }

            // 3. LOG
            await ctx.db.insert("stock_logs", {
                product: item.product,
                warehouse: item.warehouse,
                delta: ret.returnQty,
                resulting_quantity: (stockRecord?.quantity || 0) + ret.returnQty,
                type: 'return',
                reference_id: `INV-${order.invoice_number}`,
                notes: `Partial return (${ret.returnQty})`
            });
        }

        // 4. CHECK IF ORDER IS FULLY COMPLETE
        // We re-fetch all items for this order to check their status
        const allItems = await ctx.db
            .query("order_items")
            .withIndex("by_order", q => q.eq("order_id", args.orderId))
            .collect();

        const allReturned = allItems.every(item => {
            // Services are always "returned"
            if (item.product_type === 'service') return true;
            // Products must have returned >= quantity
            return (item.returned_quantity || 0) >= item.quantity;
        });

        if (allReturned) {
            await ctx.db.patch(args.orderId, { status: 'completed' });
        }
    },
});