<script setup lang="ts">
import { api } from '~~/convex/_generated/api';
import type { Id } from '~~/convex/_generated/dataModel';

const route = useRoute();
const orderId = route.params.id as Id<'orders'>;
const { trigger: showToast } = useSnackbar();

// -- QUERIES --
const { data: contract, isPending } = useConvexQuery(api.orders.get, { id: orderId });

// -- MUTATIONS --
const { mutate: completeOrder, isPending: isCompleting } = useConvexMutation(api.orders.complete);
const { mutate: returnPartial, isPending: isReturning } = useConvexMutation(api.orders.returnPartial);
const { mutate: createInvoice, isPending: isGenerating } = useConvexMutation(api.invoices.create);
const { mutate: addPayment, isPending: isPaying } = useConvexMutation(api.payments.add);

// -- DIALOG STATES --
const returnDialog = ref(false);
const payDialog = ref(false);
const genInvoiceDialog = ref(false);

// -- FORMS --
const returnForm = ref<{ itemId: Id<'order_items'>; label: string; max: number; current: number; input: number }[]>([]);
const payForm = ref({ invoiceId: null as Id<'invoices'> | null, amountDisplay: 0, method: 'bank', notes: '' });
const genInvoiceForm = ref({
    start_date: new Date().toISOString().substr(0, 10),
    end_date: new Date().toISOString().substr(0, 10)
});

// -- UTILS --
function formatMoney(cents: number) {
    return (cents / 100).toFixed(2);
}

function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString('lt-LT');
}

// -- ACTIONS: STOCK --
async function handleComplete() {
    if (!confirm('Are you sure? This will return all items to stock and close the contract.')) return;
    try {
        await completeOrder({ id: orderId });
        showToast('Contract completed & stock returned', 'success');
    } catch (err: any) {
        showToast(err.toString().replace('Error: ', ''), 'error');
    }
}

function openReturnDialog() {
    if (!contract.value) return;
    returnForm.value = contract.value.items
        .filter(item => item.product_type === 'product' && (item.quantity - (item.returned_quantity || 0) > 0))
        .map(item => ({
            itemId: item._id,
            label: item.label,
            max: item.quantity,
            current: item.returned_quantity || 0,
            input: 0
        }));
    returnDialog.value = true;
}

async function handleReturnSubmit() {
    const returnsToSubmit = returnForm.value.filter(r => r.input > 0).map(r => ({
        itemId: r.itemId,
        returnQty: r.input
    }));
    if (returnsToSubmit.length === 0) return;

    try {
        await returnPartial({ orderId: orderId, returns: returnsToSubmit });
        showToast('Items returned successfully', 'success');
        returnDialog.value = false;
    } catch (err: any) {
        showToast(err.toString().replace('Error: ', ''), 'error');
    }
}

// -- ACTIONS: INVOICING --
function openGenerateInvoiceDialog() {
    if (!contract.value) return;
    // Auto-suggest dates: Start = Contract Start OR Last Invoice End + 1 Day
    // For MVP just defaulting to Today
    genInvoiceForm.value.start_date = new Date(contract.value.start_date).toISOString().substr(0, 10);
    genInvoiceForm.value.end_date = new Date().toISOString().substr(0, 10);
    genInvoiceDialog.value = true;
}

async function handleGenerateInvoice() {
    try {
        await createInvoice({
            order_id: orderId,
            start_date: new Date(genInvoiceForm.value.start_date).getTime(),
            end_date: new Date(genInvoiceForm.value.end_date).getTime()
        });
        showToast('Invoice generated', 'success');
        genInvoiceDialog.value = false;
    } catch (err: any) {
        showToast(err.toString().replace('Error: ', ''), 'error');
    }
}

// -- ACTIONS: PAYMENT --
function openPaymentDialog(invoice: any) {
    // Determine remaining balance
    // Note: Our query returns 'payments' array inside the invoice object? 
    // If api.orders.get returns basic invoices, we might not know the exact balance here 
    // without the logic from customers.ts.
    // For now, let's assume we pay the full amount or user types it.

    payForm.value.invoiceId = invoice._id;
    payForm.value.amountDisplay = invoice.amount / 100; // Default to full amount
    payDialog.value = true;
}

async function handlePayment() {
    if (!payForm.value.invoiceId || payForm.value.amountDisplay <= 0) return;

    await addPayment({
        invoice_id: payForm.value.invoiceId,
        amount: Math.round(payForm.value.amountDisplay * 100),
        date: Date.now(),
        method: payForm.value.method as any,
        notes: payForm.value.notes
    });

    showToast('Payment recorded', 'success');
    payDialog.value = false;
    payForm.value = { invoiceId: null, amountDisplay: 0, method: 'bank', notes: '' };
}

// -- HEADERS --
const itemHeaders = [
    { title: 'Product', key: 'label' },
    { title: 'Rented Qty', key: 'quantity', align: 'center' as const },
    { title: 'Returned', key: 'returned', align: 'center' as const },
    { title: 'Rate', key: 'price', align: 'end' as const },
];

const invoiceHeaders = [
    { title: 'Invoice #', key: 'invoice_number' },
    { title: 'Period', key: 'period' },
    { title: 'Amount', key: 'amount', align: 'end' as const },
    { title: 'Status', key: 'status', align: 'center' as const },
    { title: 'Actions', key: 'actions', align: 'end' as const },
];
</script>

<template>
    <div v-if="contract">
        <div class="d-flex align-center justify-space-between mb-6 no-print">
            <div class="d-flex align-center">
                <v-btn variant="text" icon="mdi-arrow-left" to="/orders" class="mr-2"></v-btn>
                <div>
                    <h1 class="text-h4 font-weight-bold">Contract #{{ contract.contract_number }}</h1>
                    <div class="text-subtitle-1 text-medium-emphasis">{{ contract.customer?.label }}</div>
                </div>
                <v-chip class="ml-4 text-uppercase" size="small"
                    :color="contract.status === 'active' ? 'blue' : 'success'" variant="flat">
                    {{ contract.status }}
                </v-chip>
            </div>

            <div v-if="contract.status === 'active' && contract.type === 'rental'">
                <v-btn color="orange-darken-2" variant="outlined" class="mr-2" prepend-icon="mdi-keyboard-return"
                    @click="openReturnDialog">
                    Return Items
                </v-btn>
                <v-btn color="success" variant="flat" prepend-icon="mdi-check-circle-outline" :loading="isCompleting"
                    @click="handleComplete">
                    Complete Contract
                </v-btn>
            </div>
        </div>

        <v-row>
            <v-col cols="12" md="7">
                <v-card v-if="contract.type === 'rental'" class="mb-6 bg-blue-lighten-5" border flat>
                    <v-card-text class="d-flex align-center justify-space-between py-3">

                        <div class="d-flex align-center">
                            <v-avatar color="blue" size="40" class="mr-3">
                                <v-icon color="white">mdi-cash-clock</v-icon>
                            </v-avatar>
                            <div>
                                <div class="text-caption text-blue-darken-3 font-weight-bold text-uppercase">Current
                                    Daily Rate</div>
                                <div class="text-h5 font-weight-bold text-blue-darken-4">
                                    €{{ formatMoney(contract.activeDailyRate) }} <span
                                        class="text-body-2 text-medium-emphasis">/day</span>
                                </div>
                            </div>
                        </div>

                        <div class="text-right hidden-xs">
                            <div class="text-caption text-medium-emphasis">Original Contract Value</div>
                            <div class="text-body-1 font-weight-medium text-grey-darken-1 text-decoration-line-through">
                                €{{ formatMoney(contract.total_amount) }}
                            </div>
                        </div>

                    </v-card-text>
                </v-card>
                <v-card border flat class="mb-6">
                    <v-card-title>Rented Items</v-card-title>
                    <v-data-table :items="contract.items" :headers="itemHeaders" density="compact">
                        <template v-slot:item.quantity="{ item }">
                            <span class="font-weight-bold">{{ item.quantity }}</span>
                        </template>
                        <template v-slot:item.returned="{ item }">
                            <span
                                :class="{ 'text-success font-weight-bold': item.returned_quantity === item.quantity }">
                                {{ item.returned_quantity || 0 }}
                            </span>
                        </template>
                        <template v-slot:item.price="{ item }">
                            €{{ formatMoney(item.price) }} <span class="text-caption text-grey">/day</span>
                        </template>
                        <template v-slot:bottom></template>
                    </v-data-table>
                </v-card>
            </v-col>

            <v-col cols="12" md="5">
                <v-card border flat class="h-100">
                    <v-card-item>
                        <div class="d-flex justify-space-between align-center">
                            <v-card-title>Invoices</v-card-title>
                            <v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-plus"
                                @click="openGenerateInvoiceDialog">
                                Generate
                            </v-btn>
                        </div>
                    </v-card-item>

                    <v-data-table :items="contract.invoices || []" :headers="invoiceHeaders" density="compact">
                        <template v-slot:item.invoice_number="{ item }">
                            <span class="font-weight-medium">#{{ item.invoice_number }}</span>
                        </template>

                        <template v-slot:item.period="{ item }">
                            <div class="text-caption">
                                {{ formatDate(item.start_date) }} - {{ formatDate(item.end_date) }}
                            </div>
                        </template>

                        <template v-slot:item.amount="{ item }">
                            <span class="font-weight-bold">€{{ formatMoney(item.amount) }}</span>
                        </template>

                        <template v-slot:item.status="{ item }">
                            <v-chip size="x-small" label :color="item.status === 'paid' ? 'green' : 'red'">
                                {{ item.status }}
                            </v-chip>
                        </template>

                        <template v-slot:item.actions="{ item }">
                            <v-btn icon="mdi-cash" size="x-small" variant="text" color="green"
                                v-if="item.status !== 'paid'" @click="openPaymentDialog(item)"></v-btn>
                            <v-btn icon="mdi-file-document-outline" size="x-small" variant="text" color="primary"
                                :to="`/invoices/${item._id}`"></v-btn>
                        </template>

                        <template v-slot:no-data>
                            <div class="text-caption text-center text-grey py-4">No invoices generated yet</div>
                        </template>
                    </v-data-table>
                </v-card>
            </v-col>
        </v-row>
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
                <v-btn color="primary" variant="flat" :loading="isReturning" @click="handleReturnSubmit">Confirm
                    Return</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <v-dialog v-model="genInvoiceDialog" max-width="400">
        <v-card>
            <v-card-title>Generate Invoice</v-card-title>
            <v-card-text class="pt-4">
                <v-text-field v-model="genInvoiceForm.start_date" type="date" label="Billing Start"
                    variant="outlined"></v-text-field>
                <v-text-field v-model="genInvoiceForm.end_date" type="date" label="Billing End"
                    variant="outlined"></v-text-field>
                <div class="text-caption text-grey">
                    Calculates daily rate for all active items in this period.
                </div>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="genInvoiceDialog = false">Cancel</v-btn>
                <v-btn color="primary" variant="flat" :loading="isGenerating"
                    @click="handleGenerateInvoice">Generate</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <v-dialog v-model="payDialog" max-width="400">
        <v-card>
            <v-card-title>Record Payment</v-card-title>
            <v-card-subtitle class="mb-2">Paying against Invoice</v-card-subtitle>
            <v-card-text>
                <v-text-field v-model.number="payForm.amountDisplay" label="Amount (€)" type="number" variant="outlined"
                    autofocus></v-text-field>
                <v-select v-model="payForm.method" :items="['bank', 'cash', 'card']" label="Method"
                    variant="outlined"></v-select>
                <v-text-field v-model="payForm.notes" label="Notes (Optional)" variant="outlined"></v-text-field>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="payDialog = false">Cancel</v-btn>
                <v-btn color="success" variant="flat" :loading="isPaying" @click="handlePayment">Confirm</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>