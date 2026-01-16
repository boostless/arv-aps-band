// convex/orders.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { generateInvoiceInternal } from "./invoices";
import { createNotification } from "./notifications";

// 1. HELPER: Get Next Contract Number
// (We reuse the invoice_start_number or you can add a separate 'contract_start_number' to settings)
async function getNextContractNumber(ctx: any) {
    const settings = await ctx.db.query("business_settings").first();
    const num = settings?.invoice_start_number || 1000;

    // Increment the counter so the next one is unique
    if (settings) {
        await ctx.db.patch(settings._id, { invoice_start_number: num + 1 });
    }

    return num;
}

export const create = mutation({
    args: {
        customer: v.id("customers"),
        start_date: v.number(),
        end_date: v.optional(v.number()),
        type: v.union(v.literal('rental'), v.literal('sale')),
        created_by: v.optional(v.string()),
        notes: v.optional(v.string()),
        items: v.array(v.object({
            product: v.id("products"),
            warehouse: v.id("warehouses"),
            quantity: v.number(),
            price: v.number(),
            discount: v.number(),
            label: v.string(),
            code: v.string(),
            product_type: v.id("product_types"),
        }))
    },
    handler: async (ctx, args) => {
        // 1. FETCH PRODUCT TYPES (To identify services vs rental items)
        const productTypeIds = [...new Set(args.items.map(item => item.product_type))];
        const productTypes = await Promise.all(
            productTypeIds.map(id => ctx.db.get(id))
        );
        const typeMap = new Map(productTypes.filter(Boolean).map(t => [t!._id, t!]));

        // 2. VALIDATE STOCK AVAILABILITY (Before creating order)
        for (const item of args.items) {
            const productType = typeMap.get(item.product_type);
            const isService = productType?.key === 'service';

            // Only check stock for rental items
            if (!isService) {
                const stockRecord = await ctx.db
                    .query("stock")
                    .withIndex("by_product_warehouse", q =>
                        q.eq("product", item.product).eq("warehouse", item.warehouse)
                    )
                    .unique();

                const currentQty = stockRecord ? stockRecord.quantity : 0;
                const availableQty = currentQty;

                if (availableQty < item.quantity) {
                    const product = await ctx.db.get(item.product);
                    const warehouse = await ctx.db.get(item.warehouse);
                    throw new Error(
                        `Insufficient stock for "${item.label}". Available: ${availableQty}, Requested: ${item.quantity} at ${warehouse?.label || 'warehouse'}`
                    );
                }
            }
        }

        // 3. FETCH SETTINGS (For Tax Rate)
        const settings = await ctx.db.query("business_settings").first();
        const taxRate = settings?.tax_rate || 21;

        // 4. GENERATE CONTRACT NUMBER
        const contractNum = await getNextContractNumber(ctx);

        // 5. CALCULATE TOTALS
        let subtotal = 0;
        const itemsWithTotals = args.items.map(item => {
            const itemTotal = Math.round(
                (item.price * item.quantity) * (1 - (item.discount / 100))
            );
            subtotal += itemTotal;
            return { ...item, total: itemTotal };
        });

        // Calculate Tax
        const taxAmount = Math.round(subtotal * (taxRate / 100));

        // 6. CREATE ORDER (With all required fields)
        const orderId = await ctx.db.insert("orders", {
            customer: args.customer,
            start_date: args.start_date,
            end_date: args.end_date,
            status: args.type === 'sale' ? 'completed' : 'active',
            type: args.type,

            contract_number: contractNum,
            total_amount: subtotal,
            tax_amount: taxAmount,

            created_by: args.created_by || 'System',
            notes: args.notes,
        });

        // 7. CREATE ITEMS & DEDUCT STOCK
        for (const item of itemsWithTotals) {
            await ctx.db.insert("order_items", {
                order_id: orderId,
                ...item,
                returned_quantity: 0
            });

            // Only deduct stock for rental items (not services)
            const productType = typeMap.get(item.product_type);
            const isService = productType?.key === 'service';

            if (!isService) {
                const stockRecord = await ctx.db
                    .query("stock")
                    .withIndex("by_product_warehouse", q =>
                        q.eq("product", item.product).eq("warehouse", item.warehouse)
                    )
                    .unique();

                const currentQty = stockRecord ? stockRecord.quantity : 0;
                const newQty = currentQty - item.quantity;

                if (stockRecord) {
                    await ctx.db.patch(stockRecord._id, { quantity: newQty });
                } else {
                    await ctx.db.insert("stock", {
                        product: item.product,
                        warehouse: item.warehouse,
                        quantity: newQty
                    });
                }

                await ctx.db.insert("stock_logs", {
                    product: item.product,
                    warehouse: item.warehouse,
                    delta: -item.quantity,
                    resulting_quantity: newQty,
                    type: args.type === 'sale' ? 'sale' : 'rental_out',
                    reference_id: `ORD-${contractNum}`,
                    notes: `Order for ${args.created_by || 'Customer'}`
                });
            }
        }

        // Create notification
        const customer = await ctx.db.get(args.customer);
        await createNotification(
            ctx,
            'order_created',
            `Naujas užsakymas #${contractNum}`,
            `Klientas: ${customer?.label || 'Nežinomas'}`,
            orderId
        );

        return orderId;
    },
});

export const list = query({
    args: {},
    handler: async (ctx) => {
        const orders = await ctx.db.query("orders").order("desc").collect();

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
        const items = await ctx.db
            .query("order_items")
            .withIndex("by_order", (q) => q.eq("order_id", args.id))
            .collect();

        const invoices = await ctx.db
            .query("invoices")
            .withIndex("by_order", (q) => q.eq("order_id", args.id))
            .collect();

        // Fetch product types to check if items are rental products
        const productTypeIds = [...new Set(items.map(item => item.product_type))];
        const productTypes = await Promise.all(
            productTypeIds.map(id => ctx.db.get(id))
        );
        const typeMap = new Map(productTypes.filter(Boolean).map(t => [t!._id, t!]));

        // Enrich items with product type key for frontend filtering
        const enrichedItems = items.map(item => ({
            ...item,
            productTypeKey: typeMap.get(item.product_type)?.key || 'unknown'
        }));

        // Calculate Active Daily Rate
        let activeDailyRate = 0;

        if (order.type === 'rental') {
            for (const item of items) {
                const productType = typeMap.get(item.product_type);
                
                // Only rental products count (exclude services which are one-time charges)
                // "service" is the reserved key for non-rental items
                if (productType?.key !== 'service') {
                    const returned = item.returned_quantity || 0;
                    const activeQty = Math.max(0, item.quantity - returned);

                    // Price calculation: Price * Qty * (1 - Discount%)
                    const lineTotal = item.price * activeQty * (1 - (item.discount / 100));
                    activeDailyRate += lineTotal;
                }
            }
        }

        return {
            ...order,
            customer,
            items: enrichedItems,
            settings,
            invoices,
            activeDailyRate
        };
    },
});

export const complete = mutation({
    args: { id: v.id("orders") },
    handler: async (ctx, args) => {
        const order = await ctx.db.get(args.id);
        if (!order) throw new Error("Order not found");
        if (order.status !== 'active') throw new Error("Order is not active");

        // 1. PROCESS RETURNS (Mark everything as returned NOW)
        const items = await ctx.db
            .query("order_items")
            .withIndex("by_order", (q) => q.eq("order_id", args.id))
            .collect();

        // Fetch product types to identify rental items
        const productTypeIds = [...new Set(items.map(item => item.product_type))];
        const productTypes = await Promise.all(
            productTypeIds.map(id => ctx.db.get(id))
        );
        const typeMap = new Map(productTypes.filter(Boolean).map(t => [t!._id, t!]));

        for (const item of items) {
            const productType = typeMap.get(item.product_type);
            const isService = productType?.key === 'service';
            
            // Only process returns for rental items (not services)
            if (!isService) {
                const alreadyReturned = item.returned_quantity || 0;
                const remainingToReturn = item.quantity - alreadyReturned;

                if (remainingToReturn > 0) {
                    // Update Item History
                    await ctx.db.patch(item._id, {
                        returned_quantity: item.quantity,
                        return_history: [
                            ...(item.return_history || []),
                            { date: Date.now(), qty: remainingToReturn }
                        ]
                    });

                    // Restore Stock
                    const stockRecord = await ctx.db
                        .query("stock")
                        .withIndex("by_product_warehouse", (q) =>
                            q.eq("product", item.product).eq("warehouse", item.warehouse)
                        )
                        .unique();

                    let newQty = 0;
                    if (stockRecord) {
                        newQty = stockRecord.quantity + remainingToReturn;
                        await ctx.db.patch(stockRecord._id, { quantity: newQty });
                    } else {
                        newQty = remainingToReturn;
                        await ctx.db.insert("stock", {
                            product: item.product,
                            warehouse: item.warehouse,
                            quantity: newQty
                        });
                    }

                    // Log
                    await ctx.db.insert("stock_logs", {
                        product: item.product,
                        warehouse: item.warehouse,
                        delta: remainingToReturn,
                        resulting_quantity: newQty,
                        type: 'return',
                        reference_id: `ORD-${order.contract_number} (Final)`,
                        notes: 'Order completed (Auto-return)'
                    });
                }
            }
        }

        // 2. AUTO-GENERATE FINAL INVOICE
        // Determine the period start: It's the day AFTER the last invoice ended.
        const invoices = await ctx.db
            .query("invoices")
            .withIndex("by_order", q => q.eq("order_id", args.id))
            .collect();

        // Sort to find the latest invoice
        const lastInvoice = invoices.sort((a, b) => b.end_date - a.end_date)[0];

        let billingStart = order.start_date;
        if (lastInvoice) {
            // Start billing from the next day (roughly)
            // Using timestamps: Add 24 hours to last end date
            billingStart = lastInvoice.end_date + (24 * 60 * 60 * 1000);
        }

        const billingEnd = Date.now();

        // Check if there is a valid time window (avoid negative dates)
        // Only generate if billingStart is today or in the past
        if (billingStart <= billingEnd) {
            try {
                // We don't await the ID, just let it happen.
                // If it returns null (0 amount), that's fine.
                await generateInvoiceInternal(
                    ctx,
                    args.id,
                    billingStart,
                    billingEnd,
                    "System (Auto)" // ✅ Pass explicit string here
                );
            } catch (e) {
                console.error("Auto-invoice failed:", e);
                // We suppress error so the Order still completes
            }
        }

        // 3. CLOSE ORDER
        await ctx.db.patch(args.id, {
            status: 'completed',
            end_date: Date.now()
        });

        // Create notification
        const customer = await ctx.db.get(order.customer);
        await createNotification(
            ctx,
            'order_completed',
            `Užsakymas #${order.contract_number} užbaigtas`,
            `Klientas: ${customer?.label || 'Nežinomas'}`,
            args.id
        );
    },
});

export const returnPartial = mutation({
    args: {
        orderId: v.id("orders"),
        returns: v.array(v.object({
            itemId: v.id("order_items"),
            returnQty: v.number()
        }))
    },
    handler: async (ctx, args) => {
        const order = await ctx.db.get(args.orderId);
        if (!order) throw new Error("Order not found");
        if (order.status !== 'active') throw new Error("Order is not active");

        // Fetch product types once for all items
        const allItems = await ctx.db
            .query("order_items")
            .withIndex("by_order", q => q.eq("order_id", args.orderId))
            .collect();
        
        const productTypeIds = [...new Set(allItems.map(item => item.product_type))];
        const productTypes = await Promise.all(
            productTypeIds.map(id => ctx.db.get(id))
        );
        const typeMap = new Map(productTypes.filter(Boolean).map(t => [t!._id, t!]));

        // 1. PROCESS THE RETURNS (Existing Logic)
        for (const ret of args.returns) {
            if (ret.returnQty <= 0) continue;

            const item = await ctx.db.get(ret.itemId);
            if (!item) continue;
            
            const productType = typeMap.get(item.product_type);
            const isService = productType?.key === 'service';
            if (isService) continue;

            const currentReturned = item.returned_quantity || 0;
            const remaining = item.quantity - currentReturned;

            if (ret.returnQty > remaining) {
                throw new Error(`Cannot return ${ret.returnQty} of ${item.label}. Only ${remaining} out.`);
            }

            // Update Item History
            await ctx.db.patch(ret.itemId, {
                returned_quantity: currentReturned + ret.returnQty,
                return_history: [
                    ...(item.return_history || []),
                    { date: Date.now(), qty: ret.returnQty }
                ]
            });

            // Update Stock
            const stockRecord = await ctx.db
                .query("stock")
                .withIndex("by_product_warehouse", q =>
                    q.eq("product", item.product).eq("warehouse", item.warehouse)
                )
                .unique();

            let newQty = 0;
            if (stockRecord) {
                newQty = stockRecord.quantity + ret.returnQty;
                await ctx.db.patch(stockRecord._id, { quantity: newQty });
            } else {
                newQty = ret.returnQty;
                await ctx.db.insert("stock", {
                    product: item.product,
                    warehouse: item.warehouse,
                    quantity: newQty
                });
            }

            // Log
            await ctx.db.insert("stock_logs", {
                product: item.product,
                warehouse: item.warehouse,
                delta: ret.returnQty,
                resulting_quantity: newQty,
                type: 'return',
                reference_id: `ORD-${order.contract_number}`,
                notes: `Partial return (${ret.returnQty})`
            });
        }

        // 2. RE-FETCH ITEMS TO CHECK IF EVERYTHING IS RETURNED
        const updatedItems = await ctx.db
            .query("order_items")
            .withIndex("by_order", q => q.eq("order_id", args.orderId))
            .collect();

        const allReturned = updatedItems.every(item => {
            const productType = typeMap.get(item.product_type);
            const isService = productType?.key === 'service';
            if (isService) return true;
            return (item.returned_quantity || 0) >= item.quantity;
        });

        // ✅ NEW: IF ALL RETURNED -> AUTO INVOICE & COMPLETE
        if (allReturned) {

            // A. Determine Billing Period (Gap since last invoice)
            const invoices = await ctx.db
                .query("invoices")
                .withIndex("by_order", q => q.eq("order_id", args.orderId))
                .collect();

            const lastInvoice = invoices.sort((a, b) => b.end_date - a.end_date)[0];

            let billingStart = order.start_date;
            if (lastInvoice) {
                // Start from the day after the last invoice
                billingStart = lastInvoice.end_date + (24 * 60 * 60 * 1000);
            }
            const billingEnd = Date.now();

            // B. Generate Final Invoice
            if (billingStart <= billingEnd) {
                try {
                    await generateInvoiceInternal(
                        ctx,
                        args.orderId,
                        billingStart,
                        billingEnd,
                        "System (Auto)" // ✅ Pass explicit string here
                    );
                } catch (e) {
                    console.error("Auto-invoice on partial return failed (likely 0 amount):", e);
                }
            }

            // C. Close Order
            await ctx.db.patch(args.orderId, {
                status: 'completed',
                end_date: Date.now()
            });
        }
    },
});