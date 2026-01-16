// convex/documents.ts
import { action, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
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
                    products.push({ 
                        id: idStr, 
                        weight: p.weight_g || 0,
                        price: p.price || 0 // Include product price
                    });
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

            // C. Calculate Breakdown - this already returns grouped line items
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

            // E. Get order details
            const order = await ctx.runQuery(api.orders.get, { id: invoice.order_id });
            if (!order) throw new Error("Order not found");

            // F. Calculate days in period for unit display
            const days = Math.ceil((invoice.end_date - invoice.start_date) / (1000 * 60 * 60 * 24)) || 1;

            // G. Prepare Line Items for PDF - breakdown.lineItems are already grouped correctly
            const pdfLineItems = breakdown.lineItems.map((item, index) => {
                const subtotal = item.amount; // amount is the total without tax
                const taxAmount = Math.round(subtotal * (settings.tax_rate / 100));
                const totalWithTax = subtotal + taxAmount;

                // Determine unit based on item type
                const isGrouped = item.type === 'product_group';
                const vnt = isGrouped ? (days === 1 ? 'para' : 'paros') : 'vnt';

                return {
                    eil_nr: index + 1,
                    pavadinimas: item.label,
                    vnt: vnt,
                    kiekis: item.quantity.toString(),
                    kaina: (item.price / 100).toFixed(2),
                    suma_be_pvm: (subtotal / 100).toFixed(2),
                    suma_pvm: (taxAmount / 100).toFixed(2),
                    is_viso: (totalWithTax / 100).toFixed(2)
                };
            });

            // H. Calculate totals
            const subtotal = invoice.amount - invoice.tax_amount;
            const taxAmount = invoice.tax_amount;
            const total = invoice.amount;

            // I. Prepare Template Data with all required fields
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
            const templateHtml = await templateRes.text();
            const filledHtml = fillHtmlTemplate(templateHtml, templateData);

            // J. Convert to PDF
            const pdfBuffer = await convertHtmlToPdf(filledHtml, args.gotenbergUrl);

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

            // Get customer details - order already has customer populated
            const customer = order.customer;

            // Get all order items (don't filter by product_type for handover act)
            const orderItems = order.items || [];

            // Fetch product weights
            const productIds = orderItems.map((i: any) =>
                (i.product || i.product_id || i._id) as string
            );

            const productWeights = await ctx.runQuery(internal.documents.getProductWeights, {
                productIds: productIds
            });

            const weightMap = new Map();
            const priceMap = new Map();
            productWeights.forEach((p: any) => {
                weightMap.set(p.id, p.weight); // Keep in grams
                priceMap.set(p.id, p.price); // Product base price
            });

            let totalWeight = 0;
            let totalValue = 0;
            let totalDaily = 0;

            const mappedItems = orderItems.map((i: any) => {
                const idUsed = (i.product || i.product_id || i._id) as string;
                const weightGrams = weightMap.get(idUsed) || 0;
                const weightKg = weightGrams * 0.001; // Convert g to kg
                const itemWeight = weightKg * (i.quantity || 0);
                
                // Get the product's base price (unit price) from product definition
                const unitPrice = priceMap.get(idUsed) || i.price || 0;
                const totalItemValue = unitPrice * (i.quantity || 0);
                
                // Daily rate is what's charged per day (from order item or default to unit price)
                const dailyRate = i.daily_rate || i.price || 0;
                const totalItemDaily = dailyRate * (i.quantity || 0);
                
                totalWeight += itemWeight;
                totalValue += totalItemValue;
                totalDaily += totalItemDaily;

                return {
                    label: i.label || i.name || "",
                    quantity: i.quantity || 0,
                    weight_kg: itemWeight.toFixed(2),
                    unit_price: (unitPrice / 100).toFixed(2),
                    total_value: (totalItemValue / 100).toFixed(2),
                    daily_rate: (dailyRate / 100).toFixed(2),
                    total_daily: (totalItemDaily / 100).toFixed(2),
                };
            });

            const templateData = {
                // Seller Information
                seller_name: settings.business_name,
                seller_phone: settings.phone || '',
                seller_fax: settings.fax_number || '',
                work_hours: 'I – V 8:00 – 16:00', // Default, you can add to settings
                
                // Customer Information
                customer_name: customer?.label || "",
                customer_address: customer?.address || "",
                customer_imones_kodas: customer?.company_code || "",
                customer_pvm_kodas: customer?.vat_code || "",
                
                // Document Info
                date: new Date().toLocaleDateString('lt-LT'),
                contract_number: order.contract_number || "",
                
                // Items
                items: mappedItems,
                
                // Totals
                total_weight: totalWeight.toFixed(2),
                total_value_sum: (totalValue / 100).toFixed(2),
                total_daily_sum: (totalDaily / 100).toFixed(2),
                
                // Additional Info
                komplekto_kaina: (totalDaily / 100).toFixed(2),
                created_by: order.created_by || "",
                notes: order.notes || ""
            };

            console.log("Handover Act Template Data:", {
                itemsCount: mappedItems.length,
                items: mappedItems,
                totals: {
                    weight: totalWeight,
                    value: totalValue,
                    daily: totalDaily
                }
            });

            // PDF Generation Logic
            const templateUrl = await ctx.storage.getUrl(settings.act_template_id);
            if (!templateUrl) throw new Error("Template URL invalid");

            const templateRes = await fetch(templateUrl);
            const templateHtml = await templateRes.text();
            const filledHtml = fillHtmlTemplate(templateHtml, templateData);
            const pdfBuffer = await convertHtmlToPdf(filledHtml, args.gotenbergUrl);

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
    const templateHtml = await templateRes.text();
    const filledHtml = fillHtmlTemplate(templateHtml, templateData);
    const pdfBuffer = await convertHtmlToPdf(filledHtml, gotenbergUrl);

    const storageId = await ctx.storage.store(new Blob([pdfBuffer], { type: "application/pdf" }));
    return await ctx.storage.getUrl(storageId);
}

// ----------------------------------------------------------------------
// 4. UTILS (HTML Template & Gotenberg)
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

// Register Handlebars helpers
function fillHtmlTemplate(templateHtml: string, data: any): string {
    let html = templateHtml;
    
    // Process {{#each array}} blocks FIRST (before variable substitution)
    const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    html = html.replace(eachRegex, (match, arrayName, itemTemplate) => {
        const array = data[arrayName];
        if (!Array.isArray(array) || array.length === 0) return '';
        
        return array.map((item: any) => {
            let itemHtml = itemTemplate;
            // Replace all {{property}} in the item template
            for (const [key, value] of Object.entries(item)) {
                if (value !== null && value !== undefined) {
                    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                    itemHtml = itemHtml.replace(regex, String(value));
                }
            }
            return itemHtml;
        }).join('');
    });
    
    // Process {{#if variable}}...{{/if}} blocks
    const ifRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    html = html.replace(ifRegex, (match, varName, content) => {
        const value = data[varName];
        // Truthy check: show content if value exists and is not empty
        return (value && value !== '' && value !== false && value !== 0) ? content : '';
    });
    
    // Replace all remaining {{variable}} placeholders
    for (const [key, value] of Object.entries(data)) {
        if (value !== null && value !== undefined && !Array.isArray(value) && typeof value !== 'object') {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            html = html.replace(regex, String(value));
        }
    }
    
    // Clean up any unmatched placeholders (optional - removes {{unknown_var}})
    html = html.replace(/\{\{[\w_]+\}\}/g, '');
    
    return html;
}

async function convertHtmlToPdf(html: string, gotenbergUrl: string): Promise<ArrayBuffer> {
    const formData = new FormData();
    const htmlBlob = new Blob([html], { type: 'text/html' });
    formData.append("files", htmlBlob, "index.html");

    // Get credentials from Environment Variables
    const username = 'UQwijxzMsedVogKz';
    const password = 'tm75K0WoXncwfK4NR5Riz7mHqrnhVyMi';

    const headers: Record<string, string> = {};

    if (username && password) {
        const credentials = btoa(`${username}:${password}`);
        headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(`${gotenbergUrl}/forms/chromium/convert/html`, {
        method: "POST",
        headers: headers,
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Gotenberg failed (${response.status}): ${response.statusText}`);
    }

    return await response.arrayBuffer();
}