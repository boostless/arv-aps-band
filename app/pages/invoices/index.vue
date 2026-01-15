<script setup lang="ts">
import { api } from '~~/convex/_generated/api';

const { data: invoices, isPending } = useConvexQuery(api.invoices.list, {});

// -- COMPUTED STATS --
const stats = computed(() => {
    if (!invoices.value) return { totalDue: 0, overdueCount: 0 };

    let totalDue = 0;
    let overdueCount = 0;

    invoices.value.forEach(inv => {
        if (inv.remainingAmount > 0 && inv.status !== 'void') {
            totalDue += inv.remainingAmount;
            if (inv.isOverdue) overdueCount++;
        }
    });

    return { totalDue, overdueCount };
});

// -- UTILS --
function formatMoney(cents: number) {
    return (cents / 100).toFixed(2);
}

function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString('lt-LT');
}

// -- HEADERS --
const headers = [
    { title: 'Invoice #', key: 'invoice_number' },
    { title: 'Date', key: 'start_date' },
    { title: 'Customer', key: 'customerName' },
    { title: 'Amount', key: 'amount', align: 'end' as const },
    { title: 'Paid', key: 'paidAmount', align: 'end' as const },
    { title: 'Balance', key: 'remainingAmount', align: 'end' as const },
    { title: 'Status', key: 'status', align: 'center' as const },
    { title: 'Actions', key: 'actions', sortable: false, align: 'end' as const },
];
</script>

<template>
    <div>
        <div class="d-flex align-center justify-space-between mb-6">
            <div>
                <h1 class="text-h4 font-weight-bold">Invoices</h1>
                <div class="text-subtitle-1 text-medium-emphasis">Financial overview</div>
            </div>
        </div>

        <v-row class="mb-4">
            <v-col cols="12" md="4">
                <v-card border flat color="red-lighten-5">
                    <v-card-text>
                        <div class="text-caption font-weight-bold text-red-darken-4 text-uppercase">Total Outstanding
                        </div>
                        <div class="text-h4 font-weight-bold text-red-darken-4">€{{ formatMoney(stats.totalDue) }}</div>
                        <div v-if="stats.overdueCount > 0" class="text-caption text-red-darken-3 mt-1">
                            {{ stats.overdueCount }} invoice(s) overdue
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>

        <v-card border flat>
            <v-data-table :headers="headers" :items="invoices || []" :loading="isPending" hover density="comfortable">

                <template v-slot:item.invoice_number="{ item }">
                    <span class="font-weight-medium">#{{ item.invoice_number }}</span>
                </template>

                <template v-slot:item.start_date="{ item }">
                    {{ formatDate(item.start_date) }}
                </template>

                <template v-slot:item.amount="{ item }">
                    <span class="font-weight-bold">€{{ formatMoney(item.amount) }}</span>
                </template>

                <template v-slot:item.paidAmount="{ item }">
                    <span class="text-medium-emphasis">€{{ formatMoney(item.paidAmount) }}</span>
                </template>

                <template v-slot:item.remainingAmount="{ item }">
                    <span v-if="item.remainingAmount > 0" class="text-red font-weight-bold">
                        €{{ formatMoney(item.remainingAmount) }}
                    </span>
                    <span v-else class="text-success text-caption font-weight-bold">PAID</span>
                </template>

                <template v-slot:item.status="{ item }">
                    <v-chip v-if="item.remainingAmount <= 0" color="success" size="small" variant="tonal" label>
                        Paid
                    </v-chip>
                    <v-chip v-else-if="item.status === 'void'" color="grey" size="small" variant="tonal" label>
                        Void
                    </v-chip>
                    <v-chip v-else :color="item.isOverdue ? 'error' : 'warning'" size="small" variant="tonal" label>
                        {{ item.isOverdue ? 'Overdue' : 'Unpaid' }}
                    </v-chip>
                </template>

                <template v-slot:item.actions="{ item }">
                    <v-btn icon="mdi-eye-outline" size="small" variant="text" color="primary"
                        :to="`/invoices/${item._id}`">
                        <v-icon>mdi-eye-outline</v-icon>
                        <v-tooltip activator="parent" location="top">Open Invoice</v-tooltip>
                    </v-btn>
                </template>

                <template v-slot:no-data>
                    <div class="pa-8 text-center text-grey">
                        <v-icon size="64" class="mb-4">mdi-file-document-outline</v-icon>
                        <div>No invoices generated yet.</div>
                        <div class="text-caption">Go to an Active Order to generate one.</div>
                    </div>
                </template>
            </v-data-table>
        </v-card>
    </div>
</template>