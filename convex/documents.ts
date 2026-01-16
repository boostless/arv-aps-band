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

export const getProductWeights = internalQuery({
    // ✅ FIX: Use v.string() so it doesn't crash on "order_items" IDs
    args: { productIds: v.array(v.string()) },
    handler: async (ctx, args) => {
        const products = [];
        for (const idStr of args.productIds) {
            // ✅ FIX: Check if this string is a valid ID for "products" table
            const productId = ctx.db.normalizeId("products", idStr);

            if (productId) {
                const p = await ctx.db.get(productId);
                if (p) {
                    products.push({ id: idStr, weight: p.weight_g || 0 }); // Use original ID string for mapping
                }
            }
        }
        return products;
    }
});

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

            // D. Fetch customer details
            const customerData = invoice.customer_id 
                ? await ctx.runQuery(api.customers.get, { id: invoice.customer_id })
                : null;
            const customer = customerData?.customer;

            // E. Prepare Line Items for PDF with full details
            const pdfLineItems = breakdown.lineItems.map((item, index) => {
                const subtotal = item.amount;
                const taxAmount = Math.round(subtotal * (settings.tax_rate / 100));
                const totalWithTax = subtotal + taxAmount;

                return {
                    eil_nr: index + 1,                           // Line number
                    pavadinimas: item.label,                     // Item name
                    vnt: 'vnt',                                  // Unit (you may want to add this to item)
                    kiekis: item.quantity.toString(),            // Quantity
                    kaina: (item.price / 100).toFixed(2),        // Price per unit
                    suma: (subtotal / 100).toFixed(2),           // Amount without VAT
                    suma_be_pvm: (subtotal / 100).toFixed(2),    // Amount without VAT
                    suma_pvm: (taxAmount / 100).toFixed(2),      // VAT amount
                    is_viso: (totalWithTax / 100).toFixed(2)     // Total with VAT
                };
            });

            // F. Calculate totals
            const subtotal = invoice.amount - invoice.tax_amount;
            const taxAmount = invoice.tax_amount;
            const total = invoice.amount;

            // G. Get order details for period and location
            const order = await ctx.runQuery(api.orders.get, { id: invoice.order_id });

            // H. Prepare Template Data with all required fields
            const templateData = {
                // Business Information
                seller_name: settings.business_name,
                seller_address: settings.address,
                seller_phone: settings.phone || '',
                seller_fax: settings.fax_number || '',
                seller_imones_kodas: settings.company_code,      // Company code
                seller_pvm_kodas: settings.vat_code || '',       // VAT code
                
                // All bank accounts
                banks: settings.banks || [],
                seller_bank_1_name: settings.banks?.[0]?.name || '',
                seller_bank_1_iban: settings.banks?.[0]?.iban || '',
                seller_bank_2_name: settings.banks?.[1]?.name || '',
                seller_bank_2_iban: settings.banks?.[1]?.iban || '',

                // Customer Information
                customer_name: customer?.label || invoice.customer_name,
                customer_address: customer?.address || invoice.customer_address,
                customer_imones_kodas: customer?.company_code || '',  // Company code
                customer_pvm_kodas: customer?.vat_code || invoice.customer_vat || '',  // VAT code

                // Invoice Info
                invoice_number: invoice.invoice_number.toString(),
                israsymo_data: new Date(invoice.start_date).toLocaleDateString('lt-LT'),  // Issue date
                apmoketi_iki: new Date(invoice.due_date || Date.now()).toLocaleDateString('lt-LT'),  // Payment due date

                // Line Items
                items: pdfLineItems,

                // Totals
                suma_be_pvm: (subtotal / 100).toFixed(2),        // Total without VAT
                suma_pvm: (taxAmount / 100).toFixed(2),          // Total VAT
                is_viso: (total / 100).toFixed(2),               // Grand total

                // Additional Info
                saskaitos_periodas: `${new Date(invoice.start_date).toLocaleDateString('lt-LT')} - ${new Date(invoice.end_date).toLocaleDateString('lt-LT')}`,  // Invoice period
                objekto_adresas: customer?.address || invoice.customer_address || '',  // Object address
                created_by: invoice.created_by || '',             // Who created invoice
                
                // Amount in words (Lithuanian)
                suma_zodziais: numberToLithuanianWords(total)
            };

            // I. Fetch & Fill Template
            const templateUrl = await ctx.storage.getUrl(templateId);
            if (!templateUrl) throw new Error("Template file URL is invalid");

            const templateRes = await fetch(templateUrl);
            const filledDocx = await fillTemplate(await templateRes.arrayBuffer(), templateData);

            // J. Convert to PDF
            const pdfBuffer = await convertToPdf(filledDocx, args.gotenbergUrl);

            // K. Save PDF to Storage
            const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });
            const storageId = await ctx.storage.store(pdfBlob);
            const publicUrl = await ctx.storage.getUrl(storageId);

            // L. ✅ SAVE RESULT TO DB (Success)
            await ctx.runMutation(internal.documents.savePdfUrl, {
                invoiceId: args.invoiceId,
                url: publicUrl!,
                status: "ready"
            });

        } catch (err: any) {
            console.error("PDF Generation Error:", err);
            // M. ✅ SAVE FAILURE TO DB
            await ctx.runMutation(internal.documents.savePdfUrl, {
                invoiceId: args.invoiceId,
                url: "",
                status: "failed"
            });
        }
    }
});

// Handover Act Generation (Placeholder - you can update this to use settings later too)
export const saveActPdfUrl = internalMutation({
    args: {
        orderId: v.id("orders"),
        url: v.string(),
        status: v.string()
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.orderId, {
            act_pdf_url: args.url,
            act_pdf_status: args.status
        });
    }
});

// 2. TRIGGER MUTATION (Frontend calls this)
export const requestHandoverAct = mutation({
    args: {
        orderId: v.id("orders"),
        gotenbergUrl: v.string(),
    },
    handler: async (ctx, args) => {
        // Update UI state immediately
        await ctx.db.patch(args.orderId, { act_pdf_status: "generating" });

        // Schedule background work
        await ctx.scheduler.runAfter(0, api.documents.generateHandoverActAction, args);
    }
});

// 3. WORKER ACTION (Runs in background)
export const generateHandoverActAction = action({
    args: {
        orderId: v.id("orders"),
        gotenbergUrl: v.string(),
    },
    handler: async (ctx, args) => {
        try {
            const settings = await ctx.runQuery(api.settings.get);
            if (!settings?.act_template_id) throw new Error("No Act template in Settings");

            const order = await ctx.runQuery(api.orders.get, { id: args.orderId });
            if (!order) throw new Error("Order not found");

            const physicalItems = order.items.filter((i: any) => i.product_type === 'product');

            // ✅ FIX: Try 'product' AND 'product_id'
            // We cast to string because our helper now accepts strings
            const productIds = physicalItems.map((i: any) =>
                (i.product || i.product_id || i._id) as string
            );

            // Fetch real weights
            const productWeights = await ctx.runQuery(internal.documents.getProductWeights, {
                productIds: productIds
            });

            // Map: { "productId": 15.5 }
            const weightMap = new Map();
            productWeights.forEach((p: any) => weightMap.set(p.id, p.weight * 0.001)); // Convert g to kg

            let totalWeight = 0;

            const mappedItems = physicalItems.map((i: any) => {
                // Determine which ID was used to fetch the weight
                const idUsed = (i.product || i.product_id || i._id) as string;
                const realWeight = weightMap.get(idUsed) || 0;

                totalWeight += (realWeight * i.quantity);

                return {
                    label: i.label,
                    qty: i.quantity,
                    code: i.code,
                    weight: realWeight.toFixed(2),
                };
            });

            const templateData = {
                contract_number: order.contract_number,
                date: new Date().toLocaleDateString('lt-LT'),
                customer_name: order.customer?.label || "",
                customer_phone: order.customer?.phone || "",
                notes: order.notes || "",
                items: mappedItems,
                total_items: mappedItems.length,
                total_weight: totalWeight.toFixed(2)
            };

            // ... (PDF Generation Logic remains the same) ...
            const templateUrl = await ctx.storage.getUrl(settings.act_template_id);
            if (!templateUrl) throw new Error("Template URL invalid");

            const templateRes = await fetch(templateUrl);
            const filledDocx = await fillTemplate(await templateRes.arrayBuffer(), templateData);
            const pdfBuffer = await convertToPdf(filledDocx, args.gotenbergUrl);

            const storageId = await ctx.storage.store(new Blob([pdfBuffer], { type: "application/pdf" }));
            const publicUrl = await ctx.storage.getUrl(storageId);

            await ctx.runMutation(internal.documents.saveActPdfUrl, {
                orderId: args.orderId,
                url: publicUrl!,
                status: "ready"
            });

        } catch (err: any) {
            console.error("Act Generation Error:", err);
            await ctx.runMutation(internal.documents.saveActPdfUrl, {
                orderId: args.orderId,
                url: "",
                status: "failed"
            });
        }
    }
});

async function generateInvoicePdfLogic(ctx: any, invoiceId: any, gotenbergUrl: string, isPreview: boolean) {
    // 1. Fetch Basic Data
    const settings = await ctx.runQuery(api.settings.get);
    if (!settings?.invoice_template_id) throw new Error("No invoice template found");

    const invoice = await ctx.runQuery(api.invoices.get, { id: invoiceId });
    if (!invoice) throw new Error("Invoice not found");

    const order = await ctx.runQuery(api.orders.get, { id: invoice.order_id });
    if (!order) throw new Error("Order not found");

    // 2. Fetch Types & Create Lookup Map
    // We need to know: Type ID -> { key: "service", label: "Paslauga" }
    const allTypes = await ctx.db.query("product_types").collect();
    const typeMap = new Map();
    allTypes.forEach((t: any) => typeMap.set(t._id, t));

    // 3. Fetch Products to find their Type
    // We need to know: Product ID -> Type Info
    const productIds = order.items.map((i: any) => i.product || i.product_id).filter(Boolean);

    // Fetch all products involved (using the helper we made earlier or direct get)
    const productTypeLookup = new Map(); // Maps Product Name -> Type Object

    for (const id of productIds) {
        // Handle both ID types just in case
        const normalizedId = ctx.db.normalizeId("products", id as string);
        if (normalizedId) {
            const p = await ctx.db.get(normalizedId);
            if (p && p.type) {
                // p.type is the ID of the product_type
                const typeInfo = typeMap.get(p.type);
                if (typeInfo) {
                    productTypeLookup.set(p.name, typeInfo);
                }
            }
        }
    }

    // 4. Calculate Financial Breakdown (The Money)
    const breakdown = await ctx.runQuery(internal.documents.calculateBreakdown, {
        orderId: invoice.order_id,
        start: invoice.start_date,
        end: invoice.end_date
    });

    // 5. GROUPING LOGIC (The Magic)
    const pdfLineItems = [];
    const groups: Record<string, number> = {}; // { "Fasadiniai pastoliai": 150.00, "Moduliniai": 200.00 }

    for (const item of breakdown.lineItems) {
        // Try to find the type for this item
        const typeInfo = productTypeLookup.get(item.label);

        // Logic: Is it a Service?
        const isService = typeInfo?.key === 'service';

        if (isService) {
            // SCENARIO A: It is a Service -> SHOW FULL NAME
            pdfLineItems.push({
                label: item.label, // e.g., "Montavimo darbai"
                total: (item.amount / 100).toFixed(2),
                weight: "-"
            });
        } else {
            // SCENARIO B: It is a Product -> GROUP IT
            // Use the Type Label as the group name (e.g., "Fasadiniai pastoliai")
            // Fallback to "Pastoliai" if type is missing
            const groupName = typeInfo?.label || "Pastoliai";

            if (!groups[groupName]) groups[groupName] = 0;
            groups[groupName] += item.amount;
        }
    }

    // 6. Add Groups to PDF Lines
    for (const [label, amount] of Object.entries(groups)) {
        if (amount > 0) {
            pdfLineItems.push({
                label: `${label} nuoma`, // e.g. "Fasadiniai pastoliai nuoma"
                total: (amount / 100).toFixed(2),
                weight: "" // You can calculate total weight per group if you want, but usually left blank on invoice
            });
        }
    }

    // 7. Calculate Discount & Totals
    const subtotal = (invoice.amount - invoice.tax_amount) / 100;
    const discountVal = invoice.discount || 0;

    // Calculate Total Weight (Optional, for the bottom summary)
    let totalWeight = 0;
    // ... (Your existing weight calculation logic here) ...

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

        // ✅ OUR NEW GROUPED ITEMS
        items: pdfLineItems,

        subtotal: subtotal.toFixed(2),
        discount: (discountVal / 100).toFixed(2),
        tax: (invoice.tax_amount / 100).toFixed(2),
        total: (invoice.amount / 100).toFixed(2),
        created_by: invoice.created_by
    };

    // 8. Generate & Store
    const templateUrl = await ctx.storage.getUrl(settings.invoice_template_id);
    const templateRes = await fetch(templateUrl);
    const filledDocx = await fillTemplate(await templateRes.arrayBuffer(), templateData);
    const pdfBuffer = await convertToPdf(filledDocx, gotenbergUrl);

    const storageId = await ctx.storage.store(new Blob([pdfBuffer], { type: "application/pdf" }));
    return await ctx.storage.getUrl(storageId);
}
// ----------------------------------------------------------------------
// 4. UTILS (Docx & Gotenberg)
// ----------------------------------------------------------------------

function numberToLithuanianWords(cents: number): string {
    const euros = Math.floor(cents / 100);
    const centsPart = cents % 100;

    const ones = ['', 'vienas', 'du', 'trys', 'keturi', 'penki', 'šeši', 'septyni', 'aštuoni', 'devyni'];
    const teens = ['dešimt', 'vienuolika', 'dvylika', 'trylika', 'keturiolika', 'penkiolika', 
                   'šešiolika', 'septyniolika', 'aštuoniolika', 'devyniolika'];
    const tens = ['', '', 'dvidešimt', 'trisdešimt', 'keturiasdešimt', 'penkiasdešimt', 
                  'šešiasdešimt', 'septyniasdešimt', 'aštuoniasdešimt', 'devyniasdešimt'];
    const hundreds = ['', 'vienas šimtas', 'du šimtai', 'trys šimtai', 'keturi šimtai', 
                      'penki šimtai', 'šeši šimtai', 'septyni šimtai', 'aštuoni šimtai', 'devyni šimtai'];

    function convertUpTo999(num: number): string {
        if (num === 0) return '';
        
        const h = Math.floor(num / 100);
        const remainder = num % 100;
        const t = Math.floor(remainder / 10);
        const o = remainder % 10;

        let result = '';
        
        if (h > 0) {
            result += hundreds[h];
        }
        
        if (remainder >= 10 && remainder < 20) {
            result += (result ? ' ' : '') + teens[remainder - 10];
        } else {
            if (t > 0) {
                result += (result ? ' ' : '') + tens[t];
            }
            if (o > 0) {
                result += (result ? ' ' : '') + ones[o];
            }
        }
        
        return result;
    }

    function getEuroWord(n: number): string {
        if (n === 1) return 'euras';
        if (n % 10 === 0 || n % 100 >= 11 && n % 100 <= 19) return 'eurų';
        return 'eurai';
    }

    function getCentWord(n: number): string {
        if (n === 1) return 'centas';
        if (n % 10 === 0 || n % 100 >= 11 && n % 100 <= 19) return 'centų';
        return 'centai';
    }

    let result = '';

    // Handle thousands
    const thousands = Math.floor(euros / 1000);
    const remainder = euros % 1000;

    if (thousands > 0) {
        const thousandWords = convertUpTo999(thousands);
        result += thousandWords;
        
        if (thousands === 1) {
            result += ' tūkstantis';
        } else if (thousands % 10 === 0 || thousands % 100 >= 11 && thousands % 100 <= 19) {
            result += ' tūkstančių';
        } else {
            result += ' tūkstančiai';
        }
    }

    if (remainder > 0 || thousands === 0) {
        const remainderWords = convertUpTo999(remainder);
        if (remainderWords) {
            result += (result ? ' ' : '') + remainderWords;
        } else if (euros === 0) {
            result = 'nulis';
        }
    }

    result += ' ' + getEuroWord(euros);

    // Add cents
    if (centsPart > 0) {
        result += ' ' + centsPart.toString().padStart(2, '0') + ' ' + getCentWord(centsPart);
    }

    return result.charAt(0).toUpperCase() + result.slice(1);
}

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
    // Convert Uint8Array to proper ArrayBuffer for Blob
    const arrayBuffer = docxBuffer.buffer.slice(docxBuffer.byteOffset, docxBuffer.byteOffset + docxBuffer.byteLength) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
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