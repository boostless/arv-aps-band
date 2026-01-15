// convex/documents.ts
import { action, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { calculateInvoicePeriodCosts } from "./invoices";

// ----------------------------------------------------------------------
// 1. HELPERS (Internal Query & Mutation)
// ----------------------------------------------------------------------

// Internal Query: Calculates costs (callable by Action)
export const calculateBreakdown = internalQuery({
    args: { orderId: v.id("orders"), start: v.number(), end: v.number() },
    handler: async (ctx, args) => {
        return await calculateInvoicePeriodCosts(ctx, args.orderId, args.start, args.end);
    }
});

// Internal Mutation: Saves the PDF URL to the invoice (callable by Action)
export const savePdfUrl = internalMutation({
    args: {
        invoiceId: v.id("invoices"),
        url: v.string(),
        status: v.string() // 'ready' or 'failed'
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.invoiceId, {
            pdf_url: args.url,
            pdf_status: args.status
        });
    }
});

// ----------------------------------------------------------------------
// 2. PUBLIC MUTATION (The Trigger)
// ----------------------------------------------------------------------

export const requestInvoicePdf = mutation({
    args: {
        invoiceId: v.id("invoices"),
        gotenbergUrl: v.string() // You can also move this to settings if you prefer
    },
    handler: async (ctx, args) => {
        // 1. Update UI immediately to show spinner
        await ctx.db.patch(args.invoiceId, { pdf_status: "generating" });

        // 2. Schedule the heavy lifting (Action) to run immediately
        await ctx.scheduler.runAfter(0, api.documents.generatePdfAction, args);
    }
});

// ----------------------------------------------------------------------
// 3. ACTIONS (The Workers)
// ----------------------------------------------------------------------

export const generatePdfAction = action({
    args: {
        invoiceId: v.id("invoices"),
        gotenbergUrl: v.string(),
    },
    handler: async (ctx, args) => {
        try {
            // A. Fetch Settings to get Template ID
            const settings = await ctx.runQuery(api.settings.get);
            if (!settings?.invoice_template_id) {
                throw new Error("No invoice template found in Settings. Please upload one.");
            }
            const templateId = settings.invoice_template_id;

            // B. Fetch Invoice Data
            const invoice = await ctx.runQuery(api.invoices.get, { id: args.invoiceId });
            if (!invoice) throw new Error("Invoice not found");

            // C. Calculate Breakdown
            const breakdown = await ctx.runQuery(internal.documents.calculateBreakdown, {
                orderId: invoice.order_id,
                start: invoice.start_date,
                end: invoice.end_date
            });

            // D. Grouping Logic
            const pdfLineItems = [];
            let productTotal = 0;

            for (const item of breakdown.lineItems) {
                if (item.type === 'service') {
                    pdfLineItems.push({
                        label: item.label,
                        total: (item.amount / 100).toFixed(2)
                    });
                } else {
                    productTotal += item.amount;
                }
            }

            if (productTotal > 0) {
                pdfLineItems.push({
                    label: "Pastolių nuoma",
                    total: (productTotal / 100).toFixed(2)
                });
            }

            // E. Prepare Template Data
            const templateData = {
                invoice_number: invoice.invoice_number,
                date: new Date(invoice.start_date).toLocaleDateString('lt-LT'),
                due_date: new Date(invoice.due_date || Date.now()).toLocaleDateString('lt-LT'),
                customer_name: invoice.customer_name,
                customer_address: invoice.customer_address,
                customer_vat: invoice.customer_vat || "",
                seller_name: invoice.settings?.business_name,
                seller_address: invoice.settings?.address,
                seller_code: invoice.settings?.company_code,
                seller_vat: invoice.settings?.vat_code,
                seller_bank: invoice.settings?.banks?.[0]?.name,
                seller_iban: invoice.settings?.banks?.[0]?.iban,
                items: pdfLineItems, // Grouped items
                subtotal: ((invoice.amount - invoice.tax_amount) / 100).toFixed(2),
                tax: (invoice.tax_amount / 100).toFixed(2),
                total: (invoice.amount / 100).toFixed(2),
                created_by: invoice.created_by
            };

            // F. Fetch & Fill Template
            const templateUrl = await ctx.storage.getUrl(templateId);
            if (!templateUrl) throw new Error("Template file URL is invalid");

            const templateRes = await fetch(templateUrl);
            const filledDocx = await fillTemplate(await templateRes.arrayBuffer(), templateData);

            // G. Convert to PDF
            const pdfBuffer = await convertToPdf(filledDocx, args.gotenbergUrl);

            // H. Save PDF to Storage
            const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });
            const storageId = await ctx.storage.store(pdfBlob);
            const publicUrl = await ctx.storage.getUrl(storageId);

            // I. ✅ SAVE RESULT TO DB (Success)
            await ctx.runMutation(internal.documents.savePdfUrl, {
                invoiceId: args.invoiceId,
                url: publicUrl!,
                status: "ready"
            });

        } catch (err: any) {
            console.error("PDF Generation Error:", err);
            // J. ✅ SAVE FAILURE TO DB
            await ctx.runMutation(internal.documents.savePdfUrl, {
                invoiceId: args.invoiceId,
                url: "",
                status: "failed"
            });
        }
    }
});

// Handover Act Generation (Placeholder - you can update this to use settings later too)
export const generateHandoverAct = action({
    args: {
        orderId: v.id("orders"),
        gotenbergUrl: v.string(),
    },
    handler: async (ctx, args) => {
        // Fetch Settings
        const settings = await ctx.runQuery(api.settings.get);
        if (!settings?.act_template_id) {
            throw new Error("No Act template found in Settings");
        }

        const order = await ctx.runQuery(api.orders.get, { id: args.orderId });
        if (!order) throw new Error("Order not found");

        const templateData = {
            contract_number: order.contract_number,
            date: new Date().toLocaleDateString('lt-LT'),
            customer_name: order.customer?.label,
            
            // ✅ ADDED NOTES HERE
            // Make sure your .docx template has a {notes} tag to display this
            notes: order.notes || "", 

            items: order.items
                .filter((i: any) => i.product_type === 'product')
                .map((i: any) => ({
                    label: i.label,
                    qty: i.quantity,
                    code: i.code
                })),
            total_items: order.items.length
        };

        const templateUrl = await ctx.storage.getUrl(settings.act_template_id);
        if (!templateUrl) throw new Error("Template not found");

        const templateRes = await fetch(templateUrl);
        const filledDocx = await fillTemplate(await templateRes.arrayBuffer(), templateData);
        const pdfBuffer = await convertToPdf(filledDocx, args.gotenbergUrl);

        const storageId = await ctx.storage.store(new Blob([pdfBuffer], { type: "application/pdf" }));

        return await ctx.storage.getUrl(storageId);
    }
});
// ----------------------------------------------------------------------
// 4. UTILS (Docx & Gotenberg)
// ----------------------------------------------------------------------

async function fillTemplate(templateBuffer: ArrayBuffer, data: any) {
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
    });

    doc.render(data);

    // ✅ FIX: Use "uint8array" for Convex compatibility
    return doc.getZip().generate({
        type: "uint8array",
        compression: "DEFLATE",
    });
}

async function convertToPdf(docxBuffer: Uint8Array, gotenbergUrl: string) {
    const formData = new FormData();
    const blob = new Blob([docxBuffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    formData.append("files", blob, "document.docx");

    // ✅ NEW: Get credentials from Environment Variables
    const username = 'UQwijxzMsedVogKz'; // Best practice: Use env vars
    const password = 'tm75K0WoXncwfK4NR5Riz7mHqrnhVyMi';

    // Prepare headers
    const headers: Record<string, string> = {};

    // Only add auth if variables exist
    if (username && password) {
        // Create Basic Auth Header (base64 encoded)
        const credentials = btoa(`${username}:${password}`);
        headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(`${gotenbergUrl}/forms/libreoffice/convert`, {
        method: "POST",
        headers: headers, // ✅ Pass headers here
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Gotenberg failed (${response.status}): ${response.statusText}`);
    }

    return await response.arrayBuffer();
}