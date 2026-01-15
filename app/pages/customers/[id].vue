<script setup lang="ts">
import { api } from '~~/convex/_generated/api';
import type { Id } from '~~/convex/_generated/dataModel';

const route = useRoute();
const customerId = route.params.id as Id<'customers'>;

const { data: profile } = useConvexQuery(api.customers.get, { id: customerId });

// -- STATS --
const stats = computed(() => {
    if (!profile.value) return { debt: 0, overdueCount: 0, lifetime: 0 };

    // Debt = Unpaid Invoices
    const unpaidInvoices = profile.value.invoices.filter((inv: any) => inv.remainingAmount > 0 && inv.status !== 'void');
    const totalDebt = unpaidInvoices.reduce((sum: number, inv: any) => sum + inv.remainingAmount, 0);
    const overdueCount = unpaidInvoices.filter((inv: any) => inv.isOverdue).length;

    // Lifetime = Total of all invoices generated
    const lifetime = profile.value.invoices.reduce((sum: number, inv: any) => sum + inv.amount, 0);

    return {
        debt: totalDebt,
        overdueCount,
        lifetime
    };
});

// -- PAYMENT HISTORY --
const paymentHistory = computed(() => {
    if (!profile.value) return [];

    // 1. Extract payments from INVOICES (not orders)
    const allPayments = profile.value.invoices.flatMap((inv: any) =>
        inv.payments.map((payment: any) => ({
            ...payment,
            invoice_number: inv.invoice_number, // Link to invoice #
            invoice_id: inv._id
        }))
    );

    // 2. Sort by Date (Newest first)
    return allPayments.sort((a: any, b: any) => b.date - a.date);
});

// -- UTILS --
function formatMoney(cents: number) {
    return (cents / 100).toFixed(2);
}

function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString('lt-LT');
}

function getStatusColor(status: string) {
    switch (status) {
        case 'active': return 'blue';
        case 'completed': return 'success';
        case 'cancelled': return 'error';
        default: return 'grey';
    }
}

// -- HEADERS --
const orderHeaders = [
    { title: 'Contract #', key: 'contract_number' },
    { title: 'Date', key: 'start_date' },
    { title: 'Type', key: 'type' },
    { title: 'Status', key: 'status' },
    { title: 'Est. Value', key: 'total_amount', align: 'end' as const }, // Est. value of contract
    { title: 'Actions', key: 'actions', sortable: false, align: 'end' as const },
];

const paymentHeaders = [
    { title: 'Date', key: 'date' },
    { title: 'Invoice Ref', key: 'invoice_number' },
    { title: 'Method', key: 'method' },
    { title: 'Amount', key: 'amount', align: 'end' as const },
];
</script>

<template>
    <div v-if="profile">
        <div class="mb-6">
            <v-btn variant="text" prepend-icon="mdi-arrow-left" to="/customers" class="mb-2 pl-0">
                Back to List
            </v-btn>
            <div class="d-flex align-center justify-space-between">
                <div>
                    <h1 class="text-h4 font-weight-bold">{{ profile.customer.label }}</h1>
                    <div class="text-subtitle-1 text-medium-emphasis">{{ profile.customer.code }}</div>
                </div>
            </div>
        </div>

        <v-row>
            <v-col cols="12" md="4">

                <v-card class="mb-4" border flat :color="stats.debt > 0 ? 'red-lighten-5' : undefined">
                    <v-card-text>
                        <div class="text-caption font-weight-bold text-uppercase mb-1"
                            :class="stats.debt > 0 ? 'text-red-darken-4' : 'text-grey'">
                            Total Invoiced Debt
                        </div>
                        <div v-if="stats.debt > 0" class="text-h4 font-weight-bold"
                            :class="stats.debt > 0 ? 'text-red-darken-4' : ''">
                            €{{ formatMoney(stats.debt) }}
                        </div>
                        <div v-else class="text-caption mt-1 text-success font-weight-bold">
                            All Invoices Paid
                        </div>
                        <div v-if="stats.overdueCount > 0" class="text-caption text-red font-weight-bold mt-1">
                            {{ stats.overdueCount }} Overdue Invoice(s)
                        </div>
                    </v-card-text>
                </v-card>

                <v-card border flat>
                    <v-card-title class="text-subtitle-1 font-weight-bold">Contact Details</v-card-title>
                    <v-list density="compact">
                        <v-list-item prepend-icon="mdi-map-marker">
                            <v-list-item-title class="text-wrap">{{ profile.customer.address }}</v-list-item-title>
                        </v-list-item>

                        <v-list-item v-if="profile.customer.email" prepend-icon="mdi-email">
                            <v-list-item-title>{{ profile.customer.email }}</v-list-item-title>
                        </v-list-item>

                        <v-list-item v-if="profile.customer.phone" prepend-icon="mdi-phone">
                            <v-list-item-title>{{ profile.customer.phone }}</v-list-item-title>
                        </v-list-item>

                        <v-divider class="my-2"></v-divider>

                        <v-list-item v-if="profile.customer.company_code">
                            <template v-slot:prepend>
                                <span class="text-caption font-weight-bold mr-3" style="width: 24px">CO</span>
                            </template>
                            <v-list-item-title>{{ profile.customer.company_code }}</v-list-item-title>
                        </v-list-item>

                        <v-list-item v-if="profile.customer.vat_code">
                            <template v-slot:prepend>
                                <span class="text-caption font-weight-bold mr-3" style="width: 24px">VAT</span>
                            </template>
                            <v-list-item-title>{{ profile.customer.vat_code }}</v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-card>
            </v-col>

            <v-col cols="12" md="8">

                <v-card v-if="stats.debt > 0" border flat class="mb-6 border-red">
                    <v-card-item>
                        <div class="d-flex justify-space-between align-center">
                            <v-card-title class="text-red-darken-3">Unpaid Invoices</v-card-title>
                        </div>
                    </v-card-item>
                    <v-table density="compact">
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Date</th>
                                <th class="text-right">Total</th>
                                <th class="text-right">Due</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="inv in profile.invoices.filter((i: any) => i.remainingAmount > 0)"
                                :key="inv._id">
                                <td class="font-weight-bold">#{{ inv.invoice_number }}</td>
                                <td>{{ formatDate(inv.start_date) }}</td>
                                <td class="text-right">€{{ formatMoney(inv.amount) }}</td>
                                <td class="text-right text-red font-weight-bold">€{{ formatMoney(inv.remainingAmount) }}
                                </td>
                                <td class="text-right">
                                    <v-btn size="x-small" variant="text" color="primary"
                                        :to="`/invoices/${inv._id}`">View</v-btn>
                                </td>
                            </tr>
                        </tbody>
                    </v-table>
                </v-card>

                <v-card border flat class="mb-6">
                    <v-card-item>
                        <v-card-title>Contracts History</v-card-title>
                        <v-card-subtitle>Lifetime Invoiced: €{{ formatMoney(stats.lifetime) }}</v-card-subtitle>
                    </v-card-item>

                    <v-data-table :headers="orderHeaders" :items="profile.orders" density="comfortable" hover>
                        <template v-slot:item.contract_number="{ item }">
                            <span class="font-weight-medium">#{{ item.contract_number }}</span>
                        </template>

                        <template v-slot:item.start_date="{ item }">
                            {{ formatDate(item.start_date) }}
                        </template>

                        <template v-slot:item.type="{ item }">
                            <span class="text-capitalize">{{ item.type }}</span>
                        </template>

                        <template v-slot:item.status="{ item }">
                            <v-chip :color="getStatusColor(item.status)" size="small" variant="tonal"
                                class="text-uppercase font-weight-bold">
                                {{ item.status }}
                            </v-chip>
                        </template>

                        <template v-slot:item.total_amount="{ item }">
                            €{{ formatMoney(item.total_amount) }}
                        </template>

                        <template v-slot:item.actions="{ item }">
                            <v-btn icon="mdi-chevron-right" variant="text" size="small"
                                :to="`/orders/${item._id}`"></v-btn>
                        </template>
                    </v-data-table>
                </v-card>

                <v-card border flat>
                    <v-card-item>
                        <v-card-title>Payment History</v-card-title>
                        <v-card-subtitle>All transactions recorded against invoices</v-card-subtitle>
                    </v-card-item>

                    <v-data-table :headers="paymentHeaders" :items="paymentHistory" density="comfortable" hover>
                        <template v-slot:item.date="{ item }">
                            {{ formatDate(item.date) }}
                        </template>

                        <template v-slot:item.invoice_number="{ item }">
                            <NuxtLink :to="`/invoices/${item.invoice_id}`"
                                class="text-decoration-none text-primary font-weight-medium">
                                #{{ item.invoice_number }}
                            </NuxtLink>
                        </template>

                        <template v-slot:item.method="{ item }">
                            <v-chip size="x-small" label class="text-capitalize">
                                {{ item.method }}
                            </v-chip>
                            <span v-if="item.notes" class="text-caption text-grey ml-2">
                                {{ item.notes }}
                            </span>
                        </template>

                        <template v-slot:item.amount="{ item }">
                            <span class="text-success font-weight-bold">
                                +€{{ formatMoney(item.amount) }}
                            </span>
                        </template>

                        <template v-slot:no-data>
                            <div class="text-caption text-grey text-center pa-4">
                                No payments recorded yet.
                            </div>
                        </template>
                    </v-data-table>
                </v-card>

            </v-col>
        </v-row>
    </div>
</template>