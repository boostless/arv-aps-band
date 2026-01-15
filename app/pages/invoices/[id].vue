<script setup lang="ts">
import { api } from '~~/convex/_generated/api';
import type { Id } from '~~/convex/_generated/dataModel';

const route = useRoute();
const invoiceId = route.params.id as Id<'invoices'>;
const { trigger: showToast } = useSnackbar();

// -- DATA --
// We reuse the 'get' query from invoices.ts which returns invoice + payments
const { data: invoice, isPending } = useConvexQuery(api.invoices.get, { id: invoiceId });

// -- PAYMENT MUTATION --
const { mutate: addPayment, isPending: isPaying } = useConvexMutation(api.payments.add);

// -- DIALOG STATE --
const payDialog = ref(false);
const payForm = ref({ amountDisplay: 0, method: 'bank', notes: '' });

// -- COMPUTED --
const remainingDue = computed(() => {
    if (!invoice.value) return 0;
    return invoice.value.amount - (invoice.value.paidAmount || 0);
});

const isPaid = computed(() => remainingDue.value <= 0);

// -- UTILS --
function formatMoney(cents: number) {
    return (cents / 100).toFixed(2);
}

function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString('lt-LT');
}

function printInvoice() {
    window.print();
}

// -- ACTIONS --
function openPaymentDialog() {
    // Auto-fill remaining amount
    payForm.value.amountDisplay = remainingDue.value / 100;
    payDialog.value = true;
}

async function handlePayment() {
    if (payForm.value.amountDisplay <= 0) return;

    await addPayment({
        invoice_id: invoiceId,
        amount: Math.round(payForm.value.amountDisplay * 100),
        date: Date.now(),
        method: payForm.value.method as any,
        notes: payForm.value.notes
    });

    showToast('Payment recorded', 'success');
    payDialog.value = false;
    payForm.value = { amountDisplay: 0, method: 'bank', notes: '' };
}

const isOverdue = computed(() => {
    if (!invoice.value || isPaid.value) return false;
    return Date.now() > (invoice.value.due_date || 0);
});
</script>

<template>
    <div v-if="invoice">
        <div class="d-flex align-center justify-space-between mb-6 no-print">
            <div class="d-flex align-center">
                <v-btn variant="text" icon="mdi-arrow-left" @click="$router.back()" class="mr-2"></v-btn>
                <h1 class="text-h4 font-weight-bold">Invoice #{{ invoice.invoice_number }}</h1>
                <v-chip class="ml-4 text-uppercase" size="small" :color="isPaid ? 'success' : 'error'" variant="flat">
                    {{ isPaid ? 'PAID' : 'UNPAID' }}
                </v-chip>
            </div>
            <div>
                <v-btn variant="outlined" class="mr-2" @click="printInvoice">
                    <v-icon start>mdi-printer</v-icon> Print
                </v-btn>
                <v-btn v-if="!isPaid" color="success" prepend-icon="mdi-cash" @click="openPaymentDialog">
                    Record Payment
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
                        Period: {{ formatDate(invoice.start_date) }} - {{ formatDate(invoice.end_date) }}
                    </div>
                    <div v-if="invoice.due_date" class="text-subtitle-2 font-weight-bold mt-1" :class="isOverdue ? 'text-red' : ''">
                        Due Date: {{ formatDate(invoice.due_date) }}
                    </div>
                </v-col>
            </v-row>

            <v-divider class="mb-8"></v-divider>

            <v-row class="mb-8">
                <v-col cols="12">
                    <div class="text-caption text-uppercase font-weight-bold text-grey mb-2">Bill To</div>
                    <div class="text-h6">{{ invoice.customer?.label || 'Unknown Customer' }}</div>
                    <div class="text-body-2 text-medium-emphasis">
                        {{ invoice.customer?.address }}<br>
                        {{ invoice.customer?.company_code ? `Code: ${invoice.customer.company_code}` : '' }}<br>
                        {{ invoice.customer?.vat_code ? `VAT: ${invoice.customer.vat_code}` : '' }}
                    </div>
                </v-col>
            </v-row>

            <v-table class="mb-8" density="comfortable">
                <thead>
                    <tr>
                        <th class="text-left font-weight-bold">Description</th>
                        <th class="text-right font-weight-bold">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="py-2">
                            <div class="font-weight-medium">Rental Services</div>
                            <div class="text-caption text-grey">
                                Contract Reference: #{{ invoice.order_id }}
                            </div>
                        </td>
                        <td class="text-right font-weight-bold">€{{ formatMoney(invoice.amount) }}</td>
                    </tr>
                </tbody>
            </v-table>

            <v-row>
                <v-col cols="6">
                    <div class="mt-6">
                        <div class="text-caption font-weight-bold text-grey mb-1">Payment Details:</div>
                        <div v-for="bank in invoice.settings?.banks" :key="bank.iban" class="text-body-2 mb-2">
                            <strong>{{ bank.name }}</strong><br>
                            IBAN: {{ bank.iban }}
                        </div>
                    </div>
                </v-col>

                <v-col cols="4" offset="2">
                    <div class="d-flex justify-space-between mb-2">
                        <span class="text-medium-emphasis">Subtotal</span>
                        <span class="font-weight-medium">€{{ formatMoney(invoice.amount - invoice.tax_amount) }}</span>
                    </div>
                    <div class="d-flex justify-space-between mb-2">
                        <span class="text-medium-emphasis">VAT</span>
                        <span class="font-weight-medium">€{{ formatMoney(invoice.tax_amount) }}</span>
                    </div>
                    <v-divider class="my-3"></v-divider>
                    <div class="d-flex justify-space-between text-h5 font-weight-bold bg-grey-lighten-4 pa-3 rounded">
                        <span>Total</span>
                        <span>€{{ formatMoney(invoice.amount) }}</span>
                    </div>
                </v-col>
            </v-row>
        </v-card>

        <div class="mt-8 no-print">
            <div class="text-h6 mb-2">Payments</div>
            <v-table density="compact" class="bg-grey-lighten-5 rounded">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Method</th>
                        <th>Note</th>
                        <th class="text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="pay in invoice.payments" :key="pay._id">
                        <td>{{ formatDate(pay.date) }}</td>
                        <td class="text-capitalize">{{ pay.method }}</td>
                        <td class="text-caption">{{ pay.notes }}</td>
                        <td class="text-right font-weight-bold">€{{ formatMoney(pay.amount) }}</td>
                    </tr>
                    <tr v-if="!invoice.payments || invoice.payments.length === 0">
                        <td colspan="4" class="text-center text-caption text-grey">No payments yet.</td>
                    </tr>
                    <tr>
                        <td colspan="3" class="text-right font-weight-bold">Balance Due:</td>
                        <td class="text-right font-weight-bold"
                            :class="remainingDue > 0 ? 'text-error' : 'text-success'">
                            €{{ formatMoney(remainingDue) }}
                        </td>
                    </tr>
                </tbody>
            </v-table>
        </div>
    </div>

    <div v-else-if="isPending" class="d-flex justify-center align-center" style="height: 50vh;">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>

    <v-dialog v-model="payDialog" max-width="400">
        <v-card>
            <v-card-title>Record Payment</v-card-title>
            <v-card-text class="pt-4">
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

<style scoped>
@media print {
    .no-print {
        display: none !important;
    }

    .invoice-card {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
    }

    /* Hide Vuetify default layout padding if needed */
    .v-application__wrap {
        min-height: auto;
    }
}
</style>