// convex/invoices.ts
import { mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { createNotification } from "./notifications";

// Helper to get next number
async function getNextInvoiceNumber(ctx: any) {
    const settings = await ctx.db.query("business_settings").first();
    if (!settings) throw new Error("Business Settings missing.");

    const num = settings.invoice_start_number || 1000;
    await ctx.db.patch(settings._id, { invoice_start_number: num + 1 });
    return num;
}

export async function calculateInvoicePeriodCosts(
    ctx: any,
    orderId: Id<"orders">,
    startDate: number,
    endDate: number
) {
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");

    const items = await ctx.db
        .query("order_items")
        .withIndex("by_order", (q: any) => q.eq("order_id", orderId))
        .collect();

    // Fetch product types to identify services
    const productTypeIds = [...new Set(items.map(item => item.product_type))];
    const productTypes = await Promise.all(
        productTypeIds.map(id => ctx.db.get(id))
    );
    const typeMap = new Map(productTypes.filter(Boolean).map((t: any) => [t!._id, t!]));

    const oneDayMs = 1000 * 60 * 60 * 24;
    const start = new Date(startDate).setHours(0, 0, 0, 0);
    const end = new Date(endDate).setHours(0, 0, 0, 0);

    const lineItems = [];

    for (const item of items) {
        const productType = typeMap.get(item.product_type);
        const isService = productType?.key === 'service';
        
        let lineTotal = 0;
        let effectiveQuantity = item.quantity;

        // A. Fixed Items (Services/Sales)
        // Check if the service falls within this invoice period (usually strictly once per order)
        // Logic: If invoice start date covers the order start date, we bill services.
        if (isService || order.type === 'sale') {
            if (start <= order.start_date && end >= order.start_date) {
                lineTotal = item.quantity * item.price * (1 - (item.discount / 100));
            }
        }
        // B. Rental Items
        else {
            let activeDays = 0;
            for (let d = start; d <= end; d += oneDayMs) {
                const returnsBeforeToday = (item.return_history || [])
                    .filter((ret: any) => ret.date < d)
                    .reduce((sum: number, ret: any) => sum + ret.qty, 0);

                const activeQty = Math.max(0, item.quantity - returnsBeforeToday);
                if (activeQty > 0) activeDays += activeQty; // Accumulate "Item-Days"
            }

            // Cost = Total Active Item-Days * Daily Price
            const dailyPrice = item.price * (1 - (item.discount / 100));
            lineTotal = activeDays * dailyPrice;
            effectiveQuantity = activeDays; // For rental, quantity is item-days
        }

        if (lineTotal > 0) {
            lineItems.push({
                label: item.label,
                type: item.product_type, // 'product' or 'service'
                quantity: effectiveQuantity,
                price: item.price,
                discount: item.discount || 0,
                amount: Math.round(lineTotal)
            });
        }
    }

    const totalExclTax = lineItems.reduce((sum, i) => sum + i.amount, 0);

    return { lineItems, totalExclTax };
}

// Internal function for auto-generating invoices (used by order completion)
export async function generateInvoiceInternal(
    ctx: any,
    orderId: Id<"orders">,
    startDate: number,
    endDate: number,
    createdBy: string
) {
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");

    const settings = await ctx.db.query("business_settings").first();
    if (!settings) throw new Error("Settings not configured");

    const customer = await ctx.db.get(order.customer);

    // Fetch order items
    const orderItems = await ctx.db
        .query("order_items")
        .withIndex("by_order", (q: any) => q.eq("order_id", orderId))
        .collect();

    // Fetch product types for grouping logic
    const productTypeIds = [...new Set(orderItems.map(item => item.product_type))];
    const productTypes = await Promise.all(
        productTypeIds.map(id => ctx.db.get(id))
    );
    const typeMap = new Map(productTypes.filter(Boolean).map((t: any) => [t!._id, t!]));

    // Calculate costs
    const oneDayMs = 1000 * 60 * 60 * 24;
    const start = new Date(startDate).setHours(0, 0, 0, 0);
    const end = new Date(endDate).setHours(0, 0, 0, 0);

    const lineItems = [];
    const groups: Record<string, number> = {};

    for (const item of orderItems) {
        const productType = typeMap.get(item.product_type);
        const isService = productType?.key === 'service';
        
        let lineTotal = 0;
        let effectiveQuantity = item.quantity;

        // A. Services (one-time charges)
        if (isService || order.type === 'sale') {
            if (startDate <= order.start_date && endDate >= order.start_date) {
                lineTotal = Math.round(item.quantity * item.price * (1 - (item.discount / 100)));
            }
        }
        // B. Rental items (daily cost)
        else {
            let activeDays = 0;
            for (let d = start; d <= end; d += oneDayMs) {
                const returnsBeforeToday = (item.returned_quantity || 0);
                const activeQty = Math.max(0, item.quantity - returnsBeforeToday);
                if (activeQty > 0) activeDays += activeQty;
            }
            const dailyPrice = item.price * (1 - (item.discount / 100));
            lineTotal = Math.round(activeDays * dailyPrice);
            effectiveQuantity = activeDays;
        }

        if (lineTotal > 0) {
            if (!isService && order.type === 'rental') {
                const groupLabel = productType?.label || 'Unknown';
                groups[groupLabel] = (groups[groupLabel] || 0) + lineTotal;
            } else {
                lineItems.push({
                    label: item.label,
                    quantity: effectiveQuantity,
                    price: item.price,
                    total: lineTotal,
                    type: productType?.key || 'service'
                });
            }
        }
    }

    // Add grouped items
    for (const [label, amount] of Object.entries(groups)) {
        if (amount > 0) {
            lineItems.push({
                label: `${label} nuoma`,
                quantity: 1,
                price: amount,
                total: amount,
                type: 'product_group'
            });
        }
    }

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const taxRate = settings.tax_rate || 21;
    const taxAmount = Math.round(subtotal * (taxRate / 100));
    const totalAmount = subtotal + taxAmount;

    if (totalAmount <= 0) return null; // Don't create zero-amount invoices

    // Generate invoice number
    const invoiceNumber = await getNextInvoiceNumber(ctx);
    const dueDays = settings.invoice_due_days || 14;
    const dueDate = Date.now() + (dueDays * oneDayMs);

    // Create invoice with snapshot
    const invoiceId = await ctx.db.insert("invoices", {
        order_id: orderId,
        invoice_number: invoiceNumber,

        start_date: startDate,
        end_date: endDate,
        due_date: dueDate,

        amount: totalAmount,
        tax_amount: taxAmount,

        customer_id: customer?._id,
        customer_name: customer?.label || 'Unknown Customer',
        customer_address: customer?.address || '',
        customer_vat: customer?.vat_code,

        items: lineItems,

        created_by: createdBy,
        status: 'unpaid',
        pdf_status: 'pending'
    });

    return invoiceId;
}

// CREATE INVOICE WITH SNAPSHOT APPROACH
export const create = mutation({
    args: {
        order_id: v.id("orders"),
        start_date: v.number(),
        end_date: v.number(),
        created_by: v.string()
    },
    handler: async (ctx, args) => {
        // 1. FETCH DEPENDENCIES
        const settings = await ctx.db.query("business_settings").first();
        if (!settings) throw new Error("Settings not configured. Please complete business settings.");

        const order = await ctx.db.get(args.order_id);
        if (!order) throw new Error("Order not found");

        const customer = await ctx.db.get(order.customer);

        // 2. FETCH ORDER ITEMS
        const orderItems = await ctx.db
            .query("order_items")
            .withIndex("by_order", (q) => q.eq("order_id", args.order_id))
            .collect();

        // 3. FETCH PRODUCT TYPES FOR GROUPING LOGIC
        const productTypeIds = [...new Set(orderItems.map(item => item.product_type))];
        const productTypes = await Promise.all(
            productTypeIds.map(id => ctx.db.get(id))
        );
        const typeMap = new Map(productTypes.filter(Boolean).map(t => [t!._id, t!]));

        // 4. CALCULATE COSTS FOR THE BILLING PERIOD
        const oneDayMs = 1000 * 60 * 60 * 24;
        const start = new Date(args.start_date).setHours(0, 0, 0, 0);
        const end = new Date(args.end_date).setHours(0, 0, 0, 0);

        const lineItems = [];
        const groups: Record<string, number> = {}; // Group by product type label

        for (const item of orderItems) {
            const productType = typeMap.get(item.product_type);
            // "service" is the reserved key for non-rental items (one-time charges)
            const isService = productType?.key === 'service';
            
            let lineTotal = 0;
            let effectiveQuantity = item.quantity;

            // A. Fixed Items (Services/One-time items)
            if (isService || order.type === 'sale') {
                // Bill services only once in the period that includes the order start date
                if (args.start_date <= order.start_date && args.end_date >= order.start_date) {
                    lineTotal = Math.round(item.quantity * item.price * (1 - (item.discount / 100)));
                }
            }
            // B. Rental Items (Calculate daily cost)
            else {
                let activeDays = 0;
                for (let d = start; d <= end; d += oneDayMs) {
                    const returnsBeforeToday = (item.returned_quantity || 0);
                    const activeQty = Math.max(0, item.quantity - returnsBeforeToday);
                    if (activeQty > 0) activeDays += activeQty;
                }
                const dailyPrice = item.price * (1 - (item.discount / 100));
                lineTotal = Math.round(activeDays * dailyPrice);
                effectiveQuantity = activeDays;
            }

            if (lineTotal > 0) {
                // Group rental products by type
                if (!isService && order.type === 'rental') {
                    const groupLabel = productType?.label || 'Unknown';
                    groups[groupLabel] = (groups[groupLabel] || 0) + lineTotal;
                } else {
                    // Show services individually
                    lineItems.push({
                        label: item.label,
                        quantity: effectiveQuantity,
                        price: item.price,
                        total: lineTotal,
                        type: productType?.key || 'service'
                    });
                }
            }
        }

        // Add grouped items
        for (const [label, amount] of Object.entries(groups)) {
            if (amount > 0) {
                lineItems.push({
                    label: `${label} nuoma`,
                    quantity: 1,
                    price: amount,
                    total: amount,
                    type: 'product_group'
                });
            }
        }

        // 5. CALCULATE TOTALS
        const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
        const taxRate = settings.tax_rate || 21;
        const taxAmount = Math.round(subtotal * (taxRate / 100));
        const totalAmount = subtotal + taxAmount;

        if (totalAmount <= 0) {
            throw new Error("Cannot create invoice with zero amount");
        }

        // 6. GENERATE INVOICE NUMBER
        const invoiceNumber = await getNextInvoiceNumber(ctx);
        const dueDays = settings.invoice_due_days || 14;
        const dueDate = Date.now() + (dueDays * oneDayMs);

        // 7. CREATE INVOICE WITH SNAPSHOT
        const invoiceId = await ctx.db.insert("invoices", {
            order_id: args.order_id,
            invoice_number: invoiceNumber,

            // Period
            start_date: args.start_date,
            end_date: args.end_date,
            due_date: dueDate,

            // Financials (Snapshot)
            amount: totalAmount,
            tax_amount: taxAmount,

            // Customer Snapshot (For historical accuracy)
            customer_id: customer?._id,
            customer_name: customer?.label || 'Unknown Customer',
            customer_address: customer?.address || '',
            customer_vat: customer?.vat_code,

            // Line Items Snapshot
            items: lineItems,

            // Metadata
            created_by: args.created_by,
            status: 'unpaid',
            pdf_status: 'pending'
        });

        // Create notification
        await createNotification(
            ctx,
            'invoice_created',
            `Sąskaita #${invoiceNumber} sukurta`,
            `Pagal užsakymą #${order.contract_number}`,
            args.order_id,
            invoiceId
        );

        return invoiceId;
    },
});

export const updateInvoiceLineItems = mutation({
    args: {
        invoiceId: v.id("invoices"),
        items: v.array(v.object({ /* ... same shape ... */ }))
    },
    handler: async (ctx, args) => {
        // Recalculate total
        const newTotal = args.items.reduce((sum, item) => sum + item.total, 0);

        await ctx.db.patch(args.invoiceId, {
            items: args.items,
            saved_total: newTotal
        });
    }
});

// GET INVOICE WITH PAYMENTS
export const get = query({
    args: { id: v.id("invoices") },
    handler: async (ctx, args) => {
        const invoice = await ctx.db.get(args.id);
        if (!invoice) return null;

        // 1. Fetch Payments
        const payments = await ctx.db
            .query("payments")
            .withIndex("by_invoice", q => q.eq("invoice_id", args.id))
            .collect();

        const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);

        // 2. Fetch Business Settings (For the "From" section)
        const settings = await ctx.db.query("business_settings").first();

        // 3. Fetch Customer via the Order (For the "Bill To" section)
        const order = await ctx.db.get(invoice.order_id);
        let customer = null;
        if (order) {
            customer = await ctx.db.get(order.customer);
        }

        return {
            ...invoice,
            payments,
            paidAmount,
            settings,
            customer,
            lineItems: invoice.items || [] // Use snapshot items
        };
    }
});

export const list = query({
    args: {},
    handler: async (ctx) => {
        // 1. Get all invoices (Newest first)
        const invoices = await ctx.db.query("invoices").order("desc").collect();

        // 2. Join Customer & Payment Data
        const invoicesWithDetails = await Promise.all(
            invoices.map(async (inv) => {
                // Get Order -> Customer
                const order = await ctx.db.get(inv.order_id);
                const customer = order ? await ctx.db.get(order.customer) : null;

                // Get Payments (to verify "Paid" status accurately)
                const payments = await ctx.db
                    .query("payments")
                    .withIndex("by_invoice", (q) => q.eq("invoice_id", inv._id))
                    .collect();

                const paid = payments.reduce((sum, p) => sum + p.amount, 0);

                return {
                    ...inv,
                    customerName: customer?.label || "Unknown Customer",
                    paidAmount: paid,
                    remainingAmount: inv.amount - paid,
                    isOverdue: inv.status === 'unpaid' && Date.now() > inv.end_date
                };
            })
        );

        return invoicesWithDetails;
    },
});

export const voidInvoice = mutation({
    args: { id: v.id("invoices") },
    handler: async (ctx, args) => {
        const invoice = await ctx.db.get(args.id);
        if (!invoice) throw new Error("Invoice not found");

        // 1. Safety Check: Don't void if money has been taken
        const payments = await ctx.db
            .query("payments")
            .withIndex("by_invoice", q => q.eq("invoice_id", args.id))
            .collect();

        if (payments.length > 0) {
            throw new Error("Cannot void an invoice with recorded payments. Delete payments first.");
        }

        // 2. Mark as Void
        await ctx.db.patch(args.id, { status: 'void' });
    }
});