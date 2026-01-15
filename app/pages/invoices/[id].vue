<script setup lang="ts">
import { api } from '~~/convex/_generated/api';
import type { Id } from '~~/convex/_generated/dataModel';

const route = useRoute();
const invoiceId = route.params.id as Id<'invoices'>;
const { trigger: showToast } = useSnackbar();

// -- DATA --
// We reuse the 'get' query from invoices.ts which returns invoice + payments
const { data: invoice, isPending } = useConvexQuery(api.invoices.get, { id: invoiceId });
const { mutate: markVoid, isPending: isVoiding } = useConvexMutation(api.invoices.voidInvoice);

// -- DIALOG STATE --
const payDialog = ref(false);
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

async function handleVoid() {
    if (!confirm('Are you sure you want to VOID this invoice? This cannot be undone.')) return;

    try {
        await markVoid({ id: invoiceId });
        showToast('Invoice marked as Void', 'success');
    } catch (err: any) {
        showToast(err.toString().replace('Error: ', ''), 'error');
    }
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
                <h1 class="text-h4 font-weight-bold"
                    :class="invoice.status === 'void' ? 'text-decoration-line-through text-grey' : ''">
                    Invoice #{{ invoice.invoice_number }}
                </h1>

                <v-chip class="ml-4 text-uppercase" size="small"
                    :color="invoice.status === 'void' ? 'grey' : (isPaid ? 'success' : 'error')" variant="flat">
                    {{ invoice.status === 'void' ? 'VOID' : (isPaid ? 'PAID' : 'UNPAID') }}
                </v-chip>
            </div>

            <div>
                <v-btn variant="outlined" class="mr-2" @click="printInvoice">
                    <v-icon start>mdi-printer</v-icon> Print
                </v-btn>

                <v-btn v-if="!isPaid && invoice.status !== 'void'" color="success" class="mr-2" prepend-icon="mdi-cash"
                    @click="payDialog = true">
                    Record Payment
                </v-btn>

                <v-btn v-if="invoice.status !== 'void' && !isPaid" color="error" variant="text" :loading="isVoiding"
                    @click="handleVoid">
                    Void
                </v-btn>
            </div>
        </div>

        <v-card class="invoice-card pa-8" border flat
            :style="invoice.status === 'void' ? 'opacity: 0.5; background-color: #f5f5f5;' : ''">
            <div v-if="invoice.status === 'void'"
                class="position-absolute d-flex justify-center align-center w-100 h-100"
                style="top:0; left:0; pointer-events: none; z-index: 10;">
                <div class="text-h1 font-weight-black text-grey-lighten-1"
                    style="transform: rotate(-30deg); border: 10px solid #bdbdbd; padding: 20px; opacity: 0.4;">
                    VOID
                </div>
            </div>
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
                    <div v-if="invoice.due_date" class="text-subtitle-2 font-weight-bold mt-1"
                        :class="isOverdue ? 'text-red' : ''">
                        Due Date: {{ formatDate(invoice.due_date) }}
                    </div>
                </v-col>
            </v-row>

            <v-divider class="mb-8"></v-divider>

            <v-row class="mb-8">
                <v-col cols="12">
                    <div class="text-h6">{{ invoice.customer_name || 'Unknown Customer' }}</div>
                    <div class="text-body-2 text-medium-emphasis">
                        {{ invoice.customer_address }}<br>
                        <span v-if="invoice.customer_vat">VAT: {{ invoice.customer_vat }}</span>
                    </div>

                    <div class="text-caption text-grey mt-8 pt-4 border-top">
                        Invoice created by: {{ invoice.created_by }}
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

    <PaymentDialog v-model="payDialog" :invoice-id="invoice?._id" :remaining-amount="remainingDue"
        @success="showToast('Payment recorded successfully', 'success')" />
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