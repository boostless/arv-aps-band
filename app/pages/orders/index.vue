<script setup lang="ts">
import { api } from '~~/convex/_generated/api';

// -- DATA --
const { data: orders, isPending } = useConvexQuery(api.orders.list, {});
const { mutate: completeOrder, isPending: isCompleting } = useConvexMutation(api.orders.complete);
const { trigger: showToast } = useSnackbar();

// -- UTILS --
function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString('lt-LT'); // or 'en-US'
}

function formatMoney(cents: number) {
    return (cents / 100).toFixed(2);
}

function getStatusColor(status: string) {
    switch (status) {
        case 'active': return 'blue';
        case 'completed': return 'success';
        case 'draft': return 'grey';
        case 'cancelled': return 'error';
        default: return 'grey';
    }
}

// -- HEADERS --
const headers = [
    { title: 'Invoice #', key: 'invoice_number' },
    { title: 'Date', key: 'start_date' },
    { title: 'Customer', key: 'customerName' },
    { title: 'Type', key: 'type' },
    { title: 'Status', key: 'status' },
    { title: 'Total', key: 'total_amount', align: 'end' as const },
    { title: 'Actions', key: 'actions', sortable: false, align: 'end' as const },
];

async function handleComplete(orderId: any) {
    if (!confirm('Are you sure? This will return all items to stock and close the order.')) return;

    try {
        await completeOrder({ id: orderId });
        showToast('Order completed & stock returned', 'success');
    } catch (err: any) {
        showToast(err.toString().replace('Error: ', ''), 'error');
    }
}
</script>

<template>
    <div>
        <div class="d-flex align-center justify-space-between mb-6">
            <div>
                <h1 class="text-h4 font-weight-bold">Orders</h1>
                <div class="text-subtitle-1 text-medium-emphasis">Sales & Rentals history</div>
            </div>

            <v-btn color="primary" prepend-icon="mdi-plus" size="large" to="/orders/create">
                New Order
            </v-btn>
        </div>

        <v-card border flat>
            <v-data-table :headers="headers" :items="orders || []" :loading="isPending" hover density="comfortable">
                <template v-slot:item.invoice_number="{ item }">
                    <span class="font-weight-bold">#{{ item.invoice_number }}</span>
                </template>

                <template v-slot:item.start_date="{ item }">
                    {{ formatDate(item.start_date) }}
                </template>

                <template v-slot:item.type="{ item }">
                    <div class="d-flex align-center">
                        <v-icon size="small" class="mr-2" :color="item.type === 'rental' ? 'orange' : 'blue'">
                            {{ item.type === 'rental' ? 'mdi-clock-outline' : 'mdi-cart-outline' }}
                        </v-icon>
                        <span class="text-capitalize">{{ item.type }}</span>
                    </div>
                </template>

                <template v-slot:item.status="{ item }">
                    <v-chip :color="getStatusColor(item.status)" size="small" variant="tonal"
                        class="text-uppercase font-weight-bold">
                        {{ item.status }}
                    </v-chip>
                </template>

                <template v-slot:item.total_amount="{ item }">
                    <span class="font-weight-bold">
                        €{{ formatMoney(item.total_amount) }}
                    </span>
                </template>

                <template v-slot:item.actions="{ item }">
                    <v-btn icon="mdi-eye-outline" size="small" variant="text" color="primary"
                        :to="`/orders/${item._id}`">
                        <v-icon>mdi-eye-outline</v-icon>
                        <v-tooltip activator="parent" location="top">Peržiūrėti užsakymą</v-tooltip></v-btn>
                    <v-btn v-if="item.status == 'active'" icon="mdi-check-circle-outline" size="small" variant="text"
                        color="green" @click="handleComplete(item._id)" :loading="isCompleting">
                        <v-icon>mdi-check-circle-outline</v-icon>
                        <v-tooltip activator="parent" location="top">Užbaigti užsakymą</v-tooltip></v-btn>
                </template>

                <template v-slot:no-data>
                    <div class="pa-8 text-center">
                        <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-file-document-outline</v-icon>
                        <div class="text-h6 text-grey">No orders found</div>
                        <v-btn variant="text" color="primary" class="mt-2" to="/orders/create">
                            Create your first order
                        </v-btn>
                    </div>
                </template>

            </v-data-table>
        </v-card>
    </div>
</template>