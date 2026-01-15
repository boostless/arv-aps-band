<script setup lang="ts">
import { api } from '~~/convex/_generated/api';
import type { Id } from '~~/convex/_generated/dataModel';

const route = useRoute();
const orderId = route.params.id as Id<'orders'>;

// NOTE: Make sure you export 'complete' from your API
const { mutate: completeOrder, isPending: isCompleting } = useConvexMutation(api.orders.complete);
const { trigger: showToast } = useSnackbar(); // Ensure you have this
const { mutate: returnPartial, isPending: isReturning } = useConvexMutation(api.orders.returnPartial);

// -- DATA --
const { data: invoice, isPending } = useConvexQuery(api.orders.get, { id: orderId });

const returnDialog = ref(false);
const returnForm = ref<{ itemId: Id<'order_items'>; label: string; max: number; current: number; input: number }[]>([]);

// -- UTILS --
function formatMoney(cents: number) {
    return (cents / 100).toFixed(2);
}

function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString('lt-LT');
}

async function handleComplete() {
    if (!confirm('Are you sure? This will return all items to stock and close the order.')) return;

    try {
        await completeOrder({ id: orderId });
        showToast('Order completed & stock returned', 'success');
    } catch (err: any) {
        showToast(err.toString().replace('Error: ', ''), 'error');
    }
}

function openReturnDialog() {
    if (!invoice.value) return;

    // Prepare the form with only un-returned products
    returnForm.value = invoice.value.items
        .filter(item => item.product_type === 'product' && (item.quantity - (item.returned_quantity || 0) > 0))
        .map(item => ({
            itemId: item._id,
            label: item.label,
            max: item.quantity,
            current: item.returned_quantity || 0,
            input: 0 // User types here
        }));

    returnDialog.value = true;
}

async function handleReturnSubmit() {
    // Filter out rows where user didn't type anything
    const returnsToSubmit = returnForm.value
        .filter(r => r.input > 0)
        .map(r => ({
            itemId: r.itemId,
            returnQty: r.input
        }));

    if (returnsToSubmit.length === 0) return;

    try {
        await returnPartial({
            orderId: orderId,
            returns: returnsToSubmit
        });
        showToast('Items returned successfully', 'success');
        returnDialog.value = false;
    } catch (err: any) {
        showToast(err.toString().replace('Error: ', ''), 'error');
    }
}
</script>

<template>
    <div v-if="invoice">
        <div class="d-flex align-center justify-space-between mb-6 no-print">
            <div class="d-flex align-center">
                <v-btn variant="text" icon="mdi-arrow-left" to="/orders" class="mr-2"></v-btn>
                <h1 class="text-h4 font-weight-bold">Order #{{ invoice.invoice_number }}</h1>
                <v-chip class="ml-4 text-uppercase" size="small" color="primary" variant="flat">
                    {{ invoice.status }}
                </v-chip>
            </div>
            <div>
                <v-btn variant="outlined" class="mr-2">
                    <v-icon start>mdi-printer</v-icon>
                    Print Invoice
                </v-btn>
                <v-btn class="mr-2" v-if="invoice?.status === 'active' && invoice?.type === 'rental'" color="success" variant="flat"
                    prepend-icon="mdi-check-circle-outline" :loading="isCompleting" @click="handleComplete">
                    Complete & Return
                </v-btn>
                <v-btn v-if="invoice?.status === 'active' && invoice?.type === 'rental'" color="orange-darken-2"
                    variant="outlined" class="mr-2" prepend-icon="mdi-keyboard-return" @click="openReturnDialog">
                    Return Items
                </v-btn>
            </div>
        </div>

        <v-card class="invoice-card pa-8" border flat>

            <v-row class="mb-8">
                <v-col cols="6">
                    <div class="text-h5 font-weight-bold mb-1">
                        {{ invoice.settings?.business_name || 'My Company' }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                        {{ invoice.settings?.address }}<br>
                        Code: {{ invoice.settings?.company_code }}<br>
                        VAT: {{ invoice.settings?.vat_code }}
                    </div>
                </v-col>
                <v-col cols="6" class="text-right">
                    <div class="text-h4 font-weight-black text-primary mb-1">INVOICE</div>
                    <div class="text-h6">#{{ invoice.invoice_number }}</div>
                    <div class="text-subtitle-1 text-grey">
                        Date: {{ formatDate(invoice.start_date) }}
                    </div>
                </v-col>
            </v-row>

            <v-divider class="mb-8"></v-divider>

            <v-row class="mb-8">
                <v-col cols="12">
                    <div class="text-caption text-uppercase font-weight-bold text-grey mb-2">Bill To</div>
                    <div class="text-h6">{{ invoice.customer?.label }}</div>
                    <div class="text-body-2 text-medium-emphasis">
                        {{ invoice.customer?.address }}<br>
                        {{ invoice.customer?.company_code ? `Code: ${invoice.customer.company_code}` : '' }}<br>
                        {{ invoice.customer?.vat_code ? `VAT: ${invoice.customer.vat_code}` : '' }}
                    </div>
                    <div class="mt-2 text-body-2">
                        <div v-if="invoice.customer?.email">Email: {{ invoice.customer.email }}</div>
                        <div v-if="invoice.customer?.phone">Phone: {{ invoice.customer.phone }}</div>
                    </div>
                </v-col>
            </v-row>

            <v-table class="mb-8" density="comfortable">
                <thead>
                    <tr>
                        <th class="text-left font-weight-bold">Description</th>
                        <th class="text-center font-weight-bold">Quantity</th>
                        <th class="text-right font-weight-bold">Unit Price</th>
                        <th class="text-right font-weight-bold">Disc %</th>
                        <th class="text-right font-weight-bold">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in invoice.items" :key="item._id">
                        <td class="py-2">
                            <div class="font-weight-medium">{{ item.label }}</div>
                            <div class="text-caption text-grey">{{ item.code }}</div>
                        </td>
                        <td class="text-center">
                            {{ item.quantity }}
                            <div v-if="item.returned_quantity" class="text-caption text-success font-weight-bold">
                                (Returned: {{ item.returned_quantity }})
                            </div>
                        </td>
                        <td class="text-right">€{{ formatMoney(item.price) }}</td>
                        <td class="text-right">{{ item.discount > 0 ? item.discount + '%' : '-' }}</td>
                        <td class="text-right font-weight-bold">€{{ formatMoney(item.total) }}</td>
                    </tr>
                </tbody>
            </v-table>

            <v-row>
                <v-col cols="6">
                    <div v-if="invoice.notes" class="bg-grey-lighten-5 pa-4 rounded">
                        <div class="text-caption font-weight-bold text-grey">Notes:</div>
                        <div class="text-body-2">{{ invoice.notes }}</div>
                    </div>

                    <div class="mt-6">
                        <div class="text-caption font-weight-bold text-grey mb-1">Payment Details:</div>
                        <div v-for="bank in invoice.settings?.banks" :key="bank.iban" class="text-body-2 mb-2">
                            <strong>{{ bank.name }}</strong><br>
                            IBAN: {{ bank.iban }} <span v-if="bank.swift">(SWIFT: {{ bank.swift }})</span>
                        </div>
                    </div>
                </v-col>

                <v-col cols="4" offset="2">
                    <div class="d-flex justify-space-between mb-2">
                        <span class="text-medium-emphasis">Subtotal</span>
                        <span class="font-weight-medium">€{{ formatMoney(invoice.total_amount - invoice.tax_amount)
                            }}</span>
                    </div>
                    <div class="d-flex justify-space-between mb-2">
                        <span class="text-medium-emphasis">VAT ({{ invoice.settings?.tax_rate }}%)</span>
                        <span class="font-weight-medium">€{{ formatMoney(invoice.tax_amount) }}</span>
                    </div>
                    <v-divider class="my-3"></v-divider>
                    <div class="d-flex justify-space-between text-h5 font-weight-bold bg-grey-lighten-4 pa-3 rounded">
                        <span>Total</span>
                        <span>€{{ formatMoney(invoice.total_amount) }}</span>
                    </div>
                </v-col>
            </v-row>

        </v-card>
    </div>
    <div v-else-if="isPending" class="d-flex justify-center align-center" style="height: 50vh;">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>
    <v-dialog v-model="returnDialog" max-width="600">
        <v-card>
            <v-card-title>Return Rental Items</v-card-title>
            <v-card-text>
                <v-table density="compact">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th class="text-center">Rented</th>
                            <th class="text-center">Returned</th>
                            <th class="text-center" style="width: 120px">Return Now</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in returnForm" :key="row.itemId">
                            <td>{{ row.label }}</td>
                            <td class="text-center">{{ row.max }}</td>
                            <td class="text-center text-medium-emphasis">{{ row.current }}</td>
                            <td>
                                <v-text-field v-model.number="row.input" type="number" variant="outlined"
                                    density="compact" hide-details min="0" :max="row.max - row.current"></v-text-field>
                            </td>
                        </tr>
                    </tbody>
                </v-table>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="returnDialog = false">Cancel</v-btn>
                <v-btn color="primary" variant="flat" :loading="isReturning" @click="handleReturnSubmit">
                    Confirm Return
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>